const Job = require('../models/Job');
const logger = require('../utils/logger');
const { generateEmbedding } = require('../services/gemini');
const { searchSimilarChunks } = require('../services/pinecone');
const { deleteJobVectors } = require('../services/pinecone');
const { Application, Resume } = require('../models/Application');
const { scoreResumeLocally } = require('../services/localScoring');
const User = require('../models/User');
const fs = require('fs');

const cleanStringList = value => Array.isArray(value)
  ? [...new Set(value.map(item => String(item).trim()).filter(Boolean))]
  : [];

const validateJobInput = (payload, partial = false) => {
  const requiredFields = ['title', 'description', 'requirements', 'requiredSkills'];
  for (const field of requiredFields) {
    if (!partial || Object.prototype.hasOwnProperty.call(payload, field)) {
      const value = payload[field];
      if (!value || (Array.isArray(value) && value.length === 0)) {
        return `${field} is required.`;
      }
    }
  }
  if (payload.deadline && new Date(payload.deadline) <= new Date()) {
    return 'Deadline must be in the future.';
  }
  return null;
};

const rescoreJobApplications = async job => {
  const applications = await Application.find({ job: job._id }).populate('resume');
  if (!applications.length) return 0;
  const operations = applications
    .filter(application => application.resume?.rawText)
    .map(application => ({
      updateOne: {
        filter: { _id: application._id },
        update: {
          $set: {
            ...scoreResumeLocally(job, application.resume.rawText),
            isAiProcessed: true,
            aiProcessedAt: new Date(),
            processingError: null
          }
        }
      }
    }));
  if (operations.length) await Application.bulkWrite(operations);
  await Resume.updateMany(
    { job: job._id },
    { $set: { jobId: job.jobId, jobTitle: job.title } }
  );
  return operations.length;
};

exports.createJob = async (req, res, next) => {
  try {
    const {
      title, description, requirements, requiredSkills,
      niceToHaveSkills, location, type, experienceLevel,
      salary, deadline
    } = req.body;

    const normalized = {
      ...req.body,
      requirements: cleanStringList(requirements),
      requiredSkills: cleanStringList(requiredSkills),
      niceToHaveSkills: cleanStringList(niceToHaveSkills)
    };
    const validationError = validateJobInput(normalized);
    if (validationError) return res.status(400).json({ error: validationError });

    const job = new Job({
      recruiter: req.user._id,
      company: req.user.company || 'My Company',
      title: String(title).trim(),
      description: String(description).trim(),
      requirements: normalized.requirements,
      requiredSkills: normalized.requiredSkills,
      niceToHaveSkills: normalized.niceToHaveSkills,
      location, type, experienceLevel, salary, deadline
    });

    await job.save();
    logger.info(`Job created: ${job.jobId} by ${req.user.email}`);

    res.status(201).json({
      message: 'Job posted successfully',
      job,
      applyLink: `${process.env.CLIENT_URL}/jobs/apply/${job.jobId}`
    });
  } catch (error) { next(error); }
};

exports.getMyJobs = async (req, res, next) => {
  try {
    const jobs = await Job.find({ recruiter: req.user._id })
      .sort({ createdAt: -1 });
    res.json({ jobs });
  } catch (error) { next(error); }
};

exports.getJobByJobId = async (req, res, next) => {
  try {
    const job = await Job.findOne({ jobId: req.params.jobId })
      .populate('recruiter', 'fullName company email');
    if (!job) return res.status(404).json({ error: 'Job not found.' });
    res.json({ job });
  } catch (error) { next(error); }
};

exports.getAllActiveJobs = async (req, res, next) => {
  try {
    const { search, type, experienceLevel, page = 1, limit = 20 } = req.query;
    const query = { status: 'active' };
    if (search) query.$text = { $search: search };
    if (type) query.type = type;
    if (experienceLevel) query.experienceLevel = experienceLevel;

    const jobs = await Job.find(query)
      .populate('recruiter', 'fullName company')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const count = await Job.countDocuments(query);
    res.json({ jobs, total: count, page: parseInt(page), pages: Math.ceil(count / limit) });
  } catch (error) { next(error); }
};

exports.updateJob = async (req, res, next) => {
  try {
    const allowed = [
      'title', 'description', 'requirements', 'requiredSkills', 'niceToHaveSkills',
      'location', 'type', 'experienceLevel', 'salary', 'deadline'
    ];
    const updates = Object.fromEntries(
      Object.entries(req.body).filter(([key]) => allowed.includes(key))
    );
    if (updates.requirements) updates.requirements = cleanStringList(updates.requirements);
    if (updates.requiredSkills) updates.requiredSkills = cleanStringList(updates.requiredSkills);
    if (updates.niceToHaveSkills) updates.niceToHaveSkills = cleanStringList(updates.niceToHaveSkills);
    if (typeof updates.title === 'string') updates.title = updates.title.trim();
    if (typeof updates.description === 'string') updates.description = updates.description.trim();
    const validationError = validateJobInput(updates, true);
    if (validationError) return res.status(400).json({ error: validationError });

    const job = await Job.findOneAndUpdate(
      { _id: req.params.id, recruiter: req.user._id },
      updates,
      { new: true, runValidators: true }
    );
    if (!job) return res.status(404).json({ error: 'Job not found.' });
    const rescoredApplications = await rescoreJobApplications(job);
    res.json({ job, rescoredApplications });
  } catch (error) { next(error); }
};

exports.toggleJobStatus = async (req, res, next) => {
  try {
    if (!['active', 'paused', 'closed'].includes(req.body.status)) {
      return res.status(400).json({ error: 'Invalid job status.' });
    }
    const job = await Job.findOne({ _id: req.params.id, recruiter: req.user._id });
    if (!job) return res.status(404).json({ error: 'Job not found.' });
    job.status = req.body.status;
    await job.save();
    res.json({ message: `Job ${job.status}`, job });
  } catch (error) { next(error); }
};

exports.deleteJob = async (req, res, next) => {
  try {
    const job = await Job.findOne({ _id: req.params.id, recruiter: req.user._id });
    if (!job) return res.status(404).json({ error: 'Job not found.' });

    const [applications, resumes] = await Promise.all([
      Application.find({ job: job._id }).select('candidate'),
      Resume.find({ job: job._id }).select('filePath')
    ]);
    const candidateIds = [...new Set(applications.map(item => item.candidate.toString()))];

    await Promise.all([
      Application.deleteMany({ job: job._id }),
      Resume.deleteMany({ job: job._id })
    ]);
    await job.deleteOne();

    await Promise.allSettled(
      resumes.filter(resume => resume.filePath).map(resume => fs.promises.unlink(resume.filePath))
    );
    await deleteJobVectors(job._id.toString());

    for (const candidateId of candidateIds) {
      const hasOtherApplications = await Application.exists({ candidate: candidateId });
      if (!hasOtherApplications) {
        await User.deleteOne({ _id: candidateId, role: 'candidate' });
      }
    }

    res.json({
      message: 'Job and related application data deleted.',
      deletedApplications: applications.length,
      deletedResumes: resumes.length
    });
  } catch (error) { next(error); }
};

// Recruiter: rank resumes for a job using vector similarity + aggregation
exports.matchJob = async (req, res, next) => {
  try {
    const job = await Job.findById(req.params.id);
    if (!job) return res.status(404).json({ error: 'Job not found.' });
    if (job.recruiter.toString() !== req.user._id.toString()) return res.status(403).json({ error: 'Not authorized.' });

    // Build job text for embedding
    const requirementsText = Array.isArray(job.requirements) ? job.requirements.join(' ') : (job.requirements || '');
    const jobText = `${job.title} ${job.description} ${requirementsText} ${job.requiredSkills.join(' ')}`;

    const jobEmbedding = await generateEmbedding(jobText);

    // Search globally across indexed resume chunks
    const matches = await searchSimilarChunks(jobEmbedding, null, 500);

    // Aggregate scores by candidateId
    const agg = {};
    for (const m of matches) {
      const id = m.candidateId;
      if (!agg[id]) agg[id] = { total: 0, count: 0, topChunks: [] };
      agg[id].total += m.score;
      agg[id].count += 1;
      agg[id].topChunks.push({ text: m.text, score: m.score });
    }

    const candidates = Object.keys(agg).map(id => {
      const entry = agg[id];
      entry.topChunks.sort((a, b) => b.score - a.score);
      return { candidateId: id, avgScore: entry.total / entry.count, topChunks: entry.topChunks.slice(0, 3) };
    });

    candidates.sort((a, b) => b.avgScore - a.avgScore);

    // Fetch candidate profiles and latest resume ids for top results
    const top = candidates.slice(0, 25);
    const results = [];
    for (const c of top) {
      const user = await User.findById(c.candidateId).select('fullName email');
      const resume = await Resume.findOne({ candidate: c.candidateId }).sort({ processedAt: -1 });
      results.push({
        candidateId: c.candidateId,
        candidate: user || null,
        resumeId: resume ? resume._id : null,
        score: Math.round(c.avgScore * 100) / 100,
        topChunks: c.topChunks
      });
    }

    res.json({ job: { _id: job._id, title: job.title }, matches: results });
  } catch (error) { next(error); }
};

exports.getMyJob = async (req, res, next) => {
  try {
    const job = await Job.findOne({ _id: req.params.id, recruiter: req.user._id });
    if (!job) return res.status(404).json({ error: 'Job not found.' });
    res.json({ job });
  } catch (error) { next(error); }
};
