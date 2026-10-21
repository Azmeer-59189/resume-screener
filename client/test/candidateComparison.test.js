import test from 'node:test';
import assert from 'node:assert/strict';
import { toggleCandidate, comparisonSkills, skillAssessment, isScoreReady } from '../src/utils/candidateComparison.js';

test('comparison selection is capped at three and always permits removing candidates', () => {
  assert.deepEqual(toggleCandidate(['a', 'b', 'c'], 'd'), ['a', 'b', 'c']);
  assert.deepEqual(toggleCandidate(['a', 'b', 'c'], 'b'), ['a', 'c']);
  assert.deepEqual(toggleCandidate(['a', 'c'], 'd'), ['a', 'c', 'd']);
});

test('skill rows merge job requirements and assessments without case duplicates', () => {
  const skills = comparisonSkills(['Python', 'SQL'], [{ analysisStatus: 'completed', matchedSkills: ['python'], missingSkills: ['Docker'] }]);
  assert.equal(skills.length, 3);
  assert.deepEqual(skills.map(skill => skill.toLowerCase()), ['python', 'sql', 'docker']);
});

test('unassessed skills are not presented as missing skills', () => {
  const app = { analysisStatus: 'completed', matchedSkills: ['Python'], missingSkills: ['SQL'] };
  assert.equal(skillAssessment(app, 'python'), 'Matched');
  assert.equal(skillAssessment(app, 'SQL'), 'Not demonstrated');
  assert.equal(skillAssessment(app, 'Docker'), 'Not assessed');
});

test('comparison aligns equivalent job and resume skill labels', () => {
  const app = { analysisStatus: 'completed', matchedSkills: ['JavaScript'], missingSkills: [] };
  assert.equal(skillAssessment(app, 'JS'), 'Matched');
  assert.equal(comparisonSkills(['JS'], [app]).length, 1);
  assert.equal(skillAssessment(app, 'Java'), 'Not assessed');
});

test('failed or pending analyses never expose old skill assessments as current', () => {
  for (const analysisStatus of ['queued', 'processing', 'failed', 'interrupted']) {
    const app = { analysisStatus, matchScore: 99, matchedSkills: ['Python'] };
    assert.equal(isScoreReady(app), false);
    assert.equal(skillAssessment(app, 'Python'), 'Awaiting analysis');
    assert.deepEqual(comparisonSkills([], [app]), []);
  }
  assert.equal(isScoreReady({ analysisStatus: 'fallback' }), true);
  assert.equal(isScoreReady({ isAiProcessed: true }), true);
});
