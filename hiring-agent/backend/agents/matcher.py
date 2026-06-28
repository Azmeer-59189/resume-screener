from typing import Any

import json

import requests
from pydantic import BaseModel, Field, ValidationError

from backend.utils.embeddings import semantic_similarity
from backend.utils.json_tools import extract_json_object
from backend.utils.llm import call_configured_llm


class CandidateScore(BaseModel):
    """The structured score we produce for each candidate."""

    candidate_name: str = Field(default="Unknown Candidate")
    source_file: str = Field(default="unknown")
    score: int = Field(default=0, ge=0, le=100)
    semantic_score: int = Field(default=0, ge=0, le=100)
    skill_score: int = Field(default=0, ge=0, le=100)
    matched_skills: list[str] = Field(default_factory=list)
    missing_required_skills: list[str] = Field(default_factory=list)
    reasoning: str = Field(default="")


class AiSkillEvidence(BaseModel):
    """LLM-verified evidence, without giving the model control of the final score."""

    matched_skills: list[str] = Field(default_factory=list)
    missing_required_skills: list[str] = Field(default_factory=list)
    reasoning: str = Field(default="")


def _normalize_skill(skill: str) -> str:
    """Normalize skills so Python and python compare as the same skill."""
    return skill.strip().lower()


def _looks_like_skill(value: str) -> bool:
    """Avoid treating long requirement sentences as skill names."""
    return len(value.split()) <= 3


def _resume_to_text(resume: dict[str, Any]) -> str:
    """Join important resume fields into one comparison text."""
    parts = [
        resume.get("candidate_name", ""),
        " ".join(resume.get("skills", [])),
        resume.get("years_experience", ""),
        " ".join(resume.get("work_experience", [])),
        " ".join(resume.get("education", [])),
        " ".join(resume.get("projects", [])),
        resume.get("summary", ""),
    ]
    return " ".join(part for part in parts if part)


def _jd_to_text(jd: dict[str, Any]) -> str:
    """Join important JD fields into one comparison text."""
    parts = [
        jd.get("title", ""),
        " ".join(jd.get("required_skills", [])),
        " ".join(jd.get("nice_to_have_skills", [])),
        jd.get("experience_level", ""),
        " ".join(jd.get("responsibilities", [])),
        " ".join(jd.get("must_have_requirements", [])),
        " ".join(jd.get("nice_to_have_requirements", [])),
        jd.get("summary", ""),
    ]
    return " ".join(part for part in parts if part)


def calculate_skill_match(
    jd: dict[str, Any],
    resume: dict[str, Any],
) -> tuple[int, list[str], list[str]]:
    """Compare required JD skills against resume skills."""
    required_skills = {
        _normalize_skill(skill)
        for skill in jd.get("required_skills", [])
        if skill.strip()
    }
    must_have_skills = {
        _normalize_skill(skill)
        for skill in jd.get("must_have_requirements", [])
        if skill.strip() and _looks_like_skill(skill)
    }
    resume_skills = {
        _normalize_skill(skill)
        for skill in resume.get("skills", [])
        if skill.strip()
    }

    target_skills = required_skills | must_have_skills
    if not target_skills:
        return 50, [], []

    matched = sorted(target_skills & resume_skills)
    missing = sorted(target_skills - resume_skills)
    score = round((len(matched) / len(target_skills)) * 100)

    return score, matched, missing


def score_candidate(
    jd: dict[str, Any],
    resume: dict[str, Any],
    use_embeddings: bool = True,
) -> CandidateScore:
    """Score one candidate against one job description.

    The final score blends meaning-based similarity and explicit skill overlap.
    """
    jd_text = _jd_to_text(jd)
    resume_text = _resume_to_text(resume)

    similarity = semantic_similarity(jd_text, resume_text, use_model=use_embeddings)
    semantic_score = round(max(0.0, min(similarity, 1.0)) * 100)
    skill_score, matched_skills, missing_skills = calculate_skill_match(jd, resume)

    final_score = round((semantic_score * 0.60) + (skill_score * 0.40))
    reasoning = (
        f"Semantic match is {semantic_score}/100. "
        f"Skill match is {skill_score}/100 with {len(matched_skills)} matched skills "
        f"and {len(missing_skills)} missing required skills."
    )

    return CandidateScore(
        candidate_name=resume.get("candidate_name", "Unknown Candidate"),
        source_file=resume.get("source_file", "unknown"),
        score=final_score,
        semantic_score=semantic_score,
        skill_score=skill_score,
        matched_skills=matched_skills,
        missing_required_skills=missing_skills,
        reasoning=reasoning,
    )


def _target_skills(jd: dict[str, Any]) -> list[str]:
    """Return stable, deduplicated required skills for scoring."""
    candidates = [
        *jd.get("required_skills", []),
        *[
            item
            for item in jd.get("must_have_requirements", [])
            if isinstance(item, str) and item.strip() and _looks_like_skill(item)
        ],
    ]
    seen: set[str] = set()
    skills: list[str] = []
    for skill in candidates:
        key = _normalize_skill(str(skill))
        if key and key not in seen:
            seen.add(key)
            skills.append(str(skill).strip())
    return skills


def _stable_score_from_evidence(
    jd: dict[str, Any],
    resume: dict[str, Any],
    evidence: AiSkillEvidence,
    use_embeddings: bool = False,
) -> CandidateScore:
    """Compute the final score deterministically from AI-verified evidence."""
    target_skills = _target_skills(jd)
    target_lookup = {_normalize_skill(skill): skill for skill in target_skills}
    matched_keys = {
        _normalize_skill(skill)
        for skill in evidence.matched_skills
        if _normalize_skill(skill) in target_lookup
    }

    matched_skills = sorted(target_lookup[key] for key in matched_keys)
    missing_skills = sorted(
        skill for key, skill in target_lookup.items() if key not in matched_keys
    )

    if target_skills:
        skill_score = round((len(matched_skills) / len(target_skills)) * 100)
    else:
        skill_score, matched_skills, missing_skills = calculate_skill_match(jd, resume)

    semantic_similarity_score = semantic_similarity(
        _jd_to_text(jd),
        _resume_to_text(resume),
        use_model=use_embeddings,
    )
    semantic_score = round(max(0.0, min(semantic_similarity_score, 1.0)) * 100)
    final_score = round((skill_score * 0.75) + (semantic_score * 0.25))

    reasoning = (
        f"AI verified {len(matched_skills)} of {len(target_skills)} required skills. "
        f"Skill score is {skill_score}/100 and semantic evidence score is {semantic_score}/100. "
        f"{evidence.reasoning}".strip()
    )

    return CandidateScore(
        candidate_name=resume.get("candidate_name", "Unknown Candidate"),
        source_file=resume.get("source_file", "unknown"),
        score=final_score,
        semantic_score=semantic_score,
        skill_score=skill_score,
        matched_skills=matched_skills,
        missing_required_skills=missing_skills,
        reasoning=reasoning,
    )


def build_ai_scoring_prompt(jd: dict[str, Any], resume: dict[str, Any]) -> str:
    """Create an AI scoring prompt that rejects unsupported matches."""
    return f"""
You are a strict technical recruiter and hiring evaluator.

Verify which required job skills are supported by evidence in the resume.

Return ONLY valid JSON with this shape:
{{
  "matched_skills": ["string"],
  "missing_required_skills": ["string"],
  "reasoning": "string"
}}

Rules:
- Use the job's required skills and inferred role expectations.
- Give credit only for evidence in the resume. Do not assume experience.
- If the resume is for a different field, mark required skills as missing and explain the mismatch.
- If a stack name appears, understand its technologies. MERN means MongoDB,
  Express, React, Node.js, and JavaScript.
- Matched skills must be required job skills supported by the resume.
- Missing required skills must be important job skills not supported by the resume.
- Do not return a numeric score. The application will compute the score deterministically.
- Interview friendliness does not matter; this is evidence-based evidence verification.

Job:
{json.dumps(jd, indent=2)}

Resume:
{json.dumps(resume, indent=2)}
""".strip()


def score_candidate_with_ai(
    jd: dict[str, Any],
    resume: dict[str, Any],
    use_embeddings: bool = False,
) -> CandidateScore:
    """Ask the LLM to verify evidence, then compute a stable score in code."""
    try:
        prompt = build_ai_scoring_prompt(jd, resume)
        parsed_json = extract_json_object(call_configured_llm(prompt))
        evidence = AiSkillEvidence.model_validate(parsed_json)
        return _stable_score_from_evidence(
            jd,
            resume,
            evidence,
            use_embeddings=use_embeddings,
        )
    except (requests.RequestException, json.JSONDecodeError, ValidationError, ValueError):
        return score_candidate(jd, resume, use_embeddings=False)


def matcher_node(state: dict[str, Any]) -> dict[str, Any]:
    """LangGraph node wrapper for the Matching & Scoring Agent."""
    errors = list(state.get("errors", []))
    jd = state.get("jd_parsed", {})
    resumes = state.get("resumes_parsed", [])
    use_embeddings = state.get("use_embeddings", True)
    use_llm = state.get("use_llm", True)
    scores: list[dict[str, Any]] = []

    if not jd:
        return {
            "scores": [],
            "errors": [*errors, "Matcher failed: jd_parsed is missing."],
        }

    for index, resume in enumerate(resumes):
        try:
            score = (
                score_candidate_with_ai(jd, resume, use_embeddings=use_embeddings)
                if use_llm
                else score_candidate(jd, resume, use_embeddings=use_embeddings)
            )
            scores.append(score.model_dump())
        except Exception as exc:
            errors.append(f"Matcher failed for resume {index + 1}: {exc}")

    scores.sort(key=lambda item: item["score"], reverse=True)
    return {"scores": scores, "errors": errors}


# NEXT STEP: Add ChromaDB storage around these scores after local matching works.
