const express = require('express');
const router = express.Router();
const upload = require('../middleware/upload');
const { authenticate, authorize } = require('../middleware/auth');
const appController = require('../controllers/applicationController');

// PUBLIC route — no login needed
router.post('/jobs/:jobId/apply', upload.single('resume'), appController.applyToJob);

// Recruiter routes
router.get('/job/:jobId', authenticate, authorize('recruiter'), appController.getJobApplications);
router.get('/:id/resume', authenticate, authorize('recruiter'), appController.downloadResume);
router.patch('/:id/status', authenticate, authorize('recruiter'), appController.updateApplicationStatus);
// Recruiter: re-run AI processing for an application (useful for debugging)
router.post('/:id/reprocess', authenticate, authorize('recruiter'), appController.reprocessApplication);

module.exports = router;
