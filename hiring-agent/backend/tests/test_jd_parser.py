from backend.agents.jd_parser import jd_parser_node, parse_jd_text


SAMPLE_JD = """
Senior Python Developer

We need a developer with 3+ years of experience.
Responsibilities:
- Build APIs using Python and FastAPI
- Collaborate with frontend engineers using React
- Maintain SQLite-backed internal tools

Nice to have: LangGraph and NLP experience.
"""


def test_parse_jd_text_without_llm() -> None:
    parsed = parse_jd_text(SAMPLE_JD, use_llm=False)

    assert parsed.title == "Senior Python Developer"
    assert "python" in parsed.required_skills
    assert "fastapi" in parsed.required_skills
    assert "3+ years of experience" in parsed.experience_level.lower()


def test_jd_parser_node_returns_state_update() -> None:
    result = jd_parser_node({"jd_text": SAMPLE_JD, "errors": [], "use_llm": False})

    assert "jd_parsed" in result
    assert "errors" in result
    assert result["jd_parsed"]["title"]


def test_parse_jd_infers_skills_from_vague_stack_phrase() -> None:
    parsed = parse_jd_text("MERN Stack Developer\nBuild hiring dashboards.", use_llm=False)

    assert "mongodb" in parsed.required_skills
    assert "express" in parsed.required_skills
    assert "react" in parsed.required_skills
    assert "node.js" in parsed.required_skills
