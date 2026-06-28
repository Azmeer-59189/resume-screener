from backend.graph.pipeline import build_initial_state, run_hiring_pipeline


SAMPLE_JD = """
Backend Engineer
We need a developer with 3+ years of experience.
Required skills: Python, FastAPI, SQLite, Docker.
Build and maintain APIs for hiring automation.
Collaborate with product teams.
"""


RESUMES = [
    {
        "source_file": "ayesha.pdf",
        "text": """
Ayesha Khan
ayesha@example.com
Backend Engineer with 4 years of experience.
Skills: Python, FastAPI, SQLite, Docker, React.
Built a resume screening API using Python and FastAPI.
BS Computer Science, City University.
""",
    },
    {
        "source_file": "bilal.pdf",
        "text": """
Bilal Ahmed
bilal@example.com
Frontend Developer with 2 years of experience.
Skills: JavaScript, React, CSS.
Built dashboards and landing pages.
BS Software Engineering.
""",
    },
]


def test_build_initial_state_sets_pipeline_defaults() -> None:
    state = build_initial_state(SAMPLE_JD, RESUMES, use_llm=False, use_embeddings=False)

    assert state["jd_text"] == SAMPLE_JD
    assert state["resumes_raw"] == RESUMES
    assert state["jd_parsed"] == {}
    assert state["resumes_parsed"] == []
    assert state["scores"] == []
    assert state["bias_flags"] == {}
    assert state["interview_questions"] == []
    assert state["errors"] == []
    assert state["use_llm"] is False
    assert state["use_embeddings"] is False


def test_run_hiring_pipeline_without_llm_end_to_end() -> None:
    result = run_hiring_pipeline(
        SAMPLE_JD,
        RESUMES,
        use_llm=False,
        use_embeddings=False,
    )

    assert result["errors"] == []
    assert result["jd_parsed"]["title"] == "Backend Engineer"
    assert len(result["resumes_parsed"]) == 2
    assert len(result["scores"]) == 2
    assert result["scores"][0]["candidate_name"] == "Ayesha Khan"
    assert result["scores"][0]["score"] >= result["scores"][1]["score"]
    assert result["bias_flags"]["has_bias_risk"] is False
    assert len(result["interview_questions"]) == 2
    assert result["interview_questions"][0]["candidate_name"] == "Ayesha Khan"
    assert len(result["interview_questions"][0]["questions"]) == 5
