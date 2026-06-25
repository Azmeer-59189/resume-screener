const mongoose = require('mongoose');

// Resume model — stores extracted text and chunks
const resumeSchema = new mongoose.Schema({
  candidate: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  job: { type: mongoose.Schema.Types.ObjectId, ref: 'Job', required: true },
  jobId: { type: String, required: true, index: true },
  jobTitle: { type: String, required: true },
  originalFileName: { type: String },
  filePath: { type: String },
  rawText: { type: String },
  chunks: [{ text: String, index: Number }],
  pineconeIds: [{ type: String }],  // vector IDs stored in Pinecone
  isProcessed: { type: Boolean, default: false },
  processedAt: { type: Date }
}, { timestamps: true });

// Application model — one per candidate per job
const applicationSchema = new mongoose.Schema({
  job: { type: mongoose.Schema.Types.ObjectId, ref: 'Job', required: true },
  candidate: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  resume: { type: mongoose.Schema.Types.ObjectId, ref: 'Resume' },

  // AI Analysis results
  matchScore: { type: Number, min: 0, max: 100 },
  matchedSkills: [{ type: String }],
  missingSkills: [{ type: String }],
  experienceSummary: { type: String },
  aiAnalysis: { type: String },
  recommendation: { type: String, enum: ['strong_match', 'good_match', 'partial_match', 'not_suitable'] },
  strengths: [{ type: String }],
  weaknesses: [{ type: String }],
  scoreBreakdown: {
    skillScore: { type: Number, min: 0, max: 100 },
    contextScore: { type: Number, min: 0, max: 100 },
    skillWeight: { type: Number, min: 0, max: 100 },
    contextWeight: { type: Number, min: 0, max: 100 },
    matchedSkillCount: { type: Number, min: 0 },
    totalSkillCount: { type: Number, min: 0 },
    matchedTermCount: { type: Number, min: 0 },
    totalTermCount: { type: Number, min: 0 },
    matchedTerms: [{ type: String }],
    formula: { type: String }
  },
  scoringMethod: {
    type: String,
    enum: ['local', 'ai', 'vector'],
    default: 'local'
  },
  processingError: { type: String },

  // Recruiter actions
  status: {
    type: String,
    enum: ['applied', 'reviewing', 'shortlisted', 'interviewed', 'offered', 'rejected'],
    default: 'applied'
  },
  recruiterNotes: { type: String },
  notifications: [{
    status: { type: String, enum: ['shortlisted', 'rejected'] },
    recipient: { type: String },
    sent: { type: Boolean, default: false },
    skipped: { type: Boolean, default: false },
    messageId: { type: String },
    error: { type: String },
    attemptedAt: { type: Date, default: Date.now }
  }],
  isAiProcessed: { type: Boolean, default: false },
  aiProcessedAt: { type: Date },

  // Cover letter (optional)
  coverLetter: { type: String }
}, { timestamps: true });

// Prevent duplicate applications
applicationSchema.index({ job: 1, candidate: 1 }, { unique: true });

const Resume = mongoose.model('Resume', resumeSchema);
const Application = mongoose.model('Application', applicationSchema);

module.exports = { Resume, Application };
