const test = require('node:test');
const assert = require('node:assert/strict');
const { analysisStatus, ANALYSIS_LEASE_MS } = require('../src/services/analysisState');
const { buildSkillEvidence } = require('../src/services/skillEvidence');

test('legacy results stay completed and fallback results are distinguishable', () => {
  assert.equal(analysisStatus({ isAiProcessed: true }), 'completed');
  assert.equal(analysisStatus({ processingStatus: 'queued', isAiProcessed: true, processingError: 'Timeout' }), 'fallback');
});

test('abandoned runs become retryable without turning into completed zero scores', () => {
  const now = Date.now();
  assert.equal(analysisStatus({ processingStatus: 'processing', processingStartedAt: new Date(now - ANALYSIS_LEASE_MS - 1) }, now), 'interrupted');
  assert.equal(analysisStatus({ processingStatus: 'processing', processingStartedAt: new Date(now - 1000) }, now), 'processing');
  assert.equal(analysisStatus({ processingStatus: 'queued', createdAt: new Date(now - ANALYSIS_LEASE_MS - 1) }, now), 'interrupted');
});

test('quotations are exact substrings of the original resume and use skill boundaries', () => {
  const text = 'Built a JavaScript API with NodeJS and C++. React dashboard delivered.';
  const evidence = buildSkillEvidence(['Java', 'Node.js', 'C++', 'React', 'Python'], text);
  assert.equal(evidence[0].kind, 'inferred');
  for (const item of evidence.slice(1, 4)) {
    assert.equal(item.kind, 'mention');
    assert.equal(item.excerpt, text.slice(item.start, item.end));
  }
  assert.equal(evidence[4].excerpt, '');
});

test('inferred stack skills do not produce fabricated resume quotations', () => {
  const evidence = buildSkillEvidence(['MongoDB', 'React'], 'Worked as a MERN stack developer.');
  assert.ok(evidence.every(item => item.kind === 'inferred' && item.excerpt === ''));
});
