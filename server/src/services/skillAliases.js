const groups = require('../../../shared/skillAliases.json');
const escapeRegex = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const canonicalSkill = skill => {
  const key = String(skill || '').trim().toLowerCase();
  return groups.find(group => group.includes(key))?.[0] || key;
};
const skillTerms = skill => groups.find(group => group.includes(canonicalSkill(skill))) || [String(skill).trim()];
const skillPattern = skill => new RegExp(`(^|[^a-z0-9+#])(${skillTerms(skill).map(escapeRegex).sort((a, b) => b.length - a.length).join('|')})(?=$|[^a-z0-9+#])`, 'i');
module.exports = { canonicalSkill, skillTerms, skillPattern };
