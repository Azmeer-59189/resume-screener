require('dotenv').config();
const mongoose = require('mongoose');
const { Application, Resume } = require('../src/models/Application');
require('../src/models/Job');

const run = async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const applications = await Application.find()
    .populate('job', 'jobId title')
    .select('job resume')
    .lean();

  let updated = 0;
  for (const application of applications) {
    if (!application.resume || !application.job) continue;
    const result = await Resume.updateOne(
      { _id: application.resume },
      {
        $set: {
          job: application.job._id,
          jobId: application.job.jobId,
          jobTitle: application.job.title
        }
      },
      { runValidators: true }
    );
    updated += result.modifiedCount;
  }

  await Resume.syncIndexes();
  console.log(`Updated ${updated} resume record(s) with readable job information.`);
  await mongoose.disconnect();
};

run().catch(async error => {
  console.error(error);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
