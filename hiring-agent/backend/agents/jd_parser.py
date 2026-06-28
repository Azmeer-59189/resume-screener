import json
import re
from typing import Any

import requests
from pydantic import BaseModel, Field, ValidationError

from backend.utils.json_tools import extract_json_object
from backend.utils.llm import call_configured_llm
from backend.utils.skill_inference import expand_skills


class ParsedJobDescription(BaseModel):
    """The structured shape we want from the JD Parser Agent."""

    title: str = Field(default="Unknown Role")
    required_skills: list[str] = Field(default_factory=list)
    nice_to_have_skills: list[str] = Field(default_factory=list)
    experience_level: str = Field(default="Not specified")
    responsibilities: list[str] = Field(default_factory=list)
    must_have_requirements: list[str] = Field(default_factory=list)
    nice_to_have_requirements: list[str] = Field(default_factory=list)
    summary: str = Field(default="")


def build_jd_parser_prompt(jd_text: str) -> str:
    """Create a clear instruction prompt for whichever LLM provider we use."""
    return f"""
You are a careful HR job-description parser.

Return ONLY valid JSON with these keys:
- title: string
- required_skills: array of strings
- nice_to_have_skills: array of strings
- experience_level: string
- responsibilities: array of strings
- must_have_requirements: array of strings
- nice_to_have_requirements: array of strings
- summary: string

Rules:
- If the JD is vague or only contains a title, infer the standard technologies,
  responsibilities, and must-have requirements for that role.
- For stack names, expand the stack into concrete technologies. For example,
  MERN means MongoDB, Express, React, Node.js, and JavaScript.
- Do not invent company-specific details, salary, location, or seniority unless
  they are provided.

Job description:
\"\"\"
{jd_text}
\"\"\"
""".strip()


def fallback_parse_jd(jd_text: str) -> ParsedJobDescription:
    """Small rule-based parser used when Ollama is unavailable.

    This is not as smart as an LLM, but it lets tests and demos keep working.
    """
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
        "sql",
        "postgresql",
        "sqlite",
        "aws",
        "docker",
        "kubernetes",
        "machine learning",
        "nlp",
        "langgraph",
    ]
    lower_text = jd_text.lower()
    found_skills = [skill for skill in known_skills if skill in lower_text]
    found_skills = expand_skills(found_skills, jd_text)

    experience_match = re.search(
        r"(\d+\+?\s*(?:years|yrs)[^\n.,;]*)",
        jd_text,
        flags=re.IGNORECASE,
    )

    lines = [line.strip(" -\t") for line in jd_text.splitlines() if line.strip()]
    responsibilities = [
        line
        for line in lines
        if re.search(r"\b(build|design|develop|maintain|collaborate|lead|create)\b", line, re.I)
    ][:8]

    return ParsedJobDescription(
        title=lines[0] if lines else "Unknown Role",
        required_skills=found_skills,
        experience_level=experience_match.group(1) if experience_match else "Not specified",
        responsibilities=responsibilities,
        must_have_requirements=found_skills,
        summary=jd_text[:300].strip(),
    )


def parse_jd_text(jd_text: str, use_llm: bool = True) -> ParsedJobDescription:
    """Parse raw JD text into validated JSON-like Python data."""
    if not jd_text.strip():
        raise ValueError("Job description text cannot be empty.")

    if not use_llm:
        return fallback_parse_jd(jd_text)

    try:
        prompt = build_jd_parser_prompt(jd_text)
        model_output = call_configured_llm(prompt)
        parsed_json = extract_json_object(model_output)
        parsed = ParsedJobDescription.model_validate(parsed_json)
        context = " ".join([
            jd_text,
            parsed.title,
            " ".join(parsed.required_skills),
            " ".join(parsed.must_have_requirements),
        ])
        parsed.required_skills = expand_skills(parsed.required_skills, context)
        parsed.must_have_requirements = expand_skills(parsed.must_have_requirements, context)
        return parsed
    except (requests.RequestException, json.JSONDecodeError, ValidationError, ValueError):
        return fallback_parse_jd(jd_text)


def jd_parser_node(state: dict[str, Any]) -> dict[str, Any]:
    """LangGraph node wrapper for the JD Parser Agent.

    A node is just a function that receives the current pipeline state and
    returns the fields it wants to update.
    """
    try:
        jd_text = state.get("jd_text", "")
        parsed = parse_jd_text(jd_text, use_llm=state.get("use_llm", True))
        return {"jd_parsed": parsed.model_dump(), "errors": state.get("errors", [])}
    except Exception as exc:
        errors = [*state.get("errors", []), f"JD Parser failed: {exc}"]
        return {"jd_parsed": {}, "errors": errors}


# NEXT STEP: Use this parsed JD as input for Agent 3 after resumes are parsed.
