from backend.agents.matcher import (
    AiSkillEvidence,
    RoleAssessment,
    _stable_score_from_evidence,
    matcher_node,
    score_candidate,
)


def test_role_fit_uses_work_evidence_without_job_title() -> None:
    jd = {"title": "Backend Engineer", "required_skills": ["Backend Engineer", "Python"]}
    raw = "Built authenticated HTTP endpoints in Python. Tuned PostgreSQL queries. Added automated service tests."
    evidence = AiSkillEvidence(matched_skills=["Python"], role_assessments=[
        RoleAssessment(criterion="Implement services", supported=True, resume_quote="Built authenticated HTTP endpoints in Python.", explanation="Demonstrates server-side API development."),
        RoleAssessment(criterion="Maintain data access", supported=True, resume_quote="Tuned PostgreSQL queries."),
        RoleAssessment(criterion="Test services", supported=True, resume_quote="Added automated service tests."),
    ])
    assert "Backend Engineer" not in raw
    score = _stable_score_from_evidence(jd, {"skills": ["Python"]}, evidence, resume_text=raw)
    assert score.score == 100
    assert score.scoring_source == "llm"
    assert score.missing_required_skills == []
    assert len(score.role_assessments) == 3


def test_invented_resume_quotes_do_not_contribute_to_role_fit() -> None:
    evidence = AiSkillEvidence(role_assessments=[
        RoleAssessment(criterion=criterion, supported=True, resume_quote="Invented professional experience")
        for criterion in ["Design APIs", "Manage databases", "Test services"]
    ])
    score = _stable_score_from_evidence({"title": "Backend Engineer"}, {}, evidence, resume_text="Designed printed posters.")
    assert score.score == 0
    assert all(not item.supported and not item.resume_quote for item in score.role_assessments)


def test_ai_failure_is_explicitly_labeled_as_local(monkeypatch) -> None:
    from backend.agents import matcher
    def fail(_prompt):
        raise ValueError("Model response unavailable")
    monkeypatch.setattr(matcher, "call_configured_llm", fail)
    score = matcher.score_candidate_with_ai({"required_skills": ["Python"]}, {"skills": ["Python"]})
    assert score.scoring_source == "local"
    assert "local fallback" in score.processing_warning


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


def test_scores_report_the_weights_actually_used() -> None:
    fallback = score_candidate(SAMPLE_JD, GOOD_RESUME, use_embeddings=False)
    ai = _stable_score_from_evidence(
        SAMPLE_JD,
        GOOD_RESUME,
        AiSkillEvidence(matched_skills=["python"]),
        use_embeddings=False,
    )

    assert (fallback.skill_weight, fallback.semantic_weight) == (40, 60)
    assert (ai.skill_weight, ai.semantic_weight) == (75, 25)
    assert ai.score == round(
        (ai.skill_score * ai.skill_weight + ai.semantic_score * ai.semantic_weight) / 100
    )


# NEXT STEP: Run pytest, then decide whether to add ChromaDB now or continue to Agent 4.


def test_aliases_match_in_fallback_and_ai_evidence() -> None:
    jd = {"required_skills": ["JS", "JavaScript", "NodeJS"]}
    resume = {"skills": ["JavaScript", "Node.js"], "summary": "JavaScript and Node.js developer"}
    local = score_candidate(jd, resume, use_embeddings=False)
    assert local.skill_score == 100
    assert local.missing_required_skills == []
    ai = _stable_score_from_evidence(jd, resume, AiSkillEvidence(matched_skills=["JavaScript", "Node.js"]), use_embeddings=False)
    assert ai.skill_score == 100
    assert len(ai.matched_skills) == 2
    assert ai.missing_required_skills == []


def test_java_is_not_javascript() -> None:
    score = score_candidate({"required_skills": ["Java"]}, {"skills": ["JavaScript"]}, use_embeddings=False)
    assert score.skill_score == 0
