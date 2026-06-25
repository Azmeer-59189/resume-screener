require('dotenv').config();
const mongoose = require('mongoose');
const { Application } = require('../src/models/Application');
require('../src/models/Job');
const { scoreResumeLocally } = require('../src/services/localScoring');

const run = async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const applications = await Application.find().populate('job resume');
  let updated = 0;

  for (const application of applications) {
    if (!application.job || !application.resume?.rawText) continue;
    const baseline = scoreResumeLocally(application.job, application.resume.rawText);
    await Application.findByIdAndUpdate(application._id, {
      ...baseline,
      isAiProcessed: true,
      aiProcessedAt: new Date()
    });
    updated += 1;
  }

  console.log(`Recalculated ${updated} application score(s).`);
  await mongoose.disconnect();
};

run().catch(async error => {
  console.error(error);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
