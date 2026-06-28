# Multi-Agent Hiring Automation System

This project is a Python FastAPI and LangGraph service that powers the AI hiring workflow for the main ResumeAI app.

It can also run standalone for demos and tests.

## Complete Folder Structure

```text
hiring-agent/
  backend/
    agents/
      jd_parser.py
      resume_parser.py
      matcher.py
      bias_detector.py
      question_generator.py
    graph/
      pipeline.py
    api/
      routes.py
      models.py
    utils/
      pdf_reader.py
      embeddings.py
    main.py
  frontend/
    src/
      components/
      pages/
      App.jsx
    package.json
  requirements.txt
  README.md
```

## Step 1: Install Python Dependencies

From this folder:

```bash
python -m venv .venv
.venv\Scripts\activate
python -m pip install --upgrade pip
pip install -r requirements.txt
```

Use Python 3.11 or 3.12 for the smoothest Windows setup. Some AI/vector
database packages do not publish wheels for every Python version immediately.

## Step 2: Test The Backend Agents

```bash
pytest backend/tests
```

The expected count can change as new regressions are added. The current suite
covers individual agents, the LangGraph pipeline, API wiring, job enrichment,
bias false-positive filtering, and stable evidence-based scoring.

If you see a `RequestsDependencyWarning`, the tests can still pass. It usually
means one package version is newer than what `requests` expected. We can clean
that up later if it becomes noisy, but it is not blocking Agent 1.

## Step 3: LLM Setup

The service has fallback parsing so tests can pass without any LLM. For real
job enrichment, resume scoring, bias review, and question generation, choose one
provider.

### Option A: Groq Cloud API

Use this option if your laptop cannot install or run Ollama.

1. Create a Groq API key from the Groq console.
2. Set these environment variables in PowerShell:

```powershell
$env:LLM_PROVIDER="groq"
$env:GROQ_API_KEY="your_groq_api_key_here"
$env:LLM_MODEL="llama-3.1-8b-instant"
```

We use `llama-3.1-8b-instant` because Groq lists it as a production model and
it is lightweight enough for fast development.

### Option B: Local Ollama

```bash
ollama pull llama3.2:3b
ollama serve
```

Then set:

```powershell
$env:LLM_PROVIDER="ollama"
$env:LLM_MODEL="llama3.2:3b"
```

We use `llama3.2:3b` because it is more realistic for laptops and
machines with limited RAM/VRAM. Larger models can give better answers, but they
need more resources and may feel slow during development.

### No LLM Available

If neither Groq nor Ollama is configured, the parser agents fall back to simple
rule-based parsing. This keeps the app testable, but production scoring should
use an LLM because vague titles such as `MERN Stack Developer` need job-market
knowledge.

## ChromaDB Install Note

ChromaDB is part of the full Agent 3 plan, but we are adding it in a later
sub-step.

The current Agent 3 already scores candidates using semantic similarity and
skill overlap. ChromaDB will be added after this local scoring logic is working.

ChromaDB is intentionally kept in `requirements-vector.txt` so the first agents
can run without native C++ build tools.

When we reach Agent 3, install it with:

```bash
pip install -r requirements-vector.txt
```

If Windows shows `Microsoft Visual C++ 14.0 or greater is required`, use one of
these fixes:

1. Install Microsoft C++ Build Tools.
2. Recreate the virtual environment with Python 3.11, then install again.
3. Continue with the current lessons and install ChromaDB only when Agent 3
   needs it.

For now, skip `requirements-vector.txt`.

## What We Built First

1. `backend/utils/pdf_reader.py` reads PDF, TXT, and Markdown files.
2. `backend/agents/jd_parser.py` turns job description text into structured JSON.
3. `backend/tests/test_pdf_reader.py` tests document reading.
4. `backend/tests/test_jd_parser.py` tests Agent 1 in isolation.

## Agent 2: Resume Parser

`backend/agents/resume_parser.py` reads raw resume text and extracts:

- candidate name
- email
- phone
- skills
- years of experience
- work experience
- education
- projects
- summary

Like Agent 1, it has two paths:

- LLM path: uses Groq or Ollama through environment variables
- fallback path: uses simple regex/rule-based parsing for tests

Test it with:

```bash
pytest backend/tests
```

## Agent 3: Matching & Scoring

`backend/agents/matcher.py` compares each parsed resume against the parsed job
description and returns:

- score out of 100
- semantic score
- skill score
- matched skills
- missing required skills
- reasoning

When `use_llm=True`, the LLM does **not** decide the final numeric score. It
only verifies evidence:

- which required skills are supported by the resume
- which required skills are missing
- why the candidate does or does not fit

The final score is then calculated deterministically in code:

```text
Final score = AI-verified required skills * 75% + semantic evidence * 25%
```

This prevents unstable results where the same CV can receive widely different
scores across repeated runs.

When `use_llm=False`, the fallback score uses deterministic skill overlap and
semantic similarity.

`backend/utils/embeddings.py` supports two modes:

- real mode: `sentence-transformers/all-MiniLM-L6-v2`
- test mode: deterministic lexical similarity with no model download

This is not intended to be a basic ATS keyword counter. Skill overlap is one
signal, but semantic evidence and LLM-verified support help handle vague job
titles and vague CVs.

## Agent 4: Bias Detection

`backend/agents/bias_detector.py` reviews the job description and matcher
reasoning for potentially biased language or criteria.

It looks for risk categories such as:

- gender bias
- age bias
- nationality or citizenship bias
- disability bias
- family or marital status bias
- vague proxy criteria such as culture fit

The detector also filters common LLM false positives. It should not flag normal
technology stacks, city names, ordinary years-of-experience requirements, or
candidate names as bias by themselves.

The output includes:

- whether bias risk was found
- a list of flags
- severity
- explanation
- suggested neutral wording

Important: this agent flags possible risk for human review. It does not make
legal decisions and it should not be treated as legal advice.

## Agent 5: Interview Question Generator

`backend/agents/question_generator.py` takes the top 3 scored candidates and
generates 5 tailored interview questions for each one.

It uses:

- the parsed job description
- the candidate's parsed resume
- the candidate's score and missing skills

Each question includes:

- question text
- category: technical or behavioral
- rationale explaining why the question matters

The fallback generator is deterministic for tests. Real runs can use Groq or
Ollama for richer question wording.

If a candidate is a poor match or the resume appears to be from the wrong field,
the generator asks gap-verification questions instead of pretending the resume
is a good fit.

## LangGraph Pipeline

`backend/graph/pipeline.py` connects all five agents in one sequential
StateGraph:

1. JD Parser
2. Resume Parser
3. Matcher
4. Bias Detector
5. Interview Question Generator

Use `run_hiring_pipeline(..., use_llm=False, use_embeddings=False)` for a fully
local deterministic run in tests or demos.

## API Pipeline Endpoint

`backend/api/routes.py` exposes the full LangGraph pipeline through:

```text
POST /api/pipeline/run
```

Request body:

```json
{
  "jd_text": "Backend Engineer...",
  "resumes_raw": [
    {
      "source_file": "candidate.pdf",
      "text": "Candidate resume text..."
    }
  ],
  "use_llm": false,
  "use_embeddings": false
}
```

The response includes parsed JD data, parsed resumes, ranked scores, bias flags,
interview questions, and collected errors.

## Job Enrichment Endpoint

`backend/api/routes.py` also exposes:

```text
POST /api/jobs/enrich
```

This endpoint turns a sparse job draft into a fuller job profile. For example,
`MERN Stack Developer` can be expanded into concrete required skills such as
MongoDB, Express, React, Node.js, and JavaScript.

The main Node backend uses this endpoint before saving jobs when:

```env
HIRING_AGENT_ENRICH_JOBS=true
HIRING_AGENT_ENRICH_JOBS_USE_LLM=true
```

## Current Build Status

- Done: folder structure
- Done: `requirements.txt`
- Done: PDF reader utility
- Done: Agent 1, JD Parser
- Done: isolated tests for the PDF reader and JD Parser
- Done: Agent 2, Resume Parser
- Done: isolated tests for the Resume Parser
- Done: Agent 3, Matching & Scoring, stage 1
- Done: isolated tests for the Matcher
- Done: Agent 4, Bias Detection
- Done: isolated tests for Bias Detection
- Done: Agent 5, Interview Question Generator
- Done: isolated tests for Interview Question Generator
- Done: LangGraph StateGraph pipeline
- Done: end-to-end local pipeline tests
- Done: API endpoint for the full LangGraph pipeline
- Done: API endpoint tests
- Done: Frontend runner wired to the pipeline endpoint
- Done: Job enrichment endpoint
- Done: Node backend integration
- Done: AI-preferred job profile scoring
- Done: deterministic final scoring from LLM-verified evidence
- Done: bias false-positive filtering
- Next: Quality review with varied real CV/JD samples

## Common Student Mistakes

- Calling an LLM directly inside every test. Tests become slow and fragile.
- Trusting model output without validation. We use Pydantic to enforce shape.
- Assuming all PDFs contain text. Some PDFs are scanned images and need OCR.
- Forgetting that one bad resume should not crash the whole batch.
- Downloading embedding models inside every test. Tests should stay offline.
- Treating bias flags as final legal judgments instead of review signals.
- Asking generic interview questions that ignore the actual resume.
- Letting the LLM invent the final numeric score instead of computing it from
  validated evidence.

# NEXT STEP: Run a quality review set with real CVs and compare ranking stability.
