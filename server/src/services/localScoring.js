const STOP_WORDS = new Set([
  'and', 'the', 'for', 'with', 'that', 'this', 'from', 'your', 'you', 'our',
  'are', 'will', 'have', 'has', 'job', 'role', 'work', 'years', 'year',
  'experience', 'required', 'requirements', 'skills', 'using', 'into', 'about'
]);

const normalize = (value = '') => value
  .toLowerCase()
  .replace(/\b(?:artificial intelligence|ai)\b/g, ' artificialintelligence ')
  .replace(/\b(?:machine learning|ml)\b/g, ' machinelearning ')
  .replace(/\b(?:natural language processing|nlp)\b/g, ' naturallanguageprocessing ')
  .replace(/\b(?:large language models?|llms?)\b/g, ' largelanguagemodel ')
  .replace(/\b(?:deep learning|dl)\b/g, ' deeplearning ')
  .replace(/c\+\+/g, 'cplusplus')
  .replace(/c#/g, 'csharp')
  .replace(/node\.js/g, 'nodejs')
  .replace(/\.net/g, 'dotnet')
  .replace(/[^a-z0-9]+/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const tokenize = (value = '') => normalize(value)
  .split(' ')
  .filter(token => token.length > 2 && !STOP_WORDS.has(token));

const recommendationFor = score => {
  if (score >= 85) return 'strong_match';
  if (score >= 70) return 'good_match';
  if (score >= 50) return 'partial_match';
  return 'not_suitable';
};

const displayTerm = term => ({
  artificialintelligence: 'artificial intelligence / AI',
  machinelearning: 'machine learning / ML',
  naturallanguageprocessing: 'natural language processing / NLP',
  largelanguagemodel: 'large language models / LLMs',
  deeplearning: 'deep learning'
}[term] || term);

exports.scoreResumeLocally = (job, resumeText) => {
  const normalizedResume = ` ${normalize(resumeText)} `;
  const requiredSkills = Array.isArray(job.requiredSkills)
    ? job.requiredSkills.map(skill => String(skill).trim()).filter(Boolean)
    : [];
  const matchedSkills = requiredSkills.filter(skill =>
    normalizedResume.includes(` ${normalize(skill)} `)
  );
  const missingSkills = requiredSkills.filter(skill => !matchedSkills.includes(skill));

  const jobText = [
    job.title,
    job.description,
    ...(Array.isArray(job.requirements) ? job.requirements : []),
    ...requiredSkills
  ].filter(Boolean).join(' ');
  const jobTokens = [...new Set(tokenize(jobText))];
  const resumeTokens = new Set(tokenize(resumeText));
  const matchedTokens = jobTokens.filter(token => resumeTokens.has(token));

  const skillCoverage = requiredSkills.length
    ? matchedSkills.length / requiredSkills.length
    : null;
  const contextCoverage = jobTokens.length
    ? matchedTokens.length / jobTokens.length
    : 0;
  const skillScore = Math.round((skillCoverage ?? 0) * 100);
  const contextScore = Math.round(contextCoverage * 100);
  const skillWeight = skillCoverage === null ? 0 : 75;
  const contextWeight = skillCoverage === null ? 100 : 25;
  const rawScore = ((skillScore * skillWeight) + (contextScore * contextWeight)) / 100;
  const matchScore = Math.max(0, Math.min(100, Math.round(rawScore)));
  const matchedTermsForDisplay = matchedTokens.slice(0, 12).map(displayTerm);

  const strengths = [];
  if (matchedSkills.length) {
    strengths.push(`Meets ${matchedSkills.length} of ${requiredSkills.length} explicitly listed skills: ${matchedSkills.join(', ')}.`);
  }
  if (matchedTermsForDisplay.length) {
    strengths.push(`Resume shows role-related evidence through: ${matchedTermsForDisplay.join(', ')}.`);
  }
  if (!strengths.length) {
    strengths.push('The resume was parsed successfully, but no explicit job-specific evidence was detected.');
  }

  const weaknesses = [];
  if (missingSkills.length) {
    weaknesses.push(`The resume does not explicitly demonstrate: ${missingSkills.join(', ')}.`);
  }
  if (contextScore < 50) {
    weaknesses.push(`Only ${matchedTokens.length} of ${jobTokens.length} important job terms were found, so role-context coverage is limited.`);
  }
  if (!weaknesses.length) {
    weaknesses.push('No major keyword-based gaps were detected; experience depth should still be verified by a recruiter.');
  }

  const formula = skillWeight
    ? `Required skills ${skillWeight}% + job-context terms ${contextWeight}%`
    : 'Job-context terms 100% because no required skills were specified';

  return {
    matchScore,
    matchedSkills,
    missingSkills,
    recommendation: recommendationFor(matchScore),
    strengths,
    weaknesses,
    scoreBreakdown: {
      skillScore,
      contextScore,
      skillWeight,
      contextWeight,
      matchedSkillCount: matchedSkills.length,
      totalSkillCount: requiredSkills.length,
      matchedTermCount: matchedTokens.length,
      totalTermCount: jobTokens.length,
      matchedTerms: matchedTermsForDisplay,
      formula
    },
    experienceSummary: `The resume explicitly matches ${matchedSkills.length} of ${requiredSkills.length} required skills and ${matchedTokens.length} of ${jobTokens.length} role-related terms.`,
    aiAnalysis: `This ${matchScore}% score is a transparent local baseline. Skill coverage contributed ${Math.round(skillScore * skillWeight / 100)} points and job-context coverage contributed ${Math.round(contextScore * contextWeight / 100)} points. Skills or experience not written explicitly in the CV are treated as unverified, not necessarily absent.`,
    scoringMethod: 'local'
  };
};

exports.normalizeAiAnalysis = analysis => {
  const matchScore = Math.max(0, Math.min(100, Number(analysis.matchScore) || 0));
  return {
    ...analysis,
    matchScore: Math.round(matchScore),
    matchedSkills: Array.isArray(analysis.matchedSkills) ? analysis.matchedSkills : [],
    missingSkills: Array.isArray(analysis.missingSkills) ? analysis.missingSkills : [],
    strengths: Array.isArray(analysis.strengths) ? analysis.strengths : [],
    weaknesses: Array.isArray(analysis.weaknesses) ? analysis.weaknesses : [],
    recommendation: recommendationFor(matchScore),
    scoringMethod: 'ai'
  };
};
