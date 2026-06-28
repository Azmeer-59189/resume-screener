import json
from typing import Any

import requests
from pydantic import BaseModel, Field, ValidationError

from backend.utils.json_tools import extract_json_object
from backend.utils.llm import call_configured_llm


class InterviewQuestion(BaseModel):
    """One interview question tailored to a candidate."""

    question: str = Field(default="")
    category: str = Field(default="technical")
    rationale: str = Field(default="")


class CandidateInterviewQuestions(BaseModel):
    """All generated questions for one candidate."""

    candidate_name: str = Field(default="Unknown Candidate")
    source_file: str = Field(default="unknown")
    score: int = Field(default=0)
    questions: list[InterviewQuestion] = Field(default_factory=list)


def build_question_generator_prompt(
    jd: dict[str, Any],
    resume: dict[str, Any],
    score: dict[str, Any],
) -> str:
    """Create a prompt for tailored interview question generation."""
    return f"""
You are an expert technical interviewer.

Generate exactly 5 interview questions for this candidate.

Return ONLY valid JSON with this shape:
{{
  "candidate_name": "string",
  "source_file": "string",
  "score": number,
  "questions": [
    {{
      "question": "string",
      "category": "technical or behavioral",
      "rationale": "why this question matters"
    }}
  ]
}}

Rules:
- Use the candidate's actual skills, work experience, and projects.
- Compare the candidate against the job description.
- If the candidate is a poor match or the resume is for the wrong field, do not
  pretend it is a good fit. Ask screening questions that verify the missing
  fundamentals and explain the mismatch.
- Include at least 3 technical questions.
- Include at least 1 behavioral question.
- Ask about missing or weaker areas when useful.
- Do not ask about protected traits such as age, gender, nationality, religion, or family status.

Job description:
{json.dumps(jd, indent=2)}

Candidate resume:
{json.dumps(resume, indent=2)}

Candidate score:
{json.dumps(score, indent=2)}
""".strip()


def fallback_generate_questions(
    jd: dict[str, Any],
    resume: dict[str, Any],
    score: dict[str, Any],
) -> CandidateInterviewQuestions:
    """Rule-based question generator used for tests and offline runs."""
    candidate_name = resume.get("candidate_name", "Unknown Candidate")
    source_file = resume.get("source_file", "unknown")
    candidate_score = int(score.get("score", 0))
    skills = resume.get("skills", [])
    projects = resume.get("projects", [])
    responsibilities = jd.get("responsibilities", [])
    missing_skills = score.get("missing_required_skills", [])
    candidate_score = int(score.get("score", 0))

    if candidate_score < 50:
        required_skills = jd.get("required_skills", [])
        primary_gap = missing_skills[0] if missing_skills else (
            required_skills[0] if required_skills else "the core requirements for this role"
        )
        second_gap = missing_skills[1] if len(missing_skills) > 1 else primary_gap
        role_title = jd.get("title", "this role")
        questions = [
            InterviewQuestion(
                question=f"What hands-on experience do you have that directly relates to {role_title}?",
                category="technical",
                rationale="Checks whether the candidate has role-relevant evidence despite a weak resume match.",
            ),
            InterviewQuestion(
                question=f"Can you show a project or work example where you used {primary_gap}?",
                category="technical",
                rationale="Verifies a missing or weak required skill instead of assuming it exists.",
            ),
            InterviewQuestion(
                question=f"How would you approach learning and applying {second_gap} for this role?",
                category="technical",
                rationale="Tests readiness around a major gap found during screening.",
            ),
            InterviewQuestion(
                question="Which parts of your background are not represented well in this resume?",
                category="behavioral",
                rationale="Gives the candidate a fair chance to clarify missing evidence.",
            ),
            InterviewQuestion(
                question="Why are you interested in moving into this role based on your current experience?",
                category="behavioral",
                rationale="Assesses motivation when the resume appears misaligned.",
            ),
        ]
        return CandidateInterviewQuestions(
            candidate_name=candidate_name,
            source_file=source_file,
            score=candidate_score,
            questions=questions,
        )

    primary_skill = skills[0] if skills else (missing_skills[0] if missing_skills else "the main technical requirement")
    second_skill = skills[1] if len(skills) > 1 else primary_skill
    project = projects[0] if projects else "one of your most relevant projects"
    responsibility = responsibilities[0] if responsibilities else "this role's main responsibilities"
    missing_skill = missing_skills[0] if missing_skills else "a new technology required for this role"

    questions = [
        InterviewQuestion(
            question=f"How have you used {primary_skill} to solve a real backend problem?",
            category="technical",
            rationale=f"Checks depth in {primary_skill}, which appears in the candidate profile.",
        ),
        InterviewQuestion(
            question=f"Walk me through the design and tradeoffs of {project}.",
            category="technical",
            rationale="Connects the interview to a concrete project from the resume.",
        ),
        InterviewQuestion(
            question=f"How would you approach {responsibility} in our environment?",
            category="technical",
            rationale="Tests how the candidate maps their experience to the job responsibilities.",
        ),
        InterviewQuestion(
            question=f"What would you do to get productive with {missing_skill} if hired?",
            category="technical",
            rationale="Explores learning ability around a missing or weaker requirement.",
        ),
        InterviewQuestion(
            question=f"Tell me about a time you collaborated with others while using {second_skill}.",
            category="behavioral",
            rationale="Assesses communication and teamwork using a resume-specific context.",
        ),
    ]

    return CandidateInterviewQuestions(
        candidate_name=candidate_name,
        source_file=source_file,
        score=candidate_score,
        questions=questions,
    )


def generate_questions_for_candidate(
    jd: dict[str, Any],
    resume: dict[str, Any],
    score: dict[str, Any],
    use_llm: bool = True,
) -> CandidateInterviewQuestions:
    """Generate five tailored interview questions for one candidate."""
    if not use_llm:
        return fallback_generate_questions(jd, resume, score)

    try:
        prompt = build_question_generator_prompt(jd, resume, score)
        model_output = call_configured_llm(prompt)
        parsed_json = extract_json_object(model_output)
        parsed_json["candidate_name"] = resume.get("candidate_name", "Unknown Candidate")
        parsed_json["source_file"] = resume.get("source_file", "unknown")
        parsed_json["score"] = int(score.get("score", 0))
        result = CandidateInterviewQuestions.model_validate(parsed_json)
        if len(result.questions) != 5:
            return fallback_generate_questions(jd, resume, score)
        return result
    except (requests.RequestException, json.JSONDecodeError, ValidationError, ValueError):
        return fallback_generate_questions(jd, resume, score)


def _resume_lookup(resumes: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    """Index parsed resumes by source file for quick matching."""
    return {resume.get("source_file", "unknown"): resume for resume in resumes}


def question_generator_node(state: dict[str, Any]) -> dict[str, Any]:
    """LangGraph node wrapper for the Interview Question Generator Agent."""
    errors = list(state.get("errors", []))
    jd = state.get("jd_parsed", {})
    scores = state.get("scores", [])
    resumes_by_file = _resume_lookup(state.get("resumes_parsed", []))
    use_llm = state.get("use_llm", True)
    generated: list[dict[str, Any]] = []

    for score in scores[:3]:
        try:
            source_file = score.get("source_file", "unknown")
            resume = resumes_by_file.get(source_file)
            if not resume:
                errors.append(f"Question Generator skipped missing resume: {source_file}")
                continue

            questions = generate_questions_for_candidate(
                jd,
                resume,
                score,
                use_llm=use_llm,
            )
            generated.append(questions.model_dump())
        except Exception as exc:
            candidate = score.get("candidate_name", "Unknown Candidate")
            errors.append(f"Question Generator failed for {candidate}: {exc}")

    return {"interview_questions": generated, "errors": errors}


# NEXT STEP: Connect all five agents inside the LangGraph StateGraph.
