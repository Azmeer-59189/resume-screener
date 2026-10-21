const { randomUUID } = require('node:crypto');
const { ANALYSIS_LEASE_MS, analysisStatus } = require('../services/analysisState');
const { buildSkillEvidence } = require('../services/skillEvidence');
const resumeStorage = require('../services/resumeStorage');
const { Application, Resume } = require('../models/Application');
const Job = require('../models/Job');
const User = require('../models/User');
const { extractText, chunkText, cleanText } = require('../services/pdfService');
const { generateEmbedding, analyzeResumeMatch } = require('../services/gemini');
const { storeEmbeddings, searchSimilarChunks } = require('../services/pinecone');
const { scoreResumeLocally, normalizeAiAnalysis } = require('../services/localScoring');
const { isHiringAgentConfigured, runHiringAgentPipeline } = require('../services/hiringAgent');
const { sendApplicationStatusEmail } = require('../services/email');
const logger = require('../utils/logger');
const fs = require('fs');
const path = require('path');

const removeUpload = filePath => {
  return filePath ? fs.promises.unlink(filePath).catch(() => {}) : Promise.resolve();
};

exports.applyToJob = async (req, res, next) => {
  let storageId;
  let savedResume;
  let applicationSaved = false;
  try {
    const { jobId } = req.params;
    const { fullName, email, coverLetter } = req.body;

    if (!fullName || !email) {
      removeUpload(req.file?.path);
      return res.status(400).json({ error: 'Full name and email are required.' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'Resume file is required.' });
    }

    const job = await Job.findOne({ jobId });
    if (!job) {
      removeUpload(req.file.path);
      return res.status(404).json({ error: 'Job not found.' });
    }
    if (job.status !== 'active') {
      removeUpload(req.file.path);
      return res.status(400).json({ error: 'This job is no longer accepting applications.' });
    }
    if (job.deadline && new Date(job.deadline) < new Date()) {
      removeUpload(req.file.path);
      return res.status(400).json({ error: 'The application deadline has passed.' });
    }

    let candidate = await User.findOne({ email: email.toLowerCase() });
    if (!candidate) {
      candidate = await User.create({
        email: email.toLowerCase(),
        passwordHash: `guest_${Date.now()}_${Math.random()}`,
        fullName,
        role: 'candidate',
        isActive: true
      });
      logger.info(`Guest candidate created: ${email}`);
    } else if (candidate.role !== 'candidate') {
      removeUpload(req.file.path);
      return res.status(409).json({ error: 'This email belongs to a recruiter account. Use another email to apply.' });
    }

    const existing = await Application.findOne({ job: job._id, candidate: candidate._id });
    if (existing) {
      removeUpload(req.file.path);
      return res.status(409).json({ error: 'This email has already applied to this job.' });
    }

    const rawText = await extractText(req.file.path);
    const cleanedText = cleanText(rawText);
    const chunks = chunkText(cleanedText);
    const shouldWaitForAgentScore = isHiringAgentConfigured()
      && process.env.HIRING_AGENT_USE_LLM === 'true'
      && process.env.HIRING_AGENT_SHOW_BASELINE !== 'true';
    const baseline = scoreResumeLocally(job, cleanedText);

    storageId = process.env.VERCEL
      ? await resumeStorage.store(req.file.path, req.file.originalname)
      : undefined;
    const resume = await Resume.create({
      candidate: candidate._id,
      job: job._id,
      jobId: job.jobId,
      jobTitle: job.title,
      originalFileName: req.file.originalname,
      filePath: storageId ? undefined : req.file.path,
      storageId,
      rawText: cleanedText,
      chunks
    });

    savedResume = resume;
    const application = await Application.create({
      job: job._id,
      candidate: candidate._id,
      resume: resume._id,
      coverLetter,
      status: 'applied',
      isAiProcessed: false,
      ...baseline
    });

    applicationSaved = true;
    await Job.findByIdAndUpdate(job._id, { $inc: { totalApplications: 1 } });

    if (storageId) await removeUpload(req.file.path);
    const analysis = processAIAnalysis(application._id, job, resume, chunks, fullName);
    if (process.env.VERCEL) await analysis;
    else analysis.catch(error => logger.error(`Background AI processing failed: ${error.message}`));

    res.status(201).json({
      message: 'Application submitted successfully.',
      applicationId: application._id,
      baselineScore: shouldWaitForAgentScore ? null : baseline.matchScore,
      aiProcessingQueued: !process.env.VERCEL && shouldWaitForAgentScore
    });
  } catch (error) {
    if (!applicationSaved) {
      if (savedResume) await Resume.deleteOne({ _id: savedResume._id }).catch(() => {});
      if (storageId) await resumeStorage.remove(storageId).catch(() => {});
      await removeUpload(req.file?.path);
    }
    next(error);
  }
};

const processAIAnalysis = async (applicationId, job, resume, chunks, candidateName) => {
  const runId = randomUUID();
  const claimed = await Application.findOneAndUpdate({
    _id: applicationId,
    $or: [
      { processingStatus: { $ne: 'processing' } },
      { processingStartedAt: { $lt: new Date(Date.now() - ANALYSIS_LEASE_MS) } },
      { processingStartedAt: { $exists: false } }
    ]
  }, {
    $set: { processingStatus: 'processing', processingStartedAt: new Date(), processingRunId: runId },
    $inc: { processingAttempts: 1 }
  }, { new: true });
  if (!claimed) return { busy: true };
  const finish = async (_id, update) => Application.findOneAndUpdate(
    { _id: applicationId, processingRunId: runId },
    { $set: {
      ...(update.scoringMethod && update.scoringMethod !== 'agent' ? { hiringAgent: {}, biasFlags: null, interviewQuestions: [] } : {}),
      ...update,
      roleAssessments: (update.roleAssessments || []).map(item => ({
        ...item,
        supported: Boolean(item.supported && item.resumeQuote && (resume.rawText || '').includes(item.resumeQuote)),
        resumeQuote: item.supported && item.resumeQuote && (resume.rawText || '').includes(item.resumeQuote) ? item.resumeQuote : ''
      })),
      skillEvidence: buildSkillEvidence(update.matchedSkills || [], resume.rawText || ''),
      processingStatus: update.processingError ? 'fallback' : 'completed',
      processingFinishedAt: new Date()
    } }
  );
  try {
    logger.info(`Processing AI analysis for application ${applicationId}`);

    try {
      const agentResult = await runHiringAgentPipeline({
        job,
        resumeText: resume.rawText || '',
        sourceFile: resume.originalFileName,
        useLlm: process.env.HIRING_AGENT_USE_LLM === 'true',
        useEmbeddings: process.env.HIRING_AGENT_USE_EMBEDDINGS === 'true'
      });

      if (agentResult?.applicationUpdate) {
        resume.isProcessed = true;
        resume.processedAt = new Date();
        await resume.save();

        await finish(applicationId, {
          ...agentResult.applicationUpdate,
          isAiProcessed: true,
          aiProcessedAt: new Date()
        });
        logger.info(`Hiring Agent analysis complete for application ${applicationId}`);
        return;
      }
    } catch (agentError) {
      if (process.env.VERCEL) throw agentError;
      logger.warn(`Hiring Agent unavailable; falling back to existing AI processing: ${agentError.message}`);
    }

    if (process.env.VERCEL) {
      throw new Error('Hiring Agent returned no score; using local scoring.');
    }

    const embeddings = [];

    try {
      for (const chunk of chunks) {
        embeddings.push(await generateEmbedding(chunk.text));
      }

      const pineconeIds = await storeEmbeddings(
        resume.candidate.toString(),
        job._id.toString(),
        chunks,
        embeddings
      );
      resume.pineconeIds = pineconeIds;
      resume.isProcessed = true;
      resume.processedAt = new Date();
      await resume.save();
    } catch (embedError) {
      const baseline = scoreResumeLocally(job, resume.rawText || '');
      await finish(applicationId, {
        ...baseline,
        isAiProcessed: true,
        aiProcessedAt: new Date(),
        processingError: embedError.message
      });
      logger.warn(`External embedding failed; retained local score ${baseline.matchScore}`);
      return;
    }

    const requirementsText = Array.isArray(job.requirements)
      ? job.requirements.join(' ')
      : (job.requirements || '');
    const jobText = `${job.title} ${job.description} ${requirementsText} ${(job.requiredSkills || []).join(' ')}`;
    const jobEmbedding = await generateEmbedding(jobText);
    const relevantChunks = await searchSimilarChunks(jobEmbedding, job._id.toString(), 8, resume.candidate.toString());
    const chunkTexts = relevantChunks.length
      ? relevantChunks.map(chunk => chunk.text)
      : chunks.slice(0, 5).map(chunk => chunk.text);

    try {
      const analysis = normalizeAiAnalysis(await analyzeResumeMatch(
        `${job.description}\n\nRequirements: ${requirementsText}`,
        job.requiredSkills || [],
        chunkTexts,
        candidateName
      ));
      await finish(applicationId, {
        ...analysis,
        isAiProcessed: true,
        aiProcessedAt: new Date(),
        processingError: null
      });
    } catch (analysisError) {
      const candidateScores = relevantChunks
        .filter(chunk => chunk.candidateId === resume.candidate.toString())
        .map(chunk => chunk.score || 0);

      if (candidateScores.length) {
        const average = candidateScores.reduce((sum, score) => sum + score, 0) / candidateScores.length;
        await finish(applicationId, {
          matchScore: Math.max(0, Math.min(100, Math.round(average * 100))),
          scoringMethod: 'vector',
          isAiProcessed: true,
          aiProcessedAt: new Date(),
          aiAnalysis: 'Vector similarity score used because AI analysis was unavailable.',
          processingError: analysisError.message
        });
      } else {
        const baseline = scoreResumeLocally(job, resume.rawText || '');
        await finish(applicationId, {
          ...baseline,
          isAiProcessed: true,
          aiProcessedAt: new Date(),
          processingError: analysisError.message
        });
      }
    }
  } catch (error) {
    logger.error(`AI processing failed for application ${applicationId}: ${error.message}`);
    const baseline = scoreResumeLocally(job, resume.rawText || '');
    await finish(applicationId, {
      ...baseline,
      isAiProcessed: true,
      aiProcessedAt: new Date(),
      processingError: error.message
    }).catch(async () => {
      await Application.updateOne({ _id: applicationId, processingRunId: runId }, { $set: { processingStatus: 'failed', processingFinishedAt: new Date() } }).catch(() => {});
    });
  }
};
exports.processAIAnalysis = processAIAnalysis;

exports.getJobApplications = async (req, res, next) => {
  try {
    const job = await Job.findOne({ jobId: req.params.jobId, recruiter: req.user._id });
    if (!job) return res.status(404).json({ error: 'Job not found.' });

    const applications = await Application.find({ job: job._id })
      .populate('candidate', 'fullName email phone')
      .populate('resume', 'originalFileName pineconeIds isProcessed processedAt')
      .sort({ matchScore: -1 });

    const responseApplications = applications.map(application => {
      const item = application.toObject();
      item.analysisStatus = analysisStatus(item);
      item.resumeUrl = item.resume ? `/api/applications/${item._id}/resume` : null;
      return item;
    });
    const scoreReady = item => ['completed', 'fallback'].includes(item.analysisStatus);
    responseApplications.sort((a, b) => Number(scoreReady(b)) - Number(scoreReady(a)) || (b.matchScore || 0) - (a.matchScore || 0));
    res.json({ applications: responseApplications, job });
  } catch (error) { next(error); }
};

exports.downloadResume = async (req, res, next) => {
  try {
    const application = await Application.findById(req.params.id).populate('job resume');
    if (!application) return res.status(404).json({ error: 'Application not found.' });
    if (application.job.recruiter.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Not authorized.' });
    }
    if (application.resume?.storageId) {
      return resumeStorage.download(application.resume.storageId, application.resume.originalFileName, res, next);
    }
    if (!application.resume?.filePath || !fs.existsSync(application.resume.filePath)) {
      return res.status(404).json({ error: 'Resume file not found.' });
    }
    res.download(
      application.resume.filePath,
      path.basename(application.resume.originalFileName || 'resume.pdf')
    );
  } catch (error) { next(error); }
};

exports.updateApplicationStatus = async (req, res, next) => {
  try {
    const allowedStatuses = ['applied', 'reviewing', 'shortlisted', 'interviewed', 'offered', 'rejected'];
    const { status, recruiterNotes } = req.body;
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid application status.' });
    }

    const application = await Application.findById(req.params.id)
      .populate('job')
      .populate('candidate', 'fullName email');
    if (!application) return res.status(404).json({ error: 'Application not found.' });
    if (application.job.recruiter.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Not authorized.' });
    }

    const previousStatus = application.status;
    application.status = status;
    if (typeof recruiterNotes === 'string') application.recruiterNotes = recruiterNotes;

    if (status === 'shortlisted' && previousStatus !== 'shortlisted') {
      await Job.findByIdAndUpdate(application.job._id, { $inc: { shortlisted: 1 } });
    } else if (previousStatus === 'shortlisted' && status !== 'shortlisted') {
      await Job.findByIdAndUpdate(application.job._id, { $inc: { shortlisted: -1 } });
    }
    if (status === 'rejected' && previousStatus !== 'rejected') {
      await Job.findByIdAndUpdate(application.job._id, { $inc: { rejected: 1 } });
    } else if (previousStatus === 'rejected' && status !== 'rejected') {
      await Job.findByIdAndUpdate(application.job._id, { $inc: { rejected: -1 } });
    }

    await application.save();

    let notification = null;
    const shouldNotify = ['shortlisted', 'rejected'].includes(status)
      && status !== previousStatus;
    const alreadySent = application.notifications?.some(item =>
      item.status === status && item.sent
    );

    if (shouldNotify && !alreadySent) {
      notification = await sendApplicationStatusEmail({
        to: application.candidate.email,
        status,
        candidateName: application.candidate.fullName,
        jobTitle: application.job.title,
        company: application.job.company
      });
      const notificationRecord = {
        status,
        recipient: application.candidate.email,
        sent: Boolean(notification.sent),
        skipped: Boolean(notification.skipped),
        messageId: notification.messageId,
        error: notification.error,
        attemptedAt: new Date()
      };
      await Application.updateOne(
        { _id: application._id },
        { $push: { notifications: notificationRecord } }
      );
      application.notifications.push(notificationRecord);
    } else if (shouldNotify && alreadySent) {
      notification = {
        sent: false,
        skipped: true,
        duplicate: true,
        error: `A ${status} email was already sent to this candidate.`
      };
    }
    res.json({
      message: 'Status updated.',
      application,
      notification
    });
  } catch (error) { next(error); }
};

exports.reprocessApplication = async (req, res, next) => {
  try {
    const application = await Application.findById(req.params.id).populate('job resume candidate');
    if (!application) return res.status(404).json({ error: 'Application not found.' });
    if (application.job.recruiter.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Not authorized.' });
    }

    if (!application.resume?.rawText) return res.status(400).json({ error: 'Resume text is unavailable. A new resume is required.' });
    const result = await processAIAnalysis(
      application._id,
      application.job,
      application.resume,
      application.resume.chunks || [],
      application.candidate?.fullName || application.candidate?.email || 'Candidate'
    );
    if (result?.busy) return res.status(409).json({ error: 'Analysis is already running. Please wait before retrying.' });

    const updated = await Application.findById(application._id).lean();
    res.json({ message: 'Analysis attempt finished.', analysisStatus: analysisStatus(updated) });
  } catch (error) { next(error); }
};
