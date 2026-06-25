const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const Job = require('../models/Job');
const { Application } = require('../models/Application');

router.get('/dashboard', authenticate, authorize('recruiter'), async (req, res, next) => {
  try {
    const myJobs = await Job.find({ recruiter: req.user._id }).select('_id');
    const jobIds = myJobs.map(j => j._id);

    const [totalJobs, activeJobs, totalApplications, shortlisted, recentApplications] = await Promise.all([
      Job.countDocuments({ recruiter: req.user._id }),
      Job.countDocuments({ recruiter: req.user._id, status: 'active' }),
      Application.countDocuments({ job: { $in: jobIds } }),
      Application.countDocuments({ job: { $in: jobIds }, status: 'shortlisted' }),
      Application.find({ job: { $in: jobIds } })
        .populate('candidate', 'fullName email')
        .populate('job', 'title')
        .sort({ createdAt: -1 })
        .limit(5)
    ]);

    res.json({ totalJobs, activeJobs, totalApplications, shortlisted, recentApplications });
  } catch (error) { next(error); }
});

module.exports = router;