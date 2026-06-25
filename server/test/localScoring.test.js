const test = require('node:test');
const assert = require('node:assert/strict');
const { scoreResumeLocally } = require('../src/services/localScoring');

test('scores explicit required skills and exposes the point breakdown', () => {
  const result = scoreResumeLocally({
    title: 'AI Engineer',
    description: 'Build production AI systems',
    requirements: ['Develop machine learning services'],
    requiredSkills: ['Python', 'Machine Learning', 'NLP', 'LLM']
  }, 'AI engineer building ML and NLP services in Python with LLMs.');

  assert.ok(result.matchScore >= 90);
  assert.deepEqual(result.missingSkills, []);
  assert.equal(result.scoreBreakdown.skillScore, 100);
  assert.equal(result.scoreBreakdown.skillWeight, 75);
});

test('does not hide missing skills behind contextual keyword matches', () => {
  const result = scoreResumeLocally({
    title: 'Backend Engineer',
    description: 'Build APIs and distributed services',
    requirements: ['Production backend experience'],
    requiredSkills: ['Node.js', 'PostgreSQL', 'Docker']
  }, 'JavaScript developer who has built REST APIs.');

  assert.ok(result.matchScore < 50);
  assert.deepEqual(result.missingSkills, ['Node.js', 'PostgreSQL', 'Docker']);
  assert.ok(result.weaknesses.length > 0);
});
