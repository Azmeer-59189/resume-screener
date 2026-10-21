import groups from '../../../shared/skillAliases.json' with { type: 'json' };
export const MAX_COMPARISON = 3;
export const analysisState = app => app.analysisStatus || (app.isAiProcessed ? (app.processingError ? 'fallback' : 'completed') : 'queued');
export const isScoreReady = app => ['completed', 'fallback'].includes(analysisState(app));
const normalize = value => {
  const key = String(value).trim().toLowerCase();
  return groups.find(group => group.includes(key))?.[0] || key;
};

export function toggleCandidate(ids, id) {
  if (ids.includes(id)) return ids.filter(value => value !== id);
  return ids.length < MAX_COMPARISON ? [...ids, id] : ids;
}

export function comparisonSkills(requiredSkills = [], applications = []) {
  const skills = new Map();
  for (const value of [...requiredSkills, ...applications.filter(isScoreReady).flatMap(app => [...(app.matchedSkills || []), ...(app.missingSkills || [])])]) {
    if (normalize(value)) skills.set(normalize(value), String(value).trim());
  }
  return [...skills.values()];
}

export function skillAssessment(app, skill) {
  if (!isScoreReady(app)) return 'Awaiting analysis';
  const key = normalize(skill);
  if (app.matchedSkills?.some(value => normalize(value) === key)) return 'Matched';
  if (app.missingSkills?.some(value => normalize(value) === key)) return 'Not demonstrated';
  return 'Not assessed';
}

export const matchingEvidence = (app, skill) => app.skillEvidence?.find(item => normalize(item.skill) === normalize(skill));
