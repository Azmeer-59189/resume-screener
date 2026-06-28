from fastapi.testclient import TestClient

from backend.main import app


client = TestClient(app)


def test_health_check() -> None:
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_pipeline_run_endpoint_without_llm() -> None:
    response = client.post(
        "/api/pipeline/run",
        json={
            "jd_text": """
Backend Engineer
Required skills: Python, FastAPI, SQLite.
Build APIs for hiring automation.
""",
            "resumes_raw": [
                {
                    "source_file": "ayesha.pdf",
                    "text": """
Ayesha Khan
ayesha@example.com
Skills: Python, FastAPI, SQLite, Docker.
Built a resume screening API.
""",
                }
            ],
            "use_llm": False,
            "use_embeddings": False,
        },
    )

    body = response.json()

    assert response.status_code == 200
    assert body["errors"] == []
    assert body["jd_parsed"]["title"] == "Backend Engineer"
    assert len(body["resumes_parsed"]) == 1
    assert body["scores"][0]["candidate_name"] == "Ayesha Khan"
    assert body["bias_flags"]["has_bias_risk"] is False
    assert len(body["interview_questions"]) == 1
    assert len(body["interview_questions"][0]["questions"]) == 5
