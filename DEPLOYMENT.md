# One-project Vercel deployment

## Live deployment

- App: https://resume-screener-henna-ten.vercel.app/
- Backend health: https://resume-screener-henna-ten.vercel.app/health
- API documentation: https://resume-screener-henna-ten.vercel.app/api-docs
- Production branch: `main`

Set `CLIENT_URL=https://resume-screener-henna-ten.vercel.app` in Vercel and
redeploy after changing environment variables. Leave `HIRING_AGENT_URL` unset
so the Node API calls the Python function in the same deployment.

Pushes to `main` trigger production deployments when the Git integration is enabled.
The frontend install explicitly includes development dependencies so Vite is
available even when `NODE_ENV=production`. Keep the commands in `vercel.json`;
remove conflicting dashboard overrides.

This repository serves React, Express, and the Python hiring pipeline through one
Vercel project. MongoDB Atlas remains external and stores both records and private
resume files (GridFS). No separate Python host or storage account is required.

## Accounts and settings

1. Create a MongoDB Atlas free cluster, a database user, and allow the deployment's
   outbound connections in Atlas Network Access. Prefer restricted addresses where
   available. Copy the driver connection string, including a database name.
2. Import the GitHub repository into Vercel. Use the repository root, not `client`
   or `server`, and select the Other framework preset. Keep the commands from
   `vercel.json`. Use Node 24 and Fluid Compute with a 300-second function duration.
3. Add the following environment variables in Vercel. Never upload local `.env` files.

```env
NODE_ENV=production
MONGODB_URI=mongodb+srv://USER:PASSWORD@CLUSTER/resumeai
JWT_SECRET=GENERATE_A_RANDOM_SECRET
AGENT_INTERNAL_SECRET=GENERATE_A_DIFFERENT_RANDOM_SECRET
CLIENT_URL=https://YOUR-PROJECT.vercel.app
HIRING_AGENT_USE_LLM=true
HIRING_AGENT_USE_EMBEDDINGS=false
HIRING_AGENT_ENRICH_JOBS=true
HIRING_AGENT_ENRICH_JOBS_USE_LLM=true
HIRING_AGENT_TIMEOUT_MS=180000
LLM_PROVIDER=groq
LLM_MODEL=openai/gpt-oss-120b
GROQ_API_KEY=YOUR_GROQ_KEY
```

Generate each secret separately with:

```powershell
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Leave `HIRING_AGENT_URL` unset: the backend derives the Python URL from Vercel's
deployment hostname. Do not copy `localhost` settings from your development `.env`.
If deployment protection is enabled, configure a Vercel automation bypass secret
and expose it to functions as `VERCEL_AUTOMATION_BYPASS_SECRET` so Node can call
Python. `AGENT_INTERNAL_SECRET` separately authenticates that Python request.

The Vercel pipeline falls back directly to local scoring if the agent fails, avoiding
additional provider calls near the function deadline. Gemini/Pinecone remain optional
for local development and the explicit vector-matching endpoint. SMTP settings from
`server/.env.example` are optional; verify outbound SMTP with your hosting account
before relying on email. A missing email configuration does not prevent status changes.

4. Deploy, set `CLIENT_URL` to your actual frontend domain, and redeploy if changed.

## Smoke test

Analysis status is stored separately from the recruiter's application status.
The candidate list refreshes every 20 seconds while analysis is pending. Runs
that do not finish within six minutes are shown as interrupted and can be retried.
Retries claim the application atomically; a newer attempt supersedes an expired
attempt so its score cannot be overwritten by the older run. This is not a durable
queue: manual retry is still needed after a function is terminated.

Open **Why this score?** to see quotations from the extracted resume. A direct
mention establishes that the text occurs in the document, not the candidate's
proficiency. Matches without a direct mention are marked as inferred. Existing
applications collect quotations when **Run analysis again** is used.

With `HIRING_AGENT_USE_LLM=true`, the matcher asks the configured LLM to assess
3–6 responsibilities from the job against the original CV's projects and work.
The job title need not occur in the CV. Supported responsibilities must include
an exact quotation found in the extracted CV; invented quotations are rejected.
The AI path's context component measures this responsibility coverage, not lexical
word overlap. Explicit required skills still contribute 75% and role evidence 25%;
if there are no separately defined skill requirements, role evidence contributes
100%. These are review signals, not guarantees of proficiency.

The recruiter sees **AI role assessment** in the score explanation. If the model
cannot return a usable assessment, the result is explicitly shown as a local
fallback with an analysis warning. Reprocess older applications to use this path.

- `/health` returns HTTP 200 and `/agent/health` returns HTTP 401 without its secret.
- Register a recruiter, create a job, and open its application link in incognito.
- Apply with a text PDF under 4 MB. Keep the tab open: analysis is awaited within
  the request on Vercel rather than launched as untracked background work.
- Review the score and download the resume as the owning recruiter.
- Click a candidate's name to open their detail page. Preview a PDF, save notes,
  and verify a different recruiter cannot access the page or its data.
- Open **Pipeline board**, move an applicant to Reviewing, and check the new
  history entry on their detail page. Stage menus also work without dragging.
  Shortlist/rejection moves require confirmation before attempting notification.
  Existing applicants have no backfilled stage history; new moves are recorded.
- Select two or three applicants and click **Compare candidates**. Check that
  selection survives filters, evidence can be expanded, and pending applicants
  show no numeric score. Closing the comparison returns to the candidate list.
- Download it again after a redeployment to verify GridFS persistence.
- A different recruiter must not access that job's candidates or resume downloads.
- Reprocess an application, then delete a test job and verify its GridFS files
  and related records are removed.

## Limits and behavior

- Vercel requests and responses are limited to 4.5 MB. This deployment intentionally
  caps resume files at 4 MB to leave multipart overhead. Local uploads remain 10 MB.
  Supporting larger files requires direct-to-storage uploads and signed downloads.
- Files count toward Atlas storage limits, including GridFS and document overhead.
  Existing local uploads are not migrated; local files must be migrated before
  moving an existing database to this deployment.
- Python dependencies exclude local transformer models. Keep embeddings disabled;
  Groq handles LLM requests and lexical similarity remains available.
- Poppler binaries are not installed on Vercel. Text-based PDFs use pdf-parse;
  scanned PDF OCR needs Poppler and is not supported by this deployment. Prefer
  text PDFs, DOCX, or TXT for the hosted demo. Image OCR may need runtime downloads.
- Function deadlines can still interrupt very slow analysis. A saved application
  retains its record and can be reprocessed by the recruiter. This is request-bound
  processing, not a durable queue or an automatic retry system.
- Free hosting and external provider quotas apply. Vercel Hobby is for personal,
  non-commercial projects. A deployed end-to-end test is required before real use.

Local startup commands remain the same; `node server/src/app.js` still starts the
Express server, and the existing Python service still runs with uvicorn.
