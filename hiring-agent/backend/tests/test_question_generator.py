from backend.agents.question_generator import (
    generate_questions_for_candidate,
    question_generator_node,
)


SAMPLE_JD = {
    "title": "Backend Engineer",
    "required_skills": ["python", "fastapi", "sqlite"],
    "responsibilities": ["Build APIs for hiring automation"],
}


SAMPLE_RESUME = {
    "source_file": "ayesha.pdf",
    "candidate_name": "Ayesha Khan",
    "skills": ["python", "fastapi", "react"],
    "projects": ["Resume Screening API using Python and FastAPI"],
    "work_experience": ["Built REST APIs for internal dashboards"],
}


SAMPLE_SCORE = {
    "candidate_name": "Ayesha Khan",
    "source_file": "ayesha.pdf",
    "score": 92,
    "missing_required_skills": ["sqlite"],
}


def test_generate_questions_for_candidate_without_llm() -> None:
    result = generate_questions_for_candidate(
        SAMPLE_JD,
        SAMPLE_RESUME,
        SAMPLE_SCORE,
        use_llm=False,
    )

    assert result.candidate_name == "Ayesha Khan"
    assert result.score == 92
    assert len(result.questions) == 5
    assert any(question.category == "behavioral" for question in result.questions)
    assert any("sqlite" in question.question.lower() for question in result.questions)


def test_question_generator_node_uses_top_three_scores() -> None:
    resumes = [
        {**SAMPLE_RESUME, "source_file": "first.pdf", "candidate_name": "First"},
        {**SAMPLE_RESUME, "source_file": "second.pdf", "candidate_name": "Second"},
        {**SAMPLE_RESUME, "source_file": "third.pdf", "candidate_name": "Third"},
        {**SAMPLE_RESUME, "source_file": "fourth.pdf", "candidate_name": "Fourth"},
    ]
    scores = [
        {"source_file": "first.pdf", "candidate_name": "First", "score": 95},
        {"source_file": "second.pdf", "candidate_name": "Second", "score": 90},
        {"source_file": "third.pdf", "candidate_name": "Third", "score": 85},
        {"source_file": "fourth.pdf", "candidate_name": "Fourth", "score": 80},
    ]

    result = question_generator_node(
        {
            "jd_parsed": SAMPLE_JD,
            "resumes_parsed": resumes,
            "scores": scores,
            "errors": [],
            "use_llm": False,
        }
    )

    assert len(result["interview_questions"]) == 3
    assert result["interview_questions"][0]["candidate_name"] == "First"
    assert result["errors"] == []


def test_low_match_questions_verify_gaps_instead_of_fake_tailoring() -> None:
    result = generate_questions_for_candidate(
        SAMPLE_JD,
        {
            "source_file": "wrong.pdf",
            "candidate_name": "Wrong Candidate",
            "skills": ["photoshop", "illustrator"],
            "projects": ["Logo design portfolio"],
            "work_experience": ["Created social media assets"],
        },
        {
            "candidate_name": "Wrong Candidate",
            "source_file": "wrong.pdf",
            "score": 18,
            "missing_required_skills": ["python", "fastapi", "sqlite"],
        },
        use_llm=False,
    )

    assert len(result.questions) == 5
    assert any("python" in question.question.lower() for question in result.questions)
    assert any("weak" in question.rationale.lower() or "gap" in question.rationale.lower() for question in result.questions)


# NEXT STEP: Run pytest, then connect all agents with LangGraph.
