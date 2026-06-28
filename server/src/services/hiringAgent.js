const DEFAULT_TIMEOUT_MS = 30000;

const recommendationFor = score => {
  if (score >= 85) return 'strong_match';
  if (score >= 70) return 'good_match';
  if (score >= 50) return 'partial_match';
  return 'not_suitable';
};

const buildJobText = job => {
  const profile = job.aiJobProfile || {};
  const requirementsSource = Array.isArray(profile.requirements) && profile.requirements.length
    ? profile.requirements
    : job.requirements;
  const requiredSkillsSource = Array.isArray(profile.required_skills) && profile.required_skills.length
    ? profile.required_skills
    : job.requiredSkills;
  const niceToHaveSource = Array.isArray(profile.nice_to_have_skills) && profile.nice_to_have_skills.length
    ? profile.nice_to_have_skills
    : job.niceToHaveSkills;

  const requirements = Array.isArray(requirementsSource)
    ? requirementsSource.join('\n')
    : (requirementsSource || '');
  const requiredSkills = Array.isArray(requiredSkillsSource)
    ? requiredSkillsSource.join(', ')
    : '';
  const niceToHaveSkills = Array.isArray(niceToHaveSource)
    ? niceToHaveSource.join(', ')
    : '';

  return [
    job.title,
    profile.description || job.description,
    profile.summary && `AI job profile summary: ${profile.summary}`,
    Array.isArray(profile.responsibilities) && profile.responsibilities.length
      ? `AI-inferred responsibilities:\n${profile.responsibilities.join('\n')}`
      : '',
    requirements && `Requirements:\n${requirements}`,
    requiredSkills && `Required skills: ${requiredSkills}`,
    niceToHaveSkills && `Nice to have: ${niceToHaveSkills}`,
    job.experienceLevel && `Experience level: ${job.experienceLevel}`,
    job.location && `Location: ${job.location}`,
    job.type && `Job type: ${job.type}`
  ].filter(Boolean).join('\n\n');
};

const normalizeQuestionGroups = value => Array.isArray(value)
  ? value.map(group => ({
    candidateName: group.candidate_name || group.candidateName || 'Unknown Candidate',
    sourceFile: group.source_file || group.sourceFile || 'unknown',
    score: Number(group.score) || 0,
    questions: Array.isArray(group.questions)
      ? group.questions.map(item => ({
        question: item.question || '',
        category: item.category || 'technical',
        rationale: item.rationale || ''
      })).filter(item => item.question)
      : []
  })).filter(group => group.questions.length)
  : [];

const mapPipelineResultToApplicationUpdate = result => {
  const score = Array.isArray(result?.scores) ? result.scores[0] : null;
  if (!score) return null;

  const matchScore = Math.max(0, Math.min(100, Math.round(Number(score.score) || 0)));
  const semanticScore = Math.max(0, Math.min(100, Math.round(Number(score.semantic_score) || 0)));
  const skillScore = Math.max(0, Math.min(100, Math.round(Number(score.skill_score) || 0)));
  const matchedSkills = Array.isArray(score.matched_skills) ? score.matched_skills : [];
  const missingSkills = Array.isArray(score.missing_required_skills) ? score.missing_required_skills : [];

  return {
    matchScore,
    matchedSkills,
    missingSkills,
    recommendation: recommendationFor(matchScore),
    strengths: matchedSkills.length
      ? [`Agent matched required skills: ${matchedSkills.join(', ')}.`]
      : ['The hiring-agent pipeline parsed the resume, but no explicit required skill match was found.'],
    weaknesses: missingSkills.length
      ? [`Agent did not find explicit evidence for: ${missingSkills.join(', ')}.`]
      : ['The hiring-agent pipeline did not flag major required-skill gaps.'],
    scoreBreakdown: {
      skillScore,
      contextScore: semanticScore,
      skillWeight: 40,
      contextWeight: 60,
      matchedSkillCount: matchedSkills.length,
      totalSkillCount: matchedSkills.length + missingSkills.length,
      matchedTermCount: 0,
      totalTermCount: 0,
      matchedTerms: [],
      formula: 'Hiring-agent AI-verified required skills 75% + semantic evidence 25%'
    },
    experienceSummary: score.reasoning || `Hiring-agent match score is ${matchScore}%.`,
    aiAnalysis: score.reasoning || `Hiring-agent match score is ${matchScore}%.`,
    scoringMethod: 'agent',
    hiringAgent: {
      jdParsed: result.jd_parsed || {},
      resumesParsed: result.resumes_parsed || [],
      scores: result.scores || [],
      rawErrors: result.errors || []
    },
    biasFlags: result.bias_flags || {},
    interviewQuestions: normalizeQuestionGroups(result.interview_questions),
    processingError: Array.isArray(result.errors) && result.errors.length
      ? result.errors.join('; ')
      : null
  };
};

const runHiringAgentPipeline = async ({
  job,
  resumeText,
  sourceFile,
  useLlm = false,
  useEmbeddings = false
}) => {
  const baseUrl = (process.env.HIRING_AGENT_URL || '').replace(/\/$/, '');
  if (!baseUrl) return null;

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    Number(process.env.HIRING_AGENT_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS
  );

  try {
    const response = await fetch(`${baseUrl}/api/pipeline/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        jd_text: buildJobText(job),
        resumes_raw: [{
          source_file: sourceFile || 'resume.pdf',
          text: resumeText || ''
        }],
        use_llm: useLlm,
        use_embeddings: useEmbeddings
      })
    });

    if (!response.ok) {
      throw new Error(`Hiring Agent returned HTTP ${response.status}`);
    }

    const result = await response.json();
    return {
      raw: result,
      applicationUpdate: mapPipelineResultToApplicationUpdate(result)
    };
  } finally {
    clearTimeout(timeout);
  }
};

const enrichJobPost = async jobDraft => {
  const baseUrl = (process.env.HIRING_AGENT_URL || '').replace(/\/$/, '');
  if (!baseUrl) return null;

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    Number(process.env.HIRING_AGENT_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS
  );

  try {
    const response = await fetch(`${baseUrl}/api/jobs/enrich`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        title: jobDraft.title || '',
        description: jobDraft.description || '',
        requirements: Array.isArray(jobDraft.requirements) ? jobDraft.requirements : [],
        required_skills: Array.isArray(jobDraft.requiredSkills) ? jobDraft.requiredSkills : [],
        nice_to_have_skills: Array.isArray(jobDraft.niceToHaveSkills) ? jobDraft.niceToHaveSkills : [],
        experience_level: jobDraft.experienceLevel || 'Not specified',
        use_llm: process.env.HIRING_AGENT_ENRICH_JOBS_USE_LLM !== 'false'
      })
    });

    if (!response.ok) {
      throw new Error(`Hiring Agent enrichment returned HTTP ${response.status}`);
    }

    return response.json();
  } finally {
    clearTimeout(timeout);
  }
};

const isHiringAgentConfigured = () => Boolean((process.env.HIRING_AGENT_URL || '').trim());

module.exports = {
  buildJobText,
  enrichJobPost,
  isHiringAgentConfigured,
  mapPipelineResultToApplicationUpdate,
  runHiringAgentPipeline
};
