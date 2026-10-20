const test = require('node:test');
const assert = require('node:assert/strict');
const {
  buildJobText,
  mapPipelineResultToApplicationUpdate
} = require('../src/services/hiringAgent');

test('builds a pipeline job text from the existing Job shape', () => {
  const text = buildJobText({
    title: 'Backend Engineer',
    description: 'Build hiring APIs.',
    requirements: ['Design FastAPI services'],
    requiredSkills: ['Python', 'FastAPI'],
    niceToHaveSkills: ['Docker'],
    experienceLevel: 'mid',
    location: 'Remote',
    type: 'full-time'
  });

  assert.match(text, /Backend Engineer/);
  assert.match(text, /Required skills: Python, FastAPI/);
  assert.match(text, /Nice to have: Docker/);
});

test('prefers AI job profile skills over manual required skills', () => {
  const text = buildJobText({
    title: 'MERN Stack Developer',
    description: 'Manual draft',
    requirements: ['Manual requirement'],
    requiredSkills: ['Wrong Manual Skill'],
    aiJobProfile: {
      description: 'AI enriched MERN role.',
      requirements: ['Build MERN applications'],
      required_skills: ['MongoDB', 'Express', 'React', 'Node.js'],
      nice_to_have_skills: ['Docker'],
      responsibilities: ['Build full-stack features'],
      summary: 'Full-stack JavaScript role.'
    }
  });

  assert.match(text, /Required skills: MongoDB, Express, React, Node\.js/);
  assert.doesNotMatch(text, /Wrong Manual Skill/);
});

test('scores against the recruiter fields when the job preserves manual input', () => {
  const text = buildJobText({
    title: 'MERN Stack Developer',
    description: 'Recruiter-written description',
    requirements: ['Recruiter requirement'],
    requiredSkills: ['GraphQL'],
    niceToHaveSkills: [],
    aiJobProfile: {
      profileMode: 'preserve_manual',
      description: 'AI enriched MERN role.',
      required_skills: ['MongoDB', 'Express'],
      nice_to_have_skills: ['Docker']
    }
  });

  assert.match(text, /Recruiter-written description/);
  assert.match(text, /Required skills: GraphQL/);
  assert.doesNotMatch(text, /AI enriched MERN role/);
  // Empty manual list still falls back to the AI profile.
  assert.match(text, /Nice to have: Docker/);
});

test('uses the weights reported by the agent in the score breakdown', () => {
  const update = mapPipelineResultToApplicationUpdate({
    scores: [{ score: 60, semantic_score: 70, skill_score: 45, skill_weight: 40, semantic_weight: 60 }]
  });

  assert.equal(update.scoreBreakdown.skillWeight, 40);
  assert.equal(update.scoreBreakdown.contextWeight, 60);
  assert.match(update.scoreBreakdown.formula, /required skills 40% \+ semantic evidence 60%/);
});

test('maps hiring-agent pipeline output into Application update fields', () => {
  const update = mapPipelineResultToApplicationUpdate({
    jd_parsed: { title: 'Backend Engineer' },
    resumes_parsed: [{ candidate_name: 'Ayesha Khan' }],
    scores: [{
      candidate_name: 'Ayesha Khan',
      source_file: 'ayesha.pdf',
      score: 88,
      semantic_score: 90,
      skill_score: 85,
      matched_skills: ['python', 'fastapi'],
      missing_required_skills: ['sqlite'],
      reasoning: 'Strong semantic match.'
    }],
    bias_flags: { has_bias_risk: false, flags: [], summary: 'No obvious bias risks.' },
    interview_questions: [{
      candidate_name: 'Ayesha Khan',
      source_file: 'ayesha.pdf',
      score: 88,
      questions: [{ question: 'How have you used FastAPI?', category: 'technical', rationale: 'Checks depth.' }]
    }],
    errors: []
  });

  assert.equal(update.matchScore, 88);
  assert.equal(update.scoringMethod, 'agent');
  assert.deepEqual(update.matchedSkills, ['python', 'fastapi']);
  assert.deepEqual(update.missingSkills, ['sqlite']);
  assert.equal(update.scoreBreakdown.contextScore, 90);
  // No weights reported (older agent) -> the AI path's 75/25 split.
  assert.equal(update.scoreBreakdown.skillWeight, 75);
  assert.equal(update.scoreBreakdown.contextWeight, 25);
  assert.equal(update.biasFlags.has_bias_risk, false);
  assert.equal(update.interviewQuestions[0].questions[0].question, 'How have you used FastAPI?');
});
