# ResumeAI - AI Resume Screener

ResumeAI is a full-stack recruitment application that lets recruiters publish jobs, share public application links, parse uploaded PDF resumes, and rank candidates against job requirements. It also includes an optional Python LangGraph hiring-agent service for AI job enrichment, AI-verified scoring, bias review, and interview-question generation.

Candidates do not need an account. They open a job link, enter their contact details, and upload a CV. Recruiters can then review ranked applications, inspect score reasoning, download resumes, and update application statuses.

## Features

- Recruiter registration and JWT authentication
- Job posting and shareable public application links
- AI job enrichment for sparse posts such as `MERN Stack Developer`
- Account-free candidate application form
- PDF text extraction and chunking
- Transparent `0-100` candidate scoring with AI-verified evidence
- Required-skill and semantic-evidence score breakdown
- Matched and missing skills
- Candidate strengths, weaknesses, and score reasoning
- Bias review with false-positive filtering for common safe terms such as tech stacks, locations, names, and normal experience requirements
- Tailored interview questions, including gap-verification questions for weak or wrong-field CVs
- Python LangGraph pipeline for JD parsing, resume parsing, matching, bias detection, and question generation
- Optional Gemini and Pinecone semantic analysis
- Reliable local scoring fallback when external AI services are unavailable
- Recruiter-only resume downloads
- Application shortlisting and rejection
- Recruiter-approved shortlist and rejection emails
- Recruiter search, score filters, notes, status tracking, and CSV export
- Application deadline enforcement and PDF signature validation
- Safe job deletion with related application, resume, file, and vector cleanup
- Automatic local re-scoring after job requirement updates
- MongoDB storage with resumes grouped by job

## Technology

### Frontend

- React 18
- Vite
- React Router
- Axios
- Tailwind CSS

### Backend

- Node.js
- Express
- MongoDB and Mongoose
- JWT and bcrypt
- Multer
- `pdf-parse` and Poppler
- Google Gemini
- Pinecone

### Hiring Agent

- Python 3.11 or 3.12
- FastAPI
- LangGraph
- Pydantic
- Groq or Ollama for optional LLM calls
- Sentence Transformers for optional embedding similarity

## Project structure

```text
resume-screener/
|-- client/                 React frontend
|-- server/
|   |-- scripts/            Database and score maintenance scripts
|   |-- src/
|   |   |-- controllers/
|   |   |-- middleware/
|   |   |-- models/
|   |   |-- routes/
|   |   `-- services/
|   `-- uploads/            Local CV storage; ignored by Git
|-- hiring-agent/
|   |-- backend/
|   |   |-- agents/         JD parser, resume parser, matcher, bias detector, question generator
|   |   |-- api/            FastAPI routes
|   |   |-- graph/          LangGraph orchestration
|   |   `-- utils/          LLM, embeddings, PDF, and skill inference helpers
|   `-- frontend/           Small standalone pipeline runner
`-- README.md
```

## How scoring works

ResumeAI supports two scoring modes.

### Hiring-agent AI mode

When `HIRING_AGENT_URL` is configured and `HIRING_AGENT_USE_LLM=true`, the Node backend sends the job and CV text to the Python hiring-agent service.

The hiring-agent pipeline:

1. Parses or enriches the job description.
2. Parses the resume.
3. Uses the LLM to verify evidence for required skills and gaps.
4. Computes the final score deterministically in code.
5. Reviews bias risk.
6. Generates interview questions.

The LLM does **not** directly decide the final numeric score. It verifies evidence, then the application calculates:

```text
Final score = AI-verified required skills * 75% + semantic evidence * 25%
```

This prevents unstable scores such as the same CV receiving very different results across reprocessing runs.

The application stores:

- Skill coverage score
- Semantic evidence score
- Matched and missing skills
- Strengths and weaknesses
- Human-readable score reasoning
- Bias flags
- Interview questions
- Scoring method: `agent`

### Fallback modes

If the Python hiring-agent is unavailable, the Node backend falls back to the existing Gemini/Pinecone flow, then to local scoring if external AI services are unavailable. Local scoring still exists as a reliability fallback, but it is not the preferred ranking path when the hiring-agent is configured.

Fallback scoring methods are stored as `local`, `ai`, or `vector`.

Scores are decision-support signals and should not replace recruiter review.

## Database

The default local database is:

```text
mongodb://localhost:27017/resume_screener_hiring_portal
```

Collections:

| Collection | Purpose |
| --- | --- |
| `users` | Recruiter accounts and internal candidate contact records |
| `jobs` | Job descriptions, requirements, skills, and status |
| `resumes` | PDF location, parsed text, chunks, and readable job identifiers |
| `applications` | Job-to-candidate relationship, score, reasoning, bias review, interview questions, and recruiter status |

Resume records include `jobId` and `jobTitle`, making them easy to filter in MongoDB Compass:

```javascript
{ jobTitle: "Senior Python Developer" }
```

## Local setup

Requirements:

- Node.js 18 or newer
- MongoDB running locally
- Poppler available for PDF extraction
- Python 3.11 or 3.12 for the optional hiring-agent service
- Groq API key or local Ollama for LLM-powered enrichment and scoring
- Gemini and Pinecone credentials for optional legacy semantic analysis

### 1. Clone the repository

```bash
git clone https://github.com/Azmeer-59189/resume-screener.git
cd resume-screener
```

### 2. Configure the backend

```bash
cd server
npm install
```

Copy `.env.example` to `.env` and configure it:

```env
PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/resume_screener_hiring_portal
JWT_SECRET=replace_with_a_long_random_secret
REFRESH_TOKEN_SECRET=replace_with_a_different_long_random_secret
CLIENT_URL=http://localhost:5173

GEMINI_API_KEY=your_gemini_api_key_here
PINECONE_API_KEY=your_pinecone_api_key_here
PINECONE_INDEX=resume-screener
GROQ_API_KEY=your_groq_api_key_here

HIRING_AGENT_URL=http://127.0.0.1:8000
HIRING_AGENT_TIMEOUT_MS=30000
HIRING_AGENT_USE_LLM=true
HIRING_AGENT_USE_EMBEDDINGS=false
HIRING_AGENT_ENRICH_JOBS=true
HIRING_AGENT_ENRICH_JOBS_USE_LLM=true
HIRING_AGENT_JOB_PROFILE_MODE=ai_preferred
HIRING_AGENT_SHOW_BASELINE=false

LLM_PROVIDER=groq
LLM_MODEL=llama-3.1-8b-instant
```

Start the API:

```bash
npm run dev
```

### 3. Start the hiring-agent service

Open another terminal:

```bash
cd hiring-agent
python -m venv .venv
.venv\Scripts\activate
python -m pip install --upgrade pip
pip install -r requirements.txt
uvicorn backend.main:app --reload --port 8000
```

The hiring-agent reads LLM settings from environment variables, `hiring-agent/.env`, or `server/.env`.

### 4. Start the frontend

Open another terminal:

```bash
cd client
npm install
npm run dev
```

Open:

```text
http://localhost:5173
```

### Optional: standalone hiring-agent UI

The small pipeline runner can be started separately:

```bash
cd hiring-agent/frontend
npm install
npm run dev -- --host 127.0.0.1 --port 5174
```

Open:

```text
http://127.0.0.1:5174
```

## Verification

Run the backend test suite:

```bash
cd server
npm test
```

Run the hiring-agent test suite:

```bash
cd hiring-agent
.venv\Scripts\activate
pytest backend/tests
```

Build the frontend for production:

```bash
cd client
npm run build
```

The automated tests cover local fallback scoring, hiring-agent mapping, PDF upload validation, email generation, and the OpenAPI document. The hiring-agent tests cover the individual agents, LangGraph pipeline, API endpoint, bias false-positive filtering, and deterministic evidence-based score calculation.

## Swagger API documentation

With the backend running, open the interactive Swagger UI:

```text
http://localhost:5000/api-docs
```

The raw OpenAPI document is available at:

```text
http://localhost:5000/api-docs/openapi.json
```

To test recruiter-only endpoints:

1. Run `POST /api/auth/login` in Swagger.
2. Copy the returned JWT token.
3. Click **Authorize**.
4. Paste the token without adding the `Bearer` prefix.

Public job and candidate-application endpoints do not require authorization.

## Candidate email notifications

When a recruiter approves changing an application to `shortlisted` or `rejected`, the backend sends a status email to the candidate. Successful notifications are stored on the application record so the same status email is not sent twice.

Add SMTP settings to `server/.env`:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password
MAIL_FROM="ResumeAI Hiring <your_email@gmail.com>"
MAIL_REPLY_TO=your_email@gmail.com
```

For Gmail, use an App Password rather than the normal account password. If SMTP is not configured or delivery fails, the application status is still saved and the recruiter sees a delivery warning.

## Maintenance scripts

Run these commands inside `server/`:

```bash
# Recalculate all application scores
npm run scores:recalculate

# Add job identifiers to older resume records
npm run resumes:backfill-jobs

# Copy relevant records from the former shared database
npm run db:separate
```

The migration scripts should only be run when required.

## Reprocessing applications

Applications created before hiring-agent integration may still contain older local, Gemini, or vector scores. Re-run AI processing for an application from the recruiter view or through:

```text
POST /api/applications/{id}/reprocess
```

New scores are produced by the hiring-agent when the Python service is running and `HIRING_AGENT_USE_LLM=true`.

## Production deployment

The frontend sends API requests to `/api`. In production, configure the web server or hosting platform to:

- Serve the built frontend from `client/dist`.
- Proxy `/api` requests to the Express backend.
- Run the Python hiring-agent as a separate service and set `HIRING_AGENT_URL` to its private service URL.
- Set `CLIENT_URL` to the public frontend origin.
- Provide production values for `MONGODB_URI`, `JWT_SECRET`, `REFRESH_TOKEN_SECRET`, LLM provider keys, and any enabled SMTP services.
- Use HTTPS and private object storage for uploaded resumes.

The backend also exposes `GET /health` for deployment health checks.

## Privacy and security

- `.env` files are excluded from Git.
- Uploaded resumes are excluded from Git.
- Resume downloads require recruiter authentication.
- AI scoring and bias review are decision-support tools; recruiters should review evidence before making decisions.
- CVs contain personal information; production deployments should use private object storage, retention rules, backups, and an applicant privacy notice.

## Current limitations

- Uploaded PDFs are stored on the local server filesystem.
- Scanned-image CVs may require a complete OCR fallback.
- Hiring-agent scoring depends on the configured LLM provider when `HIRING_AGENT_USE_LLM=true`.
- Existing applications must be reprocessed to receive the latest hiring-agent output.
- Candidate emails require valid SMTP credentials and are only sent for recruiter-approved `shortlisted` and `rejected` status changes.
- Automated coverage currently focuses on scoring and upload validation; route-level integration tests are still limited.
- The project does not yet include an automated CI pipeline.
- Production hosting, object storage, backups, retention rules, and monitoring must be configured separately.

## License

The backend package declares the ISC license. Add a root `LICENSE` file before distributing the project under that license.
