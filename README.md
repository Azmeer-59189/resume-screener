# ResumeAI - AI Resume Screener

ResumeAI is a full-stack recruitment application that lets recruiters publish jobs, share public application links, parse uploaded PDF resumes, and rank candidates against job requirements.

Candidates do not need an account. They open a job link, enter their contact details, and upload a CV. Recruiters can then review ranked applications, inspect score reasoning, download resumes, and update application statuses.

## Features

- Recruiter registration and JWT authentication
- Job posting and shareable public application links
- Account-free candidate application form
- PDF text extraction and chunking
- Transparent `0-100` candidate scoring
- Required-skill and job-context score breakdown
- Matched and missing skills
- Candidate strengths, weaknesses, and score reasoning
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
`-- README.md
```

## How scoring works

Every application receives an immediate local evidence score:

```text
Final score = Required skills * 75% + Job-context terms * 25%
```

The application stores:

- Skill coverage score
- Context coverage score
- Matched and missing skills
- Supporting terms found in the CV
- Strengths and weaknesses
- Human-readable score reasoning
- Scoring method: `local`, `ai`, or `vector`

Gemini and Pinecone can enrich the assessment when available. If either service fails, the local score remains available instead of returning an unexplained `0%`.

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
| `applications` | Job-to-candidate relationship, score, reasoning, and recruiter status |

Resume records include `jobId` and `jobTitle`, making them easy to filter in MongoDB Compass:

```javascript
{ jobTitle: "Senior Python Developer" }
```

## Local setup

Requirements:

- Node.js 18 or newer
- MongoDB running locally
- Poppler available for PDF extraction
- Gemini and Pinecone credentials for optional semantic analysis

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
```

Start the API:

```bash
npm run dev
```

### 3. Start the frontend

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

## Privacy and security

- `.env` files are excluded from Git.
- Uploaded resumes are excluded from Git.
- Resume downloads require recruiter authentication.
- CVs contain personal information; production deployments should use private object storage, retention rules, backups, and an applicant privacy notice.

## Current limitations

- Uploaded PDFs are stored on the local server filesystem.
- Scanned-image CVs may require a complete OCR fallback.
- Email notifications are not implemented.
- Automated coverage currently focuses on scoring and upload validation; route-level integration tests are still limited.

## License

This project currently uses the ISC license declared in the server package.
