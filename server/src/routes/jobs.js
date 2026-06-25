// ── ROUTES: server/src/routes/jobs.js ──
const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const jobController = require('../controllers/jobController');

// Public routes
router.get('/apply/:jobId', jobController.getJobByJobId);  // public apply link
router.get('/', jobController.getAllActiveJobs);            // browse jobs

// Recruiter only
router.post('/', authenticate, authorize('recruiter'), jobController.createJob);
router.get('/my', authenticate, authorize('recruiter'), jobController.getMyJobs);
router.get('/manage/:id', authenticate, authorize('recruiter'), jobController.getMyJob);
router.put('/:id', authenticate, authorize('recruiter'), jobController.updateJob);
router.patch('/:id/status', authenticate, authorize('recruiter'), jobController.toggleJobStatus);
router.delete('/:id', authenticate, authorize('recruiter'), jobController.deleteJob);
// Recruiter: get ranked candidate matches for a job
router.get('/:id/match', authenticate, authorize('recruiter'), jobController.matchJob);

module.exports = router;
