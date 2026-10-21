const test = require('node:test');
const assert = require('node:assert/strict');
const { scoreResumeLocally } = require('../src/services/localScoring');
const { buildSkillEvidence } = require('../src/services/skillEvidence');
const { canonicalSkill, skillPattern } = require('../src/services/skillAliases');

test('JS and JavaScript match in both directions while preserving the job label', () => {
  for (const [required, mention] of [['JS', 'JavaScript'], ['JavaScript', 'JS'], ['TS', 'TypeScript'], ['NodeJS', 'Node.js'], ['ReactJS', 'React']]) {
    const result = scoreResumeLocally({ title: 'Developer', requiredSkills: [required] }, `Built production applications using ${mention}.`);
    assert.ok(result.matchedSkills.includes(required), `${required} should match ${mention}`);
    assert.equal(result.missingSkills.length, 0);
    assert.equal(buildSkillEvidence([required], `Worked with ${mention}.`)[0].kind, 'mention');
  }
});

test('aliases are counted once and distinct technologies stay distinct', () => {
  const result = scoreResumeLocally({ title: 'Developer', requiredSkills: ['JS', 'JavaScript'] }, 'JavaScript developer');
  assert.equal(result.scoreBreakdown.totalSkillCount, 1);
  for (const [skill, text] of [['Java', 'JavaScript'], ['C', 'C++'], ['C', 'C#'], ['React', 'ReactNative'], ['JS', 'JSON'], ['Angular', 'AngularJS']]) {
    assert.equal(skillPattern(skill).test(text), false, `${skill} must not match ${text}`);
  }
  assert.equal(canonicalSkill(' JS '), 'javascript');
});
