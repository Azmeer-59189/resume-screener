from typing import Any

from pydantic import BaseModel, Field


class PipelineRunRequest(BaseModel):
    """Request body for running the full hiring-agent pipeline."""

    jd_text: str = Field(min_length=1)
    resumes_raw: list[Any] = Field(default_factory=list)
    use_llm: bool = True
    use_embeddings: bool = True


class PipelineRunResponse(BaseModel):
    """Response body returned by the full hiring-agent pipeline."""

    jd_text: str
    jd_parsed: dict[str, Any]
    resumes_raw: list[Any]
    resumes_parsed: list[dict[str, Any]]
    scores: list[dict[str, Any]]
    bias_flags: dict[str, Any]
    interview_questions: list[dict[str, Any]]
    errors: list[str]
    use_llm: bool
    use_embeddings: bool


class JobEnrichmentRequest(BaseModel):
    """Request body for enriching a sparse job post."""

    title: str = Field(min_length=1)
    description: str = ""
    requirements: list[str] = Field(default_factory=list)
    required_skills: list[str] = Field(default_factory=list)
    nice_to_have_skills: list[str] = Field(default_factory=list)
    experience_level: str = "Not specified"
    use_llm: bool = True


class JobEnrichmentResponse(BaseModel):
    """AI-enriched job profile used by the main HR app."""

    title: str
    description: str
    requirements: list[str]
    required_skills: list[str]
    nice_to_have_skills: list[str]
    experience_level: str
    responsibilities: list[str]
    summary: str
    source: str
