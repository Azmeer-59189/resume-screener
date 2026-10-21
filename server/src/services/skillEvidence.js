// Quotations come exclusively from the original extracted resume, never model output.
const { skillPattern } = require('./skillAliases');

exports.buildSkillEvidence = (skills = [], resumeText = '') => {
  const text = String(resumeText);
  return [...new Set(skills)].slice(0, 100).map(skill => {
    const pattern = skillPattern(skill);
    const match = pattern.exec(text);
    if (!match) return { skill, kind: 'inferred', excerpt: '' };
    const offset = match.index + match[1].length;
    const start = Math.max(0, offset - 100);
    const end = Math.min(text.length, offset + match[2].length + 140);
    return { skill, kind: 'mention', excerpt: text.slice(start, end), start, end };
  });
};
