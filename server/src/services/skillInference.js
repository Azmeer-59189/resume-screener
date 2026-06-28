const SKILL_ALIASES = [
  {
    pattern: /\bmern(?:\s+stack)?(?:\s+developer|\s+engineer)?\b/i,
    skills: ['mongodb', 'express', 'react', 'node.js', 'javascript']
  },
  {
    pattern: /\bmean(?:\s+stack)?(?:\s+developer|\s+engineer)?\b/i,
    skills: ['mongodb', 'express', 'angular', 'node.js', 'javascript']
  },
  {
    pattern: /\bmevn(?:\s+stack)?(?:\s+developer|\s+engineer)?\b/i,
    skills: ['mongodb', 'express', 'vue', 'node.js', 'javascript']
  },
  {
    pattern: /\bml(?:\s+backend)?(?:\s+engineer|\s+developer)?\b|\bmachine learning backend(?:\s+engineer|\s+developer)?\b/i,
    skills: ['python', 'machine learning', 'api', 'fastapi', 'sql']
  },
  {
    pattern: /\bdata scientist\b/i,
    skills: ['python', 'sql', 'machine learning', 'statistics', 'data analysis']
  },
  {
    pattern: /\bdevops(?:\s+engineer)?\b/i,
    skills: ['docker', 'kubernetes', 'ci/cd', 'cloud']
  }
];

const normalizeSkill = value => String(value || '').trim().toLowerCase();

const unique = values => [...new Map(
  values
    .map(value => String(value || '').trim())
    .filter(Boolean)
    .map(value => [normalizeSkill(value), value])
).values()];

const inferSkillsFromText = text => {
  const value = String(text || '');
  const inferred = [];

  for (const alias of SKILL_ALIASES) {
    if (alias.pattern.test(value)) {
      inferred.push(...alias.skills);
    }
  }

  return unique(inferred);
};

const expandSkills = (skills = [], contextText = '') => {
  const explicitSkills = Array.isArray(skills)
    ? skills.map(skill => String(skill || '').trim()).filter(Boolean)
    : [];
  const inferredFromSkillNames = explicitSkills.flatMap(inferSkillsFromText);
  const inferredFromContext = inferSkillsFromText(contextText);

  return unique([...explicitSkills, ...inferredFromSkillNames, ...inferredFromContext]);
};

const enrichTextWithInferredSkills = text => {
  const inferred = inferSkillsFromText(text);
  if (!inferred.length) return String(text || '');
  return `${text || ''}\nInferred skills: ${inferred.join(', ')}`;
};

module.exports = {
  expandSkills,
  inferSkillsFromText,
  enrichTextWithInferredSkills
};
