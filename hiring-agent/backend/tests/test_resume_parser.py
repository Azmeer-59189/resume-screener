from backend.agents.resume_parser import parse_resume_text, resume_parser_node


SAMPLE_RESUME = """
Ayesha Khan
ayesha@example.com
+92 300 1234567

Backend Developer with 2+ years of experience.
Skills: Python, FastAPI, React, SQLite, Docker, Git

Experience:
- Built REST APIs for an internal hiring dashboard.
- Developed SQLite-backed reporting tools.

Education:
BS Computer Science, Example University

Projects:
- Resume Screening API using Python and FastAPI.
- React dashboard for recruiter workflows.
"""


def test_parse_resume_text_without_llm() -> None:
    parsed = parse_resume_text(
        SAMPLE_RESUME,
        source_file="ayesha_resume.pdf",
        use_llm=False,
    )

    assert parsed.source_file == "ayesha_resume.pdf"
    assert parsed.candidate_name == "Ayesha Khan"
    assert parsed.email == "ayesha@example.com"
    assert "python" in parsed.skills
    assert "fastapi" in parsed.skills
    assert parsed.education
    assert parsed.projects


def test_resume_parser_node_parses_multiple_resumes() -> None:
    result = resume_parser_node(
        {
            "resumes_raw": [
                {"filename": "ayesha.pdf", "text": SAMPLE_RESUME},
                SAMPLE_RESUME.replace("Ayesha Khan", "Bilal Ahmed"),
            ],
            "errors": [],
            "use_llm": False,
        }
    )

    assert len(result["resumes_parsed"]) == 2
    assert result["resumes_parsed"][0]["candidate_name"] == "Ayesha Khan"
    assert result["resumes_parsed"][1]["candidate_name"] == "Bilal Ahmed"
    assert result["errors"] == []


def test_parse_resume_infers_skills_from_vague_role_phrase() -> None:
    parsed = parse_resume_text(
        "Bilal Ahmed\nbilal@example.com\nI am a MERN stack developer.",
        source_file="bilal.pdf",
        use_llm=False,
    )

    assert "mongodb" in parsed.skills
    assert "express" in parsed.skills
    assert "react" in parsed.skills
    assert "node.js" in parsed.skills


# NEXT STEP: Run pytest, then build Agent 3: Matching & Scoring.
