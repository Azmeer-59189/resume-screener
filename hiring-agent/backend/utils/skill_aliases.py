"""Equivalent skill names shared with the Node scorer and recruiter comparison."""
import json
import re
from pathlib import Path

GROUPS = json.loads((Path(__file__).resolve().parents[3] / 'shared' / 'skillAliases.json').read_text(encoding='utf-8'))
LOOKUP = {alias: group[0] for group in GROUPS for alias in group}


def canonical_skill(value: str) -> str:
    key = value.strip().lower()
    return LOOKUP.get(key, key)


def skill_present(skill: str, text: str) -> bool:
    key = canonical_skill(skill)
    terms = next((group for group in GROUPS if group[0] == key), [key])
    pattern = r'(?<![a-z0-9+#])(?:' + '|'.join(re.escape(term) for term in sorted(terms, key=len, reverse=True)) + r')(?![a-z0-9+#])'
    return bool(re.search(pattern, text, re.I))
