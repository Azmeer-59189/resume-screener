from backend.agents.matcher import (
    AiSkillEvidence,
    _stable_score_from_evidence,
    matcher_node,
    score_candidate,
)


SAMPLE_JD = {
    "title": "Backend Engineer",
    "required_skills": ["python", "fastapi", "sqlite", "react"],
    "nice_to_have_skills": ["docker"],
    "experience_level": "2+ years",
    "responsibilities": ["Build APIs", "Maintain internal hiring tools"],
    "must_have_requirements": ["python", "fastapi"],
    "nice_to_have_requirements": ["docker"],
    "summary": "Backend role building APIs for hiring automation.",
}


GOOD_RESUME = {
    "source_file": "ayesha.pdf",
    "candidate_name": "Ayesha Khan",
    "skills": ["python", "fastapi", "sqlite", "react", "docker"],
    "years_experience": "2+ years",
    "work_experience": ["Built REST APIs for a hiring dashboard"],
    "education": ["BS Computer Science"],
    "projects": ["Resume Screening API using Python and FastAPI"],
    "summary": "Backend developer focused on API systems.",
}


WEAKER_RESUME = {
    "source_file": "omar.pdf",
    "candidate_name": "Omar Ali",
    "skills": ["photoshop", "illustrator"],
    "years_experience": "1 year",
    "work_experience": ["Created social media assets"],
    "education": ["BA Design"],
    "projects": ["Brand identity portfolio"],
    "summary": "Graphic designer focused on visual content.",
}


def test_score_candidate_prefers_skill_and_semantic_match() -> None:
    good_score = score_candidate(SAMPLE_JD, GOOD_RESUME, use_embeddings=False)
    weaker_score = score_candidate(SAMPLE_JD, WEAKER_RESUME, use_embeddings=False)

    assert good_score.score > weaker_score.score
    assert good_score.skill_score == 100
    assert "python" in good_score.matched_skills
    assert "fastapi" in good_score.matched_skills


def test_matcher_node_returns_ranked_scores() -> None:
    result = matcher_node(
        {
            "jd_parsed": SAMPLE_JD,
            "resumes_parsed": [WEAKER_RESUME, GOOD_RESUME],
            "errors": [],
            "use_embeddings": False,
        }
    )

    assert len(result["scores"]) == 2
    assert result["scores"][0]["candidate_name"] == "Ayesha Khan"
    assert result["scores"][0]["score"] >= result["scores"][1]["score"]
    assert result["errors"] == []


def test_stable_ai_evidence_scoring_does_not_use_llm_numeric_score() -> None:
    score = _stable_score_from_evidence(
        SAMPLE_JD,
        GOOD_RESUME,
        AiSkillEvidence(
            matched_skills=["python", "fastapi", "sqlite", "react"],
            missing_required_skills=[],
            reasoning="Resume includes direct evidence for the required backend skills.",
        ),
        use_embeddings=False,
    )

    assert score.skill_score == 100
    assert score.score >= 75
    assert score.missing_required_skills == []
    assert "AI verified" in score.reasoning


# NEXT STEP: Run pytest, then decide whether to add ChromaDB now or continue to Agent 4.
