require('dotenv').config();
const { MongoClient, ObjectId } = require('mongodb');

const sourceUri = process.env.MONGODB_URI;
const targetDatabase = process.env.TARGET_DATABASE || 'resume_screener_hiring_portal';

const run = async () => {
  const client = new MongoClient(sourceUri);
  await client.connect();

  const sourceDb = client.db();
  if (sourceDb.databaseName === targetDatabase) {
    throw new Error('Source and target database names must be different.');
  }

  const targetDb = client.db(targetDatabase);
  const [jobs, resumes, applications] = await Promise.all([
    sourceDb.collection('jobs').find({}).toArray(),
    sourceDb.collection('resumes').find({}).toArray(),
    sourceDb.collection('applications').find({}).toArray()
  ]);

  const referencedUserIds = new Set();
  jobs.forEach(job => job.recruiter && referencedUserIds.add(String(job.recruiter)));
  resumes.forEach(resume => resume.candidate && referencedUserIds.add(String(resume.candidate)));
  applications.forEach(application => {
    if (application.candidate) referencedUserIds.add(String(application.candidate));
  });

  const userIds = [...referencedUserIds]
    .filter(ObjectId.isValid)
    .map(id => new ObjectId(id));
  const users = userIds.length
    ? await sourceDb.collection('users').find({ _id: { $in: userIds } }).toArray()
    : [];

  const copy = async (collectionName, documents) => {
    if (!documents.length) return 0;
    const operations = documents.map(document => ({
      replaceOne: {
        filter: { _id: document._id },
        replacement: document,
        upsert: true
      }
    }));
    await targetDb.collection(collectionName).bulkWrite(operations);
    return documents.length;
  };

  const counts = {
    users: await copy('users', users),
    jobs: await copy('jobs', jobs),
    resumes: await copy('resumes', resumes),
    applications: await copy('applications', applications)
  };

  console.log(JSON.stringify({
    sourceDatabase: sourceDb.databaseName,
    targetDatabase,
    migrated: counts,
    excludedUnreferencedUsers: Math.max(
      0,
      (await sourceDb.collection('users').countDocuments()) - users.length
    )
  }, null, 2));

  await client.close();
};

run().catch(error => {
  console.error(error);
  process.exit(1);
});
