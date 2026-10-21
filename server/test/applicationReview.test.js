const test = require('node:test');
const assert = require('node:assert/strict');
const { Application } = require('../src/models/Application');
const controller = require('../src/controllers/applicationController');
const query = value => ({ populate() { return this; }, then(resolve, reject) { return Promise.resolve(value).then(resolve, reject); } });
const response = () => ({ code: 200, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } });
const req = body => ({ params: { id: 'app' }, user: { _id: 'owner' }, body });
const application = owner => ({
  _id: 'app', status: 'applied', notifications: [], job: { _id: 'job', recruiter: owner },
  toObject() { return { job: this.job, isAiProcessed: true, resume: { originalFileName: 'cv.pdf', rawText: 'x'.repeat(100010) } }; }
});

test('candidate detail is owner-only and limits the extracted text preview', async () => {
  const original = Application.findById;
  try {
    Application.findById = () => query(application('other'));
    const denied = response();
    await controller.getApplication(req({}), denied, error => { throw error; });
    assert.equal(denied.code, 403);
    assert.equal(denied.body.application, undefined);
    Application.findById = () => query(application('owner'));
    const allowed = response();
    await controller.getApplication(req({}), allowed, error => { throw error; });
    assert.equal(allowed.body.application.resume.rawText.length, 100000);
    assert.equal(allowed.body.application.resume.textTruncated, true);
    assert.equal(allowed.body.application.analysisStatus, 'completed');
  } finally { Application.findById = original; }
});

test('saving notes checks ownership and updates only notes', async () => {
  const originalFind = Application.findById;
  const originalUpdate = Application.updateOne;
  const writes = [];
  Application.updateOne = async (filter, update) => writes.push(update);
  try {
    Application.findById = () => query(application('other'));
    const denied = response();
    await controller.updateNotes(req({ recruiterNotes: 'Private observation' }), denied, error => { throw error; });
    assert.equal(denied.code, 403);
    assert.equal(writes.length, 0);
    Application.findById = () => query(application('owner'));
    await controller.updateNotes(req({ recruiterNotes: 'Private observation' }), response(), error => { throw error; });
    assert.deepEqual(writes, [{ $set: { recruiterNotes: 'Private observation' } }]);
  } finally { Application.findById = originalFind; Application.updateOne = originalUpdate; }
});

test('stage changes append history atomically and reject stale board moves', async () => {
  const originalFind = Application.findById;
  const originalUpdate = Application.findOneAndUpdate;
  const writes = [];
  Application.findById = () => query(application('owner'));
  Application.findOneAndUpdate = async (filter, update) => { writes.push({ filter, update }); return { statusHistory: [update.$push.statusHistory] }; };
  try {
    const stale = response();
    await controller.updateApplicationStatus(req({ status: 'reviewing', expectedStatus: 'shortlisted' }), stale, error => { throw error; });
    assert.equal(stale.code, 409);
    assert.equal(writes.length, 0);
    const moved = response();
    await controller.updateApplicationStatus(req({ status: 'reviewing', expectedStatus: 'applied' }), moved, error => { throw error; });
    assert.equal(moved.code, 200);
    assert.equal(writes[0].filter.status, 'applied');
    assert.equal(writes[0].update.$push.statusHistory.toStatus, 'reviewing');
    assert.equal(writes[0].update.$push.statusHistory.changedBy, 'owner');
  } finally { Application.findById = originalFind; Application.findOneAndUpdate = originalUpdate; }
});
