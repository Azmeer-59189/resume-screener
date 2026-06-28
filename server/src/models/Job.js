const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const jobSchema = new mongoose.Schema({
  jobId: {
    type: String,
    unique: true,
    default: () => `JOB-${Date.now()}-${uuidv4().slice(0, 6).toUpperCase()}`
  },
  recruiter: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true, trim: true },
  company: { type: String, required: true, trim: true },
  location: { type: String, trim: true },
  type: { type: String, enum: ['full-time', 'part-time', 'contract', 'internship'], default: 'full-time' },
  description: { type: String, required: true },
  requirements: [{ type: String, required: true }],
  requiredSkills: [{ type: String }],
  niceToHaveSkills: [{ type: String }],
  experienceLevel: { type: String, enum: ['entry', 'mid', 'senior', 'lead'], default: 'mid' },
  salary: {
    min: Number,
    max: Number,
    currency: { type: String, default: 'USD' }
  },
  status: { type: String, enum: ['active', 'paused', 'closed'], default: 'active' },
  applyLink: { type: String },
  deadline: { type: Date },
  totalApplications: { type: Number, default: 0 },
  shortlisted: { type: Number, default: 0 },
  rejected: { type: Number, default: 0 },
  aiJobProfile: { type: mongoose.Schema.Types.Mixed }
}, { timestamps: true });

// Text index for search support
jobSchema.index({
  title: 'text',
  description: 'text',
  requirements: 'text',
  requiredSkills: 'text',
  niceToHaveSkills: 'text',
  company: 'text',
  location: 'text'
});

// Generate apply link after save
jobSchema.pre('save', function() {
  if (!this.applyLink) {
    this.applyLink = `/jobs/apply/${this.jobId}`;
  }
});

module.exports = mongoose.model('Job', jobSchema);
