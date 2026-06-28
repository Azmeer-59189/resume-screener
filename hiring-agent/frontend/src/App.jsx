import { useMemo, useState } from "react";

const sampleJd = `Backend Engineer
Required skills: Python, FastAPI, SQLite.
Build APIs for hiring automation.
Responsibilities:
- Design reliable API endpoints
- Parse and rank candidate profiles
- Collaborate with recruiters on workflow improvements`;

const sampleResume = `Ayesha Khan
ayesha@example.com
Skills: Python, FastAPI, SQLite, Docker.
Built a resume screening API and candidate ranking dashboard.
Worked as a backend engineer on hiring automation tools.`;

function splitResumeBlocks(text) {
  return text
    .split(/\n\s*---\s*\n/g)
    .map((block, index) => ({
      source_file: `candidate_${index + 1}.txt`,
      text: block.trim(),
    }))
    .filter((resume) => resume.text.length > 0);
}

function joinList(items) {
  return items?.length ? items.join(", ") : "None";
}

export default function App() {
  const [jdText, setJdText] = useState(sampleJd);
  const [resumeText, setResumeText] = useState(sampleResume);
  const [useLlm, setUseLlm] = useState(false);
  const [useEmbeddings, setUseEmbeddings] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [isRunning, setIsRunning] = useState(false);

  const resumes = useMemo(() => splitResumeBlocks(resumeText), [resumeText]);

  async function runPipeline(event) {
    event.preventDefault();
    setError("");
    setResult(null);
    setIsRunning(true);

    try {
      const response = await fetch("/api/pipeline/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jd_text: jdText,
          resumes_raw: resumes,
          use_llm: useLlm,
          use_embeddings: useEmbeddings,
        }),
      });

      const body = await response.json();
      if (!response.ok) {
        throw new Error(body.detail || "Pipeline request failed.");
      }

      setResult(body);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Pipeline request failed.",
      );
    } finally {
      setIsRunning(false);
    }
  }

  return (
    <main className="page">
      <section className="shell">
        <form
          onSubmit={runPipeline}
          className="panel form-panel"
        >
          <div className="form-header">
            <div>
              <h1>Hiring Agent</h1>
              <p className="intro small muted">
                Run the full LangGraph pipeline against a JD and resume batch.
              </p>
            </div>
            <button
              type="submit"
              disabled={isRunning || !jdText.trim() || resumes.length === 0}
              className="button"
            >
              {isRunning ? "Running" : "Run"}
            </button>
          </div>

          <div className="field">
            <label className="field-label" htmlFor="jd-text">
              Job description
            </label>
            <textarea
              id="jd-text"
              value={jdText}
              onChange={(event) => setJdText(event.target.value)}
              className="textarea"
            />
          </div>

          <div className="field">
            <label className="field-label" htmlFor="resume-text">
              Resumes
            </label>
            <textarea
              id="resume-text"
              value={resumeText}
              onChange={(event) => setResumeText(event.target.value)}
              className="textarea resume"
            />
          </div>
          <p className="small muted">
            Separate multiple resumes with a line containing only ---
          </p>

          <div className="toggle-row">
            <label className="toggle">
              <input
                type="checkbox"
                checked={useLlm}
                onChange={(event) => setUseLlm(event.target.checked)}
              />
              Use LLM
            </label>
            <label className="toggle">
              <input
                type="checkbox"
                checked={useEmbeddings}
                onChange={(event) => setUseEmbeddings(event.target.checked)}
              />
              Use embeddings
            </label>
          </div>
        </form>

        <section className="results">
          {error && (
            <div className="panel result-panel error">
              {error}
            </div>
          )}

          {!result && !error && (
            <div className="panel ready-panel">
              <h2>Ready</h2>
              <p className="small muted">
                The deterministic defaults are off for LLMs and embeddings so local
                demos stay predictable.
              </p>
            </div>
          )}

          {result && (
            <>
              <div className="panel result-panel">
                <div className="title-row">
                  <div>
                    <h2>
                      {result.jd_parsed?.title || "Parsed Job"}
                    </h2>
                    <p className="small muted">
                      Required skills: {joinList(result.jd_parsed?.required_skills)}
                    </p>
                  </div>
                  <span className="pill">
                    {result.scores.length} candidate{result.scores.length === 1 ? "" : "s"}
                  </span>
                </div>
              </div>

              <div className="panel result-panel">
                <h2>Ranking</h2>
                <div className="card-list">
                  {result.scores.map((score) => (
                    <article
                      key={`${score.source_file}-${score.candidate_name}`}
                      className="candidate-card"
                    >
                      <div className="candidate-head">
                        <h3>{score.candidate_name}</h3>
                        <strong className="score">
                          {score.score}
                        </strong>
                      </div>
                      <p className="reasoning small muted">{score.reasoning}</p>
                      <dl className="match-grid">
                        <div>
                          <dt>Matched</dt>
                          <dd>{joinList(score.matched_skills)}</dd>
                        </div>
                        <div>
                          <dt>Missing</dt>
                          <dd>{joinList(score.missing_required_skills)}</dd>
                        </div>
                      </dl>
                    </article>
                  ))}
                </div>
              </div>

              <div className="panel result-panel">
                <h2>Bias Review</h2>
                <p className="reasoning small muted">
                  {result.bias_flags?.summary || "No bias summary returned."}
                </p>
                {result.bias_flags?.flags?.length > 0 && (
                  <div className="card-list">
                    {result.bias_flags.flags.map((flag, index) => (
                      <div key={`${flag.category}-${index}`} className="flag">
                        <strong>{flag.category}</strong>: {flag.explanation}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="panel result-panel">
                <h2>Interview Questions</h2>
                <div>
                  {result.interview_questions.map((candidate) => (
                    <article className="question-block" key={candidate.source_file}>
                      <h3>{candidate.candidate_name}</h3>
                      <ol className="question-list">
                        {candidate.questions.map((question, index) => (
                          <li key={`${candidate.source_file}-${index}`}>
                            {question.question}
                            <span className="question-category">
                              {question.category}
                            </span>
                          </li>
                        ))}
                      </ol>
                    </article>
                  ))}
                </div>
              </div>

              {result.errors.length > 0 && (
                <div className="panel result-panel error">
                  <h2>Pipeline Errors</h2>
                  <ul>
                    {result.errors.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </section>
      </section>
    </main>
  );
}
