from fastapi import APIRouter

from backend.agents.jd_parser import parse_jd_text
from backend.api.models import (
    JobEnrichmentRequest,
    JobEnrichmentResponse,
    PipelineRunRequest,
    PipelineRunResponse,
)
from backend.graph.pipeline import run_hiring_pipeline


router = APIRouter(prefix="/api", tags=["pipeline"])


@router.post("/pipeline/run", response_model=PipelineRunResponse)
def run_pipeline(request: PipelineRunRequest) -> PipelineRunResponse:
    """Run the full LangGraph hiring pipeline for one JD and resume batch."""
    result = run_hiring_pipeline(
        request.jd_text,
        request.resumes_raw,
        use_llm=request.use_llm,
        use_embeddings=request.use_embeddings,
    )
    return PipelineRunResponse.model_validate(result)


@router.post("/jobs/enrich", response_model=JobEnrichmentResponse)
def enrich_job(request: JobEnrichmentRequest) -> JobEnrichmentResponse:
    """Infer a fuller job profile from a sparse title or draft JD."""
    draft_text = "\n\n".join([
        request.title,
        request.description,
        "\n".join(request.requirements),
        "Required skills: " + ", ".join(request.required_skills) if request.required_skills else "",
        "Nice to have: " + ", ".join(request.nice_to_have_skills) if request.nice_to_have_skills else "",
        f"Experience level: {request.experience_level}" if request.experience_level else "",
    ]).strip()

    parsed = parse_jd_text(draft_text, use_llm=request.use_llm)

    description = request.description.strip() or parsed.summary or (
        f"{parsed.title} role focused on {', '.join(parsed.required_skills[:5])}."
    )
    requirements = request.requirements or parsed.must_have_requirements or parsed.responsibilities
    required_skills = request.required_skills or parsed.required_skills
    nice_to_have_skills = request.nice_to_have_skills or parsed.nice_to_have_skills

    return JobEnrichmentResponse(
        title=request.title.strip() or parsed.title,
        description=description,
        requirements=requirements,
        required_skills=required_skills,
        nice_to_have_skills=nice_to_have_skills,
        experience_level=request.experience_level or parsed.experience_level,
        responsibilities=parsed.responsibilities,
        summary=parsed.summary,
        source="llm" if request.use_llm else "fallback",
    )
