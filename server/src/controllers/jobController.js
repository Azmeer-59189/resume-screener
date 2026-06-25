const Job = require('../models/Job');
const logger = require('../utils/logger');
const { generateEmbedding } = require('../services/gemini');
const { searchSimilarChunks } = require('../services/pinecone');
const { Resume } = require('../models/Application');
const User = require('../models/User');

exports.createJob = async (req, res, next) => {
  try {
    const {
      title, description, requirements, requiredSkills,
      niceToHaveSkills, location, type, experienceLevel,
      salary, deadline
    } = req.body;

    const job = new Job({
      recruiter: req.user._id,
      company: req.user.company || 'My Company',
      title, description, requirements,
      requiredSkills: requiredSkills || [],
      niceToHaveSkills: niceToHaveSkills || [],
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
    const job = await Job.findOneAndUpdate(
      { _id: req.params.id, recruiter: req.user._id },
      updates,
      { new: true, runValidators: true }
    );
    if (!job) return res.status(404).json({ error: 'Job not found.' });
    res.json({ job });
  } catch (error) { next(error); }
};

exports.toggleJobStatus = async (req, res, next) => {
  try {
    const job = await Job.findOne({ _id: req.params.id, recruiter: req.user._id });
    if (!job) return res.status(404).json({ error: 'Job not found.' });
    job.status = req.body.status;
    await job.save();
    res.json({ message: `Job ${job.status}`, job });
  } catch (error) { next(error); }
};

exports.deleteJob = async (req, res, next) => {
  try {
    const deleted = await Job.findOneAndDelete({ _id: req.params.id, recruiter: req.user._id });
    if (!deleted) return res.status(404).json({ error: 'Job not found.' });
    res.json({ message: 'Job deleted.' });
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
