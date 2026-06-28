import json
import re
from typing import Any

import requests
from pydantic import BaseModel, Field, ValidationError

from backend.utils.json_tools import extract_json_object
from backend.utils.llm import call_configured_llm
from backend.utils.skill_inference import expand_skills


class ParsedResume(BaseModel):
    """The structured shape we want from the Resume Parser Agent."""

    source_file: str = Field(default="unknown")
    candidate_name: str = Field(default="Unknown Candidate")
    email: str = Field(default="")
    phone: str = Field(default="")
    skills: list[str] = Field(default_factory=list)
    years_experience: str = Field(default="Not specified")
    work_experience: list[str] = Field(default_factory=list)
    education: list[str] = Field(default_factory=list)
    projects: list[str] = Field(default_factory=list)
    summary: str = Field(default="")


def build_resume_parser_prompt(resume_text: str) -> str:
    """Create a clear instruction prompt for resume parsing."""
    return f"""
You are a careful technical resume parser.

Return ONLY valid JSON with these keys:
- source_file: string
- candidate_name: string
- email: string
- phone: string
- skills: array of strings
- years_experience: string
- work_experience: array of strings
- education: array of strings
- projects: array of strings
- summary: string

Rules:
- Do not invent facts that are not in the resume.
- Keep work_experience and projects concise but specific.
- If a field is missing, use an empty string or empty array.

Resume:
\"\"\"
{resume_text}
\"\"\"
""".strip()


def _find_known_skills(text: str) -> list[str]:
    """Find common technical skills for the fallback parser."""
    known_skills = [
        "python",
        "javascript",
        "typescript",
        "react",
        "node.js",
        "express",
        "mongodb",
        "angular",
        "vue",
        "fastapi",
        "django",
        "flask",
        "sql",
        "sqlite",
        "postgresql",
        "mongodb",
        "aws",
        "docker",
        "kubernetes",
        "machine learning",
        "nlp",
        "langgraph",
        "git",
    ]
    lower_text = text.lower()
    found_skills = [skill for skill in known_skills if skill in lower_text]
    return expand_skills(found_skills, text)


def fallback_parse_resume(resume_text: str, source_file: str = "unknown") -> ParsedResume:
    """Small rule-based parser used when no LLM is available.

    This is intentionally simple. It lets us test the pipeline structure while
    the LLM handles richer extraction during real runs.
    """
    email_match = re.search(r"[\w.+-]+@[\w-]+\.[\w.-]+", resume_text)
    phone_match = re.search(r"(\+?\d[\d\s().-]{7,}\d)", resume_text)
    experience_match = re.search(
        r"(\d+\+?\s*(?:years|yrs)[^\n.,;]*)",
        resume_text,
        flags=re.IGNORECASE,
    )

    lines = [line.strip(" -\t") for line in resume_text.splitlines() if line.strip()]
    candidate_name = "Unknown Candidate"
    for line in lines:
        has_digit = any(char.isdigit() for char in line)
        has_email = "@" in line
        if not has_digit and not has_email and len(line.split()) <= 5:
            candidate_name = line
            break

    education = [
        line
        for line in lines
        if re.search(r"\b(university|college|bachelor|master|bs|ms|degree)\b", line, re.I)
    ][:5]
    work_experience = [
        line
        for line in lines
        if re.search(r"\b(engineer|developer|intern|worked|built|developed|company)\b", line, re.I)
    ][:8]
    projects = [
        line
        for line in lines
        if re.search(r"\b(project|app|dashboard|system|platform|api)\b", line, re.I)
    ][:8]

    return ParsedResume(
        source_file=source_file,
        candidate_name=candidate_name,
        email=email_match.group(0) if email_match else "",
        phone=phone_match.group(1).strip() if phone_match else "",
        skills=_find_known_skills(resume_text),
        years_experience=experience_match.group(1) if experience_match else "Not specified",
        work_experience=work_experience,
        education=education,
        projects=projects,
        summary=resume_text[:300].strip(),
    )


def parse_resume_text(
    resume_text: str,
    source_file: str = "unknown",
    use_llm: bool = True,
) -> ParsedResume:
    """Parse one raw resume into validated JSON-like Python data."""
    if not resume_text.strip():
        raise ValueError("Resume text cannot be empty.")

    if not use_llm:
        return fallback_parse_resume(resume_text, source_file=source_file)

    try:
        prompt = build_resume_parser_prompt(resume_text)
        model_output = call_configured_llm(prompt)
        parsed_json = extract_json_object(model_output)
        parsed_json["source_file"] = source_file
        return ParsedResume.model_validate(parsed_json)
    except (requests.RequestException, json.JSONDecodeError, ValidationError, ValueError):
        return fallback_parse_resume(resume_text, source_file=source_file)


def _normalize_resume_input(raw_resume: Any, index: int) -> tuple[str, str]:
    """Accept either a plain string or a dict with text and filename."""
    if isinstance(raw_resume, dict):
        text = raw_resume.get("text", "")
        source_file = raw_resume.get("source_file") or raw_resume.get("filename") or f"resume_{index + 1}"
        return str(text), str(source_file)

    return str(raw_resume), f"resume_{index + 1}"


def resume_parser_node(state: dict[str, Any]) -> dict[str, Any]:
    """LangGraph node wrapper for the Resume Parser Agent.

    One bad resume should not stop the whole hiring pipeline. We collect errors
    and continue parsing the remaining resumes.
    """
    parsed_resumes: list[dict[str, Any]] = []
    errors = list(state.get("errors", []))
    raw_resumes = state.get("resumes_raw", [])

    for index, raw_resume in enumerate(raw_resumes):
        try:
            resume_text, source_file = _normalize_resume_input(raw_resume, index)
            parsed = parse_resume_text(
                resume_text,
                source_file=source_file,
                use_llm=state.get("use_llm", True),
            )
            parsed_resumes.append(parsed.model_dump())
        except Exception as exc:
            errors.append(f"Resume Parser failed for resume {index + 1}: {exc}")

    return {"resumes_parsed": parsed_resumes, "errors": errors}


# NEXT STEP: Use parsed resumes with the parsed JD in Agent 3: Matching & Scoring.
