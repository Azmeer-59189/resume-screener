from __future__ import annotations

import re


SKILL_ALIASES: list[tuple[re.Pattern[str], list[str]]] = [
    (
        re.compile(r"\bmern(?:\s+stack)?(?:\s+developer|\s+engineer)?\b", re.I),
        ["mongodb", "express", "react", "node.js", "javascript"],
    ),
    (
        re.compile(r"\bmean(?:\s+stack)?(?:\s+developer|\s+engineer)?\b", re.I),
        ["mongodb", "express", "angular", "node.js", "javascript"],
    ),
    (
        re.compile(r"\bmevn(?:\s+stack)?(?:\s+developer|\s+engineer)?\b", re.I),
        ["mongodb", "express", "vue", "node.js", "javascript"],
    ),
    (
        re.compile(
            r"\bml(?:\s+backend)?(?:\s+engineer|\s+developer)?\b"
            r"|\bmachine learning backend(?:\s+engineer|\s+developer)?\b",
            re.I,
        ),
        ["python", "machine learning", "api", "fastapi", "sql"],
    ),
    (
        re.compile(r"\bdata scientist\b", re.I),
        ["python", "sql", "machine learning", "statistics", "data analysis"],
    ),
    (
        re.compile(r"\bdevops(?:\s+engineer)?\b", re.I),
        ["docker", "kubernetes", "ci/cd", "cloud"],
    ),
]


def _unique(values: list[str]) -> list[str]:
    seen: set[str] = set()
    unique_values: list[str] = []

    for value in values:
        cleaned = value.strip()
        key = cleaned.lower()
        if cleaned and key not in seen:
            seen.add(key)
            unique_values.append(cleaned)

    return unique_values


def infer_skills_from_text(text: str) -> list[str]:
    inferred: list[str] = []
    for pattern, skills in SKILL_ALIASES:
        if pattern.search(text or ""):
            inferred.extend(skills)
    return _unique(inferred)


def expand_skills(skills: list[str], context_text: str = "") -> list[str]:
    explicit = [skill.strip() for skill in skills if skill.strip()]
    inferred_from_skills: list[str] = []
    for skill in explicit:
        inferred_from_skills.extend(infer_skills_from_text(skill))

    return _unique([
        *explicit,
        *inferred_from_skills,
        *infer_skills_from_text(context_text),
    ])
