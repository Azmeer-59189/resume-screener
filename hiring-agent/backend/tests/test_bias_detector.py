from backend.agents.bias_detector import (
    BiasDetectionResult,
    BiasFlag,
    bias_detector_node,
    detect_bias,
    filter_bias_false_positives,
)


def test_detect_bias_flags_obvious_age_and_gender_terms() -> None:
    jd_text = """
    We need a young rockstar developer who can work hard play hard.
    Recent graduate preferred.
    """

    result = detect_bias(jd_text, use_llm=False)

    categories = {flag.category for flag in result.flags}
    assert result.has_bias_risk is True
    assert "age" in categories
    assert "gender" in categories
    assert "proxy" in categories


def test_detect_bias_allows_neutral_job_description() -> None:
    jd_text = """
    We need a backend developer with Python, FastAPI, and SQL experience.
    The role includes building APIs and collaborating with product managers.
    """

    result = detect_bias(jd_text, use_llm=False)

    assert result.has_bias_risk is False
    assert result.flags == []


def test_bias_detector_node_reviews_scoring_reasoning() -> None:
    result = bias_detector_node(
        {
            "jd_text": "Backend Developer with Python experience.",
            "scores": [
                {
                    "candidate_name": "Ayesha Khan",
                    "reasoning": "Rejected because candidate is a fresh graduate.",
                    "missing_required_skills": [],
                }
            ],
            "errors": [],
            "use_llm": False,
        }
    )

    assert result["bias_flags"]["has_bias_risk"] is True
    assert result["bias_flags"]["flags"][0]["source"] == "scoring_reasoning"
    assert result["errors"] == []


def test_bias_filter_removes_common_llm_false_positives() -> None:
    result = filter_bias_false_positives(
        BiasDetectionResult(
            has_bias_risk=True,
            flags=[
                BiasFlag(
                    source="job_description",
                    category="proxy",
                    severity="medium",
                    text="5+ years of experience",
                    explanation="Experience level: mid, with a focus on relevant skills and experience",
                    suggestion="Focus on relevant skills and experience.",
                ),
                BiasFlag(
                    source="job_description",
                    category="nationality",
                    severity="medium",
                    text="Karachi",
                    explanation="Location: flexible, with a focus on remote work options",
                    suggestion="Focus on remote work options.",
                ),
                BiasFlag(
                    source="scoring_reasoning",
                    category="gender",
                    severity="medium",
                    text="Emily Carter",
                    explanation="Candidate name may imply gender.",
                    suggestion="Use a more neutral name.",
                ),
                BiasFlag(
                    source="job_description",
                    category="proxy",
                    severity="medium",
                    text="MERN stack",
                    explanation="Focus on relevant skills and experience, rather than specific technologies",
                    suggestion="Focus on relevant skills.",
                ),
            ],
            summary="Found possible issues.",
        )
    )

    assert result.has_bias_risk is False
    assert result.flags == []


def test_bias_filter_keeps_real_nationality_restriction() -> None:
    result = filter_bias_false_positives(
        BiasDetectionResult(
            has_bias_risk=True,
            flags=[
                BiasFlag(
                    source="job_description",
                    category="nationality",
                    severity="high",
                    text="only citizens",
                    explanation="This excludes non-citizens.",
                    suggestion="Use lawful work authorization wording.",
                )
            ],
            summary="Found possible issues.",
        )
    )

    assert result.has_bias_risk is True
    assert len(result.flags) == 1


# NEXT STEP: Run pytest, then build Agent 5: Interview Question Generator.
