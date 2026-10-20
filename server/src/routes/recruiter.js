const { analysisStatus } = require('../services/analysisState');
const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const Job = require('../models/Job');
const { Application } = require('../models/Application');

const TREND_DAYS = 30;
const TOP_SKILL_GAPS = 8;

// Queued, active, and failed analyses must not influence score-based aggregates.
const scoredFilter = {
  matchScore: { $ne: null },
  $nor: [{ processingStatus: { $in: ['queued', 'processing', 'failed'] } }, { scoringMethod: 'agent', isAiProcessed: false }]
};

router.get('/dashboard', authenticate, authorize('recruiter'), async (req, res, next) => {
  try {
    const myJobs = await Job.find({ recruiter: req.user._id })
      .select('_id jobId title status createdAt')
      .sort({ createdAt: -1 })
      .lean();
    const jobIds = myJobs.map(j => j._id);
    const inMyJobs = { job: { $in: jobIds } };

    const trendStart = new Date();
    trendStart.setUTCHours(0, 0, 0, 0);
    trendStart.setUTCDate(trendStart.getUTCDate() - (TREND_DAYS - 1));

    const [
      totalApplications,
      shortlisted,
      recentApplications,
      byDay,
      byStatus,
      scoreStats,
      skillGaps,
      byJob
    ] = await Promise.all([
      Application.countDocuments(inMyJobs),
      Application.countDocuments({ ...inMyJobs, status: 'shortlisted' }),
      Application.find(inMyJobs)
        .populate('candidate', 'fullName email')
        .populate('job', 'title jobId')
        .sort({ createdAt: -1 })
        .limit(5),
      Application.aggregate([
        { $match: { ...inMyJobs, createdAt: { $gte: trendStart } } },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } }
      ]),
      Application.aggregate([
        { $match: inMyJobs },
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]),
      Application.aggregate([
        { $match: { ...inMyJobs, ...scoredFilter } },
        {
          $group: {
            _id: null,
            average: { $avg: '$matchScore' },
            scored: { $sum: 1 },
            strong: { $sum: { $cond: [{ $gte: ['$matchScore', 85] }, 1, 0] } },
            good: { $sum: { $cond: [{ $and: [{ $gte: ['$matchScore', 70] }, { $lt: ['$matchScore', 85] }] }, 1, 0] } },
            partial: { $sum: { $cond: [{ $and: [{ $gte: ['$matchScore', 50] }, { $lt: ['$matchScore', 70] }] }, 1, 0] } },
            notSuitable: { $sum: { $cond: [{ $lt: ['$matchScore', 50] }, 1, 0] } }
          }
        }
      ]),
      Application.aggregate([
        { $match: { ...inMyJobs, ...scoredFilter } },
        { $unwind: '$missingSkills' },
        { $group: { _id: { $toLower: { $trim: { input: '$missingSkills' } } }, skill: { $first: '$missingSkills' }, count: { $sum: 1 } } },
        { $sort: { count: -1, _id: 1 } },
        { $limit: TOP_SKILL_GAPS }
      ]),
      Application.aggregate([
        { $match: inMyJobs },
        {
          $group: {
            _id: '$job',
            applications: { $sum: 1 },
            shortlisted: { $sum: { $cond: [{ $eq: ['$status', 'shortlisted'] }, 1, 0] } },
            averageScore: {
              $avg: {
                $cond: [
                  { $and: [{ $not: [{ $in: ['$processingStatus', ['queued', 'processing', 'failed']] }] }, { $ne: ['$matchScore', null] }, { $not: { $and: [{ $eq: ['$scoringMethod', 'agent'] }, { $eq: ['$isAiProcessed', false] }] } }] },
                  '$matchScore',
                  null
                ]
              }
            },
            topScore: { $max: { $cond: [{ $in: ['$processingStatus', ['queued', 'processing', 'failed']] }, null, '$matchScore'] } }
          }
        }
      ])
    ]);

    const stats = scoreStats[0] || {};
    const jobStats = new Map(byJob.map(item => [item._id.toString(), item]));

    res.json({
      totalJobs: myJobs.length,
      activeJobs: myJobs.filter(job => job.status === 'active').length,
      totalApplications,
      shortlisted,
      recentApplications: recentApplications.map(application => { const item = application.toObject(); return { ...item, analysisStatus: analysisStatus(item) }; }),
      analytics: {
        trendDays: TREND_DAYS,
        trendStart: trendStart.toISOString(),
        applicationsByDay: byDay.map(item => ({ date: item._id, count: item.count })),
        statusCounts: Object.fromEntries(byStatus.map(item => [item._id, item.count])),
        averageScore: stats.average == null ? null : Math.round(stats.average),
        scoredApplications: stats.scored || 0,
        scoreTiers: {
          strong_match: stats.strong || 0,
          good_match: stats.good || 0,
          partial_match: stats.partial || 0,
          not_suitable: stats.notSuitable || 0
        },
        topSkillGaps: skillGaps.map(item => ({ skill: item.skill, count: item.count })),
        jobs: myJobs.map(job => {
          const summary = jobStats.get(job._id.toString()) || {};
          return {
            _id: job._id,
            jobId: job.jobId,
            title: job.title,
            status: job.status,
            createdAt: job.createdAt,
            applications: summary.applications || 0,
            shortlisted: summary.shortlisted || 0,
            averageScore: summary.averageScore == null ? null : Math.round(summary.averageScore),
            topScore: summary.topScore ?? null
          };
        })
      }
    });
  } catch (error) { next(error); }
});

module.exports = router;
