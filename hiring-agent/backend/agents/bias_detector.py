import json
import re
from typing import Any

import requests
from pydantic import BaseModel, Field, ValidationError

from backend.utils.json_tools import extract_json_object
from backend.utils.llm import call_configured_llm


class BiasFlag(BaseModel):
    """One potential bias issue found in the JD or scoring reasoning."""

    source: str = Field(default="unknown")
    category: str = Field(default="general")
    severity: str = Field(default="low")
    text: str = Field(default="")
    explanation: str = Field(default="")
    suggestion: str = Field(default="")


class BiasDetectionResult(BaseModel):
    """Structured output for the Bias Detection Agent."""

    has_bias_risk: bool = Field(default=False)
    flags: list[BiasFlag] = Field(default_factory=list)
    summary: str = Field(default="")


def build_bias_detector_prompt(jd_text: str, scoring_reasoning: str) -> str:
    """Create an instruction prompt for bias review."""
    return f"""
You are a careful hiring bias reviewer.

Review the job description and candidate scoring reasoning for potentially
biased language or criteria.

Look for:
- gender bias
- age bias
- nationality or citizenship bias
- disability bias
- race or ethnicity bias
- religion bias
- marital or family status bias
- proxy criteria that are not job-related

Important non-bias examples:
- Technology stacks and frameworks such as MERN stack, React, Node.js, Python,
  FastAPI, ML backend, or DevOps are job-related skills, not proxy bias.
- Ordinary experience requirements such as "3+ years" or "5+ years" are not age
  bias unless they explicitly mention age, "young", "recent graduate", "under
  30", or similar protected-trait wording.
- City or work-location names such as Karachi, Lahore, London, remote, hybrid,
  or onsite are not nationality bias unless the text excludes nationalities or
  citizenship groups.
- Candidate names in scoring reasoning are not gender bias. Only flag gendered
  requirements or coded language in hiring criteria.
- Do not flag a phrase unless you can explain a concrete protected-trait or
  non-job-related proxy risk.

Return ONLY valid JSON with this shape:
{{
  "has_bias_risk": boolean,
  "flags": [
    {{
      "source": "job_description or scoring_reasoning",
      "category": "gender, age, nationality, disability, race, religion, family_status, proxy, or general",
      "severity": "low, medium, or high",
      "text": "exact short phrase that caused concern",
      "explanation": "why this may be biased",
      "suggestion": "more neutral alternative"
    }}
  ],
  "summary": "short plain-English summary"
}}

Job description:
\"\"\"
{jd_text}
\"\"\"

Scoring reasoning:
\"\"\"
{scoring_reasoning}
\"\"\"
""".strip()


BIAS_PATTERNS: list[tuple[str, str, str, str]] = [
    (
        "gender",
        "medium",
        r"\b(rockstar|ninja|guru|dominant|aggressive)\b",
        "Use neutral, role-specific wording instead of coded language.",
    ),
    (
        "age",
        "high",
        r"\b(young|fresh graduate|recent graduate|digital native|under\s+\d+|below\s+\d+)\b",
        "Describe required skills or experience instead of age-related criteria.",
    ),
    (
        "nationality",
        "high",
        r"\b(native english speaker|must be local|foreigners not allowed|only citizens)\b",
        "State lawful work authorization or language proficiency requirements.",
    ),
    (
        "disability",
        "high",
        r"\b(able-bodied|healthy candidate|no disabilities)\b",
        "Describe essential job functions and reasonable accommodations.",
    ),
    (
        "family_status",
        "high",
        r"\b(unmarried|single only|no family commitments|no children)\b",
        "Remove family or marital status criteria.",
    ),
    (
        "proxy",
        "medium",
        r"\b(culture fit|work hard play hard|must handle pressure 24/7)\b",
        "Define specific job behaviors and schedule expectations.",
    ),
]


def fallback_detect_bias(jd_text: str, scoring_reasoning: str = "") -> BiasDetectionResult:
    """Rule-based bias detector used for tests and offline runs."""
    combined_sources = [
        ("job_description", jd_text),
        ("scoring_reasoning", scoring_reasoning),
    ]
    flags: list[BiasFlag] = []

    for source, text in combined_sources:
        for category, severity, pattern, suggestion in BIAS_PATTERNS:
            for match in re.finditer(pattern, text, flags=re.IGNORECASE):
                phrase = match.group(0)
                flags.append(
                    BiasFlag(
                        source=source,
                        category=category,
                        severity=severity,
                        text=phrase,
                        explanation=f"The phrase '{phrase}' may introduce {category} bias.",
                        suggestion=suggestion,
                    )
                )

    summary = (
        f"Found {len(flags)} potential bias issue(s)."
        if flags
        else "No obvious bias risks found by the rule-based detector."
    )

    return BiasDetectionResult(
        has_bias_risk=bool(flags),
        flags=flags,
        summary=summary,
    )


TECH_OR_ROLE_TERMS = re.compile(
    r"\b(mern|mean|mevn|react|node\.?js|express|mongodb|javascript|typescript|"
    r"python|fastapi|django|flask|sql|postgresql|sqlite|ml backend|machine learning|"
    r"devops|docker|kubernetes|aws|api|backend|frontend|full[\s-]?stack)\b",
    re.IGNORECASE,
)
LOCATION_WORDS = re.compile(
    r"\b(karachi|lahore|islamabad|pakistan|remote|hybrid|onsite|on-site|"
    r"london|new york|dubai|toronto)\b",
    re.IGNORECASE,
)
EXPERIENCE_ONLY = re.compile(r"^\s*\d+\+?\s*(years|yrs)(\s+of\s+experience)?\s*$", re.IGNORECASE)
PERSON_NAME = re.compile(r"^[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2}$")
GENERIC_SAFE_PROXY = {
    "mern stack",
    "mean stack",
    "mevn stack",
    "full stack",
    "full-stack",
}


def _is_false_positive(flag: BiasFlag) -> bool:
    """Remove common LLM bias-review false positives."""
    text = flag.text.strip()
    normalized = text.lower()
    category = flag.category.lower()
    source = flag.source.lower()

    if category == "proxy" and (
        normalized in GENERIC_SAFE_PROXY
        or TECH_OR_ROLE_TERMS.search(text)
    ):
        return True

    if category == "age" and EXPERIENCE_ONLY.match(text):
        return True

    if category in {"nationality", "race"} and LOCATION_WORDS.search(text):
        risky_context = re.search(
            r"\b(only|must be|citizens?|nationals?|native|foreigners?|not allowed|local only)\b",
            flag.explanation + " " + flag.suggestion,
            re.IGNORECASE,
        )
        return not risky_context

    if category == "gender" and source == "scoring_reasoning" and PERSON_NAME.match(text):
        return True

    return False


def filter_bias_false_positives(result: BiasDetectionResult) -> BiasDetectionResult:
    """Keep real risk flags while dropping common harmless job details."""
    filtered = [flag for flag in result.flags if not _is_false_positive(flag)]
    if len(filtered) == len(result.flags):
        return result

    summary = (
        f"Found {len(filtered)} potential bias issue(s) after filtering common false positives."
        if filtered
        else "No obvious bias risks found after filtering common false positives."
    )
    return BiasDetectionResult(
        has_bias_risk=bool(filtered),
        flags=filtered,
        summary=summary,
    )


def detect_bias(
    jd_text: str,
    scoring_reasoning: str = "",
    use_llm: bool = True,
) -> BiasDetectionResult:
    """Review job and scoring text for possible bias."""
    if not jd_text.strip() and not scoring_reasoning.strip():
        return BiasDetectionResult(summary="No text was provided for bias review.")

    if not use_llm:
        return fallback_detect_bias(jd_text, scoring_reasoning)

    try:
        prompt = build_bias_detector_prompt(jd_text, scoring_reasoning)
        model_output = call_configured_llm(prompt)
        parsed_json = extract_json_object(model_output)
        return filter_bias_false_positives(BiasDetectionResult.model_validate(parsed_json))
    except (requests.RequestException, json.JSONDecodeError, ValidationError, ValueError):
        return fallback_detect_bias(jd_text, scoring_reasoning)


def _collect_scoring_reasoning(scores: list[dict[str, Any]]) -> str:
    """Combine matcher reasoning into one reviewable text block."""
    lines: list[str] = []
    for score in scores:
        candidate = score.get("candidate_name", "Unknown Candidate")
        reasoning = score.get("reasoning", "")
        missing = ", ".join(score.get("missing_required_skills", []))
        lines.append(f"{candidate}: {reasoning} Missing skills: {missing}")
    return "\n".join(lines)


def bias_detector_node(state: dict[str, Any]) -> dict[str, Any]:
    """LangGraph node wrapper for the Bias Detection Agent."""
    try:
        jd_text = state.get("jd_text", "")
        scoring_reasoning = _collect_scoring_reasoning(state.get("scores", []))
        result = detect_bias(
            jd_text,
            scoring_reasoning=scoring_reasoning,
            use_llm=state.get("use_llm", True),
        )
        return {"bias_flags": result.model_dump(), "errors": state.get("errors", [])}
    except Exception as exc:
        errors = [*state.get("errors", []), f"Bias Detector failed: {exc}"]
        fallback = BiasDetectionResult(summary="Bias detector failed.").model_dump()
        return {"bias_flags": fallback, "errors": errors}


# NEXT STEP: Use bias flags in the final results dashboard and reports.
