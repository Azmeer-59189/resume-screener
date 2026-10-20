// Quotations come exclusively from the original extracted resume, never model output.
const aliases = {
  'node.js': ['node.js', 'nodejs'],
  'react': ['react', 'reactjs', 'react.js'],
  'javascript': ['javascript', 'js'],
  'typescript': ['typescript', 'ts'],
  'machine learning': ['machine learning', 'ml'],
  'natural language processing': ['natural language processing', 'nlp'],
};
const escapeRegex = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

exports.buildSkillEvidence = (skills = [], resumeText = '') => {
  const text = String(resumeText);
  return [...new Set(skills)].slice(0, 100).map(skill => {
    const terms = aliases[String(skill).toLowerCase()] || [String(skill)];
    const pattern = new RegExp(`(^|[^a-z0-9])(${terms.map(escapeRegex).join('|')})(?=$|[^a-z0-9])`, 'i');
    const match = pattern.exec(text);
    if (!match) return { skill, kind: 'inferred', excerpt: '' };
    const offset = match.index + match[1].length;
    const start = Math.max(0, offset - 100);
    const end = Math.min(text.length, offset + match[2].length + 140);
    return { skill, kind: 'mention', excerpt: text.slice(start, end), start, end };
  });
};
