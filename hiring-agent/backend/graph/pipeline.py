from typing import Any, NotRequired, TypedDict

from langgraph.graph import END, StateGraph

from backend.agents.bias_detector import bias_detector_node
from backend.agents.jd_parser import jd_parser_node
from backend.agents.matcher import matcher_node
from backend.agents.question_generator import question_generator_node
from backend.agents.resume_parser import resume_parser_node


class HiringPipelineState(TypedDict):
    """Shared state passed through the full hiring-agent pipeline."""

    jd_text: str
    jd_parsed: dict[str, Any]
    resumes_raw: list[Any]
    resumes_parsed: list[dict[str, Any]]
    scores: list[dict[str, Any]]
    bias_flags: dict[str, Any]
    interview_questions: list[dict[str, Any]]
    errors: list[str]
    use_llm: NotRequired[bool]
    use_embeddings: NotRequired[bool]


def create_hiring_pipeline():
    """Build and compile the LangGraph pipeline for all five agents."""
    graph = StateGraph(HiringPipelineState)

    graph.add_node("jd_parser", jd_parser_node)
    graph.add_node("resume_parser", resume_parser_node)
    graph.add_node("matcher", matcher_node)
    graph.add_node("bias_detector", bias_detector_node)
    graph.add_node("question_generator", question_generator_node)

    graph.set_entry_point("jd_parser")
    graph.add_edge("jd_parser", "resume_parser")
    graph.add_edge("resume_parser", "matcher")
    graph.add_edge("matcher", "bias_detector")
    graph.add_edge("bias_detector", "question_generator")
    graph.add_edge("question_generator", END)

    return graph.compile()


def build_initial_state(
    jd_text: str,
    resumes_raw: list[Any],
    *,
    use_llm: bool = True,
    use_embeddings: bool = True,
) -> HiringPipelineState:
    """Create a complete initial state with empty downstream outputs."""
    return {
        "jd_text": jd_text,
        "jd_parsed": {},
        "resumes_raw": resumes_raw,
        "resumes_parsed": [],
        "scores": [],
        "bias_flags": {},
        "interview_questions": [],
        "errors": [],
        "use_llm": use_llm,
        "use_embeddings": use_embeddings,
    }


def run_hiring_pipeline(
    jd_text: str,
    resumes_raw: list[Any],
    *,
    use_llm: bool = True,
    use_embeddings: bool = True,
) -> HiringPipelineState:
    """Run the full JD-to-interview-question pipeline."""
    pipeline = create_hiring_pipeline()
    initial_state = build_initial_state(
        jd_text,
        resumes_raw,
        use_llm=use_llm,
        use_embeddings=use_embeddings,
    )
    return pipeline.invoke(initial_state)
