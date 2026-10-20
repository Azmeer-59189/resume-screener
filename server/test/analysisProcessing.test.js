const test = require('node:test');
const assert = require('node:assert/strict');
const agent = require('../src/services/hiringAgent');
let agentResult;
let agentFailure;
agent.runHiringAgentPipeline = async () => {
  if (agentFailure) throw agentFailure;
  return agentResult;
};
const { Application } = require('../src/models/Application');
const { processAIAnalysis } = require('../src/controllers/applicationController');

test('analysis claims a run, stores source evidence, and guards the final write with its run ID', async () => {
  const original = Application.findOneAndUpdate;
  const writes = [];
  Application.findOneAndUpdate = async (filter, update) => { writes.push({ filter, update }); return {}; };
  agentFailure = null;
  agentResult = { applicationUpdate: { matchScore: 80, matchedSkills: ['Python'], scoringMethod: 'agent', processingError: null } };
  try {
    await processAIAnalysis('application', {}, { rawText: 'Built APIs in Python.', save: async () => {} }, [], 'Candidate');
    assert.equal(writes[0].update.$set.processingStatus, 'processing');
    assert.equal(writes[0].update.$inc.processingAttempts, 1);
    assert.equal(writes[1].filter.processingRunId, writes[0].update.$set.processingRunId);
    assert.equal(writes[1].update.$set.processingStatus, 'completed');
    assert.equal(writes[1].update.$set.skillEvidence[0].excerpt, 'Built APIs in Python.');
  } finally { Application.findOneAndUpdate = original; }
});

test('an active analysis cannot be started twice', async () => {
  const original = Application.findOneAndUpdate;
  Application.findOneAndUpdate = async () => null;
  try {
    assert.deepEqual(await processAIAnalysis('application', {}, {}, [], 'Candidate'), { busy: true });
  } finally { Application.findOneAndUpdate = original; }
});

test('provider failure retains a real local score and records a retryable fallback', async () => {
  const original = Application.findOneAndUpdate;
  const previousVercel = process.env.VERCEL;
  const writes = [];
  process.env.VERCEL = '1';
  Application.findOneAndUpdate = async (filter, update) => { writes.push({ filter, update }); return {}; };
  agentFailure = new Error('Provider timeout');
  try {
    await processAIAnalysis('application', { title: 'Python developer', description: 'Python APIs', requiredSkills: ['Python'] }, { rawText: 'Built Python APIs.' }, [], 'Candidate');
    const result = writes[1].update.$set;
    assert.equal(result.processingStatus, 'fallback');
    assert.equal(result.scoringMethod, 'local');
    assert.ok(result.matchScore > 0);
    assert.equal(result.processingError, 'Provider timeout');
  } finally {
    Application.findOneAndUpdate = original;
    agentFailure = null;
    if (previousVercel === undefined) delete process.env.VERCEL;
    else process.env.VERCEL = previousVercel;
  }
});
