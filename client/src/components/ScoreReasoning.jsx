import Icon from "./Icon";
import { analysisState, isScoreReady } from "../utils/candidateComparison";
const isUnscored = app => !isScoreReady(app);
const isPendingAi = app => ["queued", "processing"].includes(analysisState(app));
function DetailList({ title, items, tone }) {
  if (!items?.length) return null;
  const color = tone === "positive" ? "text-emerald-400" : "text-amber-400";
  return (
    <div>
      <h4 className={`text-xs font-semibold uppercase tracking-wide ${color}`}>{title}</h4>
      <ul className="mt-2 space-y-1.5">
        {items.map((item, index) => (
          <li key={`${item}-${index}`} className="text-xs text-slate-300 flex gap-2 leading-relaxed">
            <span className={color}>•</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Describe the second score component by what the scorer actually measured. */
function contextComponent(app, breakdown) {
  if (app.scoringMethod === "local") {
    return {
      title: "Job context terms",
      detail: `${breakdown.matchedTermCount ?? 0} of ${breakdown.totalTermCount ?? 0} role terms found in the CV`,
    };
  }
  if (app.scoringMethod === "agent") {
    return {
      title: app.roleAssessments?.length ? "Role responsibilities" : "Overall similarity",
      detail: app.roleAssessments?.length ? "AI assessment of demonstrated work and projects against this role" : "How closely the CV's overall content matches the job description",
    };
  }
  return { title: "Job context", detail: null };
}

function BreakdownTile({ title, weight, score, detail }) {
  return (
    <div className="rounded-lg bg-[#0D1B2A] border border-slate-800 p-3">
      <div className="flex justify-between text-xs">
        <span className="text-slate-400">{title} <span className="text-slate-500">· {weight ?? 0}% weight</span></span>
        <span className="text-white font-semibold tabular-nums">{score ?? 0}%</span>
      </div>
      <div className="mt-2 h-1 rounded-full bg-blue-500/15 overflow-hidden">
        <div className="h-full rounded-full bg-[#3987e5]" style={{ width: `${Math.max(0, Math.min(100, score ?? 0))}%` }} />
      </div>
      {detail && <p className="text-slate-500 text-xs mt-2">{detail}</p>}
    </div>
  );
}

function ScoreReasoning({ app }) {
  const breakdown = app.scoreBreakdown;
  const pendingAi = isPendingAi(app);
  const methodLabel = app.scoringMethod === "ai"
    ? "AI assessment"
    : app.scoringMethod === "vector"
      ? "Vector similarity"
      : app.scoringMethod === "agent"
        ? "Hiring Agent pipeline"
        : "Local evidence score";
  const context = breakdown ? contextComponent(app, breakdown) : null;
  if (isUnscored(app)) return (
    <p className="mt-5 border-t border-slate-800 pt-4 text-sm text-slate-300">
      {pendingAi ? "Resume analysis is in progress. This view updates automatically." : "Analysis did not finish. Retry analysis to get an updated score."}
    </p>
  );

  return (
    <div className="mt-5 pt-5 border-t border-slate-800">
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <span className="text-xs text-slate-500">Scoring method</span>
        <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
          {methodLabel}
        </span>
      </div>

      {analysisState(app) === "fallback" && <p className="mb-4 text-sm text-amber-300">
        {app.scoringMethod === "local" ? "AI analysis was unavailable. This is a local fallback score; retry analysis for an AI assessment." : "Some analysis steps did not complete. Review the result and retry if needed."}
      </p>}

      {breakdown && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          <BreakdownTile
            title="Required skills"
            weight={breakdown.skillWeight}
            score={breakdown.skillScore}
            detail={`${breakdown.matchedSkillCount ?? 0} of ${breakdown.totalSkillCount ?? 0} explicitly detected`}
          />
          <BreakdownTile
            title={context.title}
            weight={breakdown.contextWeight}
            score={breakdown.contextScore}
            detail={context.detail}
          />
          <p className="sm:col-span-2 text-xs text-slate-500">{breakdown.formula}</p>
        </div>
      )}

      {app.roleAssessments?.length > 0 && <div className="mb-5">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-blue-400">AI role assessment</h4>
        <p className="mt-1 text-xs text-slate-400">The job title does not need to appear in the CV. Review how the candidate’s work supports each responsibility.</p>
        <div className="mt-3 space-y-3">{app.roleAssessments.map((item, index) => <div key={index} className="rounded-lg border border-slate-800 p-3">
          <p className={`text-sm font-medium ${item.supported ? "text-emerald-300" : "text-amber-300"}`}>{item.criterion} - {item.supported ? "Supported" : "Not demonstrated"}</p>
          {item.resumeQuote && <blockquote className="mt-2 text-sm text-slate-300 whitespace-pre-wrap">{item.resumeQuote}</blockquote>}
          <p className="mt-2 text-xs text-slate-400">{item.explanation}</p>
        </div>)}</div>
      </div>}

      <div className="mb-4">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-blue-400">Resume evidence</h4>
        <p className="mt-1 text-xs text-slate-400">Direct mentions help verify a match; they do not establish proficiency or experience.</p>
        {!app.skillEvidence?.length && <p className="mt-2 text-xs text-slate-400">No quotations saved for this analysis. Run analysis again to collect evidence.</p>}
        <div className="mt-3 space-y-3">
          {(app.skillEvidence || []).map((evidence, index) => (
            <div key={`${evidence.skill}-${index}`} className="rounded-lg border border-slate-800 bg-[#0D1B2A] p-3">
              <p className="text-xs font-semibold text-slate-200">{evidence.skill} - {evidence.kind === "mention" ? "Direct resume mention" : "No direct mention found"}</p>
              {evidence.excerpt ? <blockquote className="mt-2 whitespace-pre-wrap text-sm text-slate-300">{evidence.excerpt}</blockquote>
                : <p className="mt-2 text-xs text-amber-300">The scorer inferred this match. Review the resume before relying on it.</p>}
            </div>
          ))}
        </div>
      </div>

      {app.aiAnalysis && (
        <div className="mb-4">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-blue-400">Reasoning</h4>
          <p className="text-sm text-slate-300 mt-2 leading-relaxed">{app.aiAnalysis}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <DetailList title="Strengths" items={app.strengths} tone="positive" />
        <DetailList title="Weaknesses / gaps" items={app.weaknesses} tone="warning" />
      </div>

      {(app.matchedSkills?.length > 0 || app.missingSkills?.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <div>
            <p className="text-xs text-slate-500 mb-2">Matched required skills</p>
            <div className="flex flex-wrap gap-1.5">
              {app.matchedSkills?.map((skill) => <SkillChip key={skill} skill={skill} matched />)}
            </div>
          </div>
          <div>
            <p className="text-xs text-slate-500 mb-2">Missing or not demonstrated</p>
            <div className="flex flex-wrap gap-1.5">
              {app.missingSkills?.map((skill) => <SkillChip key={skill} skill={skill} />)}
            </div>
          </div>
        </div>
      )}

      {breakdown?.matchedTerms?.length > 0 && (
        <p className="text-xs text-slate-500 mt-4">
          Supporting terms found: {breakdown.matchedTerms.join(", ")}
        </p>
      )}

      {app.biasFlags?.summary && (
        <div className="mt-4 rounded-lg bg-[#0D1B2A] border border-slate-800 p-3">
          <div className="flex items-center justify-between gap-3">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-amber-400">Bias review</h4>
            <span className={`text-xs px-2 py-0.5 rounded border ${
              app.biasFlags.has_bias_risk
                ? "bg-amber-500/10 text-amber-300 border-amber-500/25"
                : "bg-emerald-500/10 text-emerald-300 border-emerald-500/25"
            }`}>
              {app.biasFlags.has_bias_risk ? "Review needed" : "No obvious risk"}
            </span>
          </div>
          <p className="text-sm text-slate-300 mt-2 leading-relaxed">{app.biasFlags.summary}</p>
          {app.biasFlags.flags?.length > 0 && (
            <ul className="mt-2 space-y-1.5">
              {app.biasFlags.flags.map((flag, index) => (
                <li key={`${flag.category}-${index}`} className="text-xs text-slate-300 leading-relaxed">
                  <span className="text-amber-400 font-semibold">{flag.category}</span>
                  {flag.text ? `: "${flag.text}"` : ""} {flag.suggestion ? `- ${flag.suggestion}` : ""}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {app.interviewQuestions?.[0]?.questions?.length > 0 && (
        <div className="mt-4 rounded-lg bg-[#0D1B2A] border border-slate-800 p-3">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-violet-400">
            Suggested interview questions
          </h4>
          <ol className="mt-2 space-y-2">
            {app.interviewQuestions[0].questions.map((item, index) => (
              <li key={`${item.question}-${index}`} className="text-sm text-slate-300 leading-relaxed">
                <span className="text-slate-500">{index + 1}. </span>
                {item.question}
                {item.category && (
                  <span className="ml-2 text-[11px] uppercase tracking-wide text-slate-500">
                    {item.category}
                  </span>
                )}
                {item.rationale && (
                  <p className="ml-5 mt-1 text-xs text-slate-500">{item.rationale}</p>
                )}
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

function SkillChip({ skill, matched }) {
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-md border ${
      matched
        ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/25"
        : "bg-amber-500/10 text-amber-300 border-amber-500/25"
    }`}>
      <Icon name={matched ? "check" : "x"} className="w-3 h-3" strokeWidth={2.5} />
      {skill}
    </span>
  );
}


export { ScoreReasoning, SkillChip };
