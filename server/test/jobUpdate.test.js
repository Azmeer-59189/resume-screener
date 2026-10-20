const test = require('node:test');
const assert = require('node:assert/strict');
const { changedScoringFields } = require('../src/controllers/jobController');

const existing = {
  title: 'Backend Engineer',
  description: 'Build hiring APIs.',
  requirements: ['Design FastAPI services'],
  requiredSkills: ['Python', 'FastAPI'],
  niceToHaveSkills: ['Docker'],
  experienceLevel: 'mid',
  location: 'Remote',
  deadline: new Date('2030-01-01')
};

test('editing non-scoring fields does not trigger a rescore', () => {
  // The edit form resubmits every field; only deadline/location actually change.
  const updates = {
    ...existing,
    requirements: [...existing.requirements],
    requiredSkills: [...existing.requiredSkills],
    niceToHaveSkills: [...existing.niceToHaveSkills],
    location: 'Lahore',
    deadline: '2031-06-01'
  };
  assert.deepEqual(changedScoringFields(existing, updates), []);
});

test('whitespace and duplicate list entries are not treated as changes', () => {
  const updates = {
    title: '  Backend Engineer ',
    requiredSkills: ['Python', ' FastAPI', 'Python']
  };
  assert.deepEqual(changedScoringFields(existing, updates), []);
});

test('reports the scoring fields that actually changed', () => {
  const updates = {
    ...existing,
    requiredSkills: ['Python', 'FastAPI', 'PostgreSQL'],
    experienceLevel: 'senior'
  };
  assert.deepEqual(changedScoringFields(existing, updates), ['requiredSkills', 'experienceLevel']);
});
