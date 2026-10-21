import { useEffect, useMemo, useRef, useState } from "react";
import CandidateComparison from "../../components/CandidateComparison";
import { analysisState, MAX_COMPARISON, toggleCandidate } from "../../utils/candidateComparison";
import { useParams, Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import Icon from "../../components/Icon";
import { ChartCard, HorizontalBars, TierColumns } from "../../components/charts/Charts";
import { SCORE_TIERS, tierForScore } from "../../components/charts/theme";
import { PageHeader, ScoreRing, Spinner, StatTile, StatusBadge, STATUS_CONFIG } from "../../components/ui";

const APPLICATION_STATUSES = Object.keys(STATUS_CONFIG);
const MAX_COVERAGE_SKILLS = 10;

const isPendingAi = (app) => ["queued", "processing"].includes(analysisState(app));
const isUnscored = (app) => ["queued", "processing", "failed", "interrupted"].includes(analysisState(app));
const ANALYSIS_LABELS = { queued: "Queued", processing: "Analyzing resume", completed: "Analysis completed", fallback: "Score available - analysis warning", failed: "Analysis failed", interrupted: "Analysis interrupted" };

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
      title: "Overall similarity",
      detail: "How closely the CV's overall content matches the job description",
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

/** Per-skill share of scored candidates who demonstrated it, from what the scorers evaluated. */
function buildSkillCoverage(scoredApps) {
  const skills = new Map();
  const tally = (skill, matched) => {
    const key = String(skill).trim().toLowerCase();
    if (!key) return;
    const entry = skills.get(key) || { label: String(skill).trim(), matched: 0, evaluated: 0 };
    entry.evaluated += 1;
    if (matched) entry.matched += 1;
    skills.set(key, entry);
  };
  for (const app of scoredApps) {
    (app.matchedSkills || []).forEach((skill) => tally(skill, true));
    (app.missingSkills || []).forEach((skill) => tally(skill, false));
  }
  return [...skills.values()]
    .sort((a, b) => b.evaluated - a.evaluated)
    .slice(0, MAX_COVERAGE_SKILLS)
    .map((entry) => ({ ...entry, value: Math.round((entry.matched / entry.evaluated) * 100) }))
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));
}

export default function JobApplications() {
  const { jobId } = useParams();
  const { api } = useAuth();
  const [job, setJob] = useState(null);
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(null);
  const [filter, setFilter] = useState("all");
  const [expanded, setExpanded] = useState({});
  const [search, setSearch] = useState("");
  const [minimumScore, setMinimumScore] = useState("");
  const [notes, setNotes] = useState({});
  const [statusMessage, setStatusMessage] = useState(null);
  const [retrying, setRetrying] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [comparisonOpen, setComparisonOpen] = useState(false);
  const compareTrigger = useRef(null);
  const selectedApplications = selectedIds.map(id => applications.find(app => app._id === id)).filter(Boolean);

  useEffect(() => { setSelectedIds([]); setComparisonOpen(false); }, [jobId]);
  useEffect(() => {
    setSelectedIds(current => current.filter(id => applications.some(app => app._id === id)));
  }, [applications]);
  useEffect(() => { if (selectedIds.length < 2) setComparisonOpen(false); }, [selectedIds.length]);

  useEffect(() => {
    const load = async () => {
      try {
        const [appRes, jobRes] = await Promise.all([
          api.get(`/applications/job/${jobId}`),
          api.get(`/jobs/apply/${jobId}`),
        ]);
        const loadedApplications = appRes.data.applications || appRes.data || [];
        setApplications(loadedApplications);
        setNotes(Object.fromEntries(
          loadedApplications.map((app) => [app._id, app.recruiterNotes || ""])
        ));
        setJob(jobRes.data.job || jobRes.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [jobId, api]);

  const hasPendingAnalysis = applications.some(isPendingAi);
  useEffect(() => {
    if (!hasPendingAnalysis) return;
    let active = true;
    const timer = setInterval(async () => {
      try {
        const { data } = await api.get(`/applications/job/${jobId}`);
        if (active) setApplications(data.applications || []);
      } catch { /* Keep the last result; the next poll can recover. */ }
    }, 20000);
    return () => { active = false; clearInterval(timer); };
  }, [api, jobId, hasPendingAnalysis]);

  const retryAnalysis = async (application) => {
    setRetrying(application._id);
    setStatusMessage(null);
    setApplications(current => current.map(item => item._id === application._id ? { ...item, analysisStatus: "processing" } : item));
    try {
      const attempt = await api.post(`/applications/${application._id}/reprocess`);
      const { data } = await api.get(`/applications/job/${jobId}`);
      setApplications(data.applications || []);
      setStatusMessage({ type: attempt.data.analysisStatus === "completed" ? "success" : "warning", text: "Analysis attempt finished. Check the candidate's analysis status and evidence below." });
    } catch (error) {
      setStatusMessage({ type: "error", text: error.response?.data?.error || "The request did not finish. Refresh to check its status before retrying." });
      try {
        const { data } = await api.get(`/applications/job/${jobId}`);
        setApplications(data.applications || []);
      } catch {
        setApplications(current => current.map(item => item._id === application._id ? { ...item, analysisStatus: "interrupted" } : item));
      }
    } finally { setRetrying(null); }
  };

  const overview = useMemo(() => {
    const scoredApps = applications.filter((app) => !isUnscored(app) && app.matchScore != null);
    const scored = scoredApps.length;
    const average = scored
      ? Math.round(scoredApps.reduce((sum, app) => sum + Number(app.matchScore || 0), 0) / scored)
      : null;
    const tiers = SCORE_TIERS.map((tier) => {
      const value = scoredApps.filter((app) => tierForScore(app.matchScore).key === tier.key).length;
      return { ...tier, value, share: scored ? Math.round((value / scored) * 100) : null };
    });
    const goodOrBetter = scoredApps.filter((app) => Number(app.matchScore) >= 70).length;
    return {
      scored,
      average,
      tiers,
      goodOrBetter,
      pending: applications.filter(isPendingAi).length,
      shortlisted: applications.filter((app) => app.status === "shortlisted").length,
      coverage: buildSkillCoverage(scoredApps),
    };
  }, [applications]);

  const updateStatus = async (appId, status, recruiterNotes = notes[appId]) => {
    const currentApplication = applications.find((app) => app._id === appId);
    const sendsEmail = ["shortlisted", "rejected"].includes(status)
      && currentApplication?.status !== status;
    if (sendsEmail) {
      const candidateName = currentApplication?.candidate?.fullName || "this candidate";
      const confirmed = window.confirm(
        `Approve changing ${candidateName} to ${status}? This will send the candidate an email.`
      );
      if (!confirmed) return;
    }

    setUpdating(appId);
    setStatusMessage(null);
    try {
      const { data } = await api.patch(`/applications/${appId}/status`, { status, recruiterNotes });
      setApplications((prev) =>
        prev.map((a) => a._id === appId
          ? { ...a, status, recruiterNotes, notifications: data.application?.notifications || a.notifications }
          : a)
      );
      if (data.notification?.sent) {
        setStatusMessage({ type: "success", text: `Status updated and email sent to ${currentApplication?.candidate?.email}.` });
      } else if (data.notification?.skipped) {
        setStatusMessage({ type: "warning", text: `Status updated. ${data.notification.error}` });
      } else {
        setStatusMessage({ type: "success", text: "Application status updated." });
      }
    } catch (err) {
      setStatusMessage({
        type: "error",
        text: err.response?.data?.error || "Failed to update application status."
      });
    } finally {
      setUpdating(null);
    }
  };

  const downloadResume = async (app) => {
    try {
      const response = await api.get(`/applications/${app._id}/resume`, { responseType: "blob" });
      const url = URL.createObjectURL(response.data);
      const link = document.createElement("a");
      link.href = url;
      link.download = app.resume?.originalFileName || "resume.pdf";
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
    }
  };

  const filtered = applications.filter((app) => {
    const matchesStatus = filter === "all" || app.status === filter;
    const query = search.trim().toLowerCase();
    const matchesSearch = !query
      || app.candidate?.fullName?.toLowerCase().includes(query)
      || app.candidate?.email?.toLowerCase().includes(query)
      || app.matchedSkills?.some((skill) => skill.toLowerCase().includes(query));
    const matchesScore = minimumScore === "" || (!isUnscored(app) && Number(app.matchScore || 0) >= Number(minimumScore));
    return matchesStatus && matchesSearch && matchesScore;
  });

  const statusCounts = applications.reduce((counts, app) => {
    counts[app.status] = (counts[app.status] || 0) + 1;
    return counts;
  }, {});

  const exportCsv = () => {
    const escape = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
    const rows = [
      ["Rank", "Candidate", "Email", "Score", "Status", "Matched Skills", "Missing Skills", "Notes"],
      ...filtered.map((app, index) => [
        index + 1,
        app.candidate?.fullName,
        app.candidate?.email,
        isUnscored(app) ? ANALYSIS_LABELS[analysisState(app)] : Math.round(Number(app.matchScore) || 0),
        app.status,
        app.matchedSkills?.join("; "),
        app.missingSkills?.join("; "),
        app.recruiterNotes
      ])
    ];
    const csv = rows.map((row) => row.map(escape).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${job?.title || "applications"}-applications.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <Spinner />;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <PageHeader
        eyebrow={
          <Link to="/recruiter/jobs" className="text-slate-500 hover:text-slate-300 text-sm transition-colors inline-flex items-center gap-1 mb-3">
            <Icon name="arrowLeft" className="w-3.5 h-3.5" /> My jobs
          </Link>
        }
        title={job?.title || "Job applications"}
        subtitle={`${applications.length} candidate${applications.length !== 1 ? "s" : ""} · ranked by match score`}
        actions={
          <button onClick={exportCsv} disabled={!filtered.length} className="btn-secondary">
            <Icon name="download" className="w-4 h-4" /> Export CSV
          </button>
        }
      />

      {/* Overview */}
      {applications.length > 0 && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <StatTile
              label="Candidates"
              value={applications.length}
              icon="users"
              hint={overview.pending ? `${overview.pending} awaiting AI score` : "All scored"}
            />
            <StatTile
              label="Average match"
              value={overview.average != null ? `${overview.average}%` : "—"}
              icon="target"
              hint={overview.scored ? `${overview.scored} scored` : "No scores yet"}
            />
            <StatTile
              label="Good or strong matches"
              value={overview.goodOrBetter}
              icon="sparkles"
              hint="Score 70 or higher"
            />
            <StatTile
              label="Shortlisted"
              value={overview.shortlisted}
              icon="star"
              hint={`${Math.round((overview.shortlisted / applications.length) * 100)}% of candidates`}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
            <ChartCard
              title="Match quality"
              subtitle="Scored candidates by recommendation tier"
              empty={!overview.scored}
              emptyText="Scores will appear once applications are processed"
              table={{
                columns: ["Tier", "Score range", "Candidates", "Share"],
                rows: overview.tiers.map((tier) => [tier.label, tier.range, tier.value, `${tier.share ?? 0}%`]),
              }}
            >
              <TierColumns data={overview.tiers} ariaLabel="Candidates for this job by recommendation tier" />
            </ChartCard>

            <ChartCard
              title="Required skill coverage"
              subtitle="Share of scored candidates who demonstrate each skill"
              empty={!overview.coverage.length}
              emptyText="No skill evaluations yet"
              table={{
                columns: ["Skill", "Candidates with it", "Coverage"],
                rows: overview.coverage.map((row) => [row.label, `${row.matched} of ${row.evaluated}`, `${row.value}%`]),
              }}
            >
              <HorizontalBars
                data={overview.coverage}
                max={100}
                ariaLabel="Required skill coverage across candidates"
                formatValue={(value) => `${value}%`}
                tooltipValue={(value, row) => `${value}% · ${row.matched} of ${row.evaluated} candidates`}
              />
            </ChartCard>
          </div>
        </>
      )}

      {statusMessage && (
        <div className={`mb-5 px-4 py-3 rounded-lg border text-sm ${
          statusMessage.type === "success"
            ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-300"
            : statusMessage.type === "warning"
              ? "bg-amber-500/10 border-amber-500/25 text-amber-300"
              : "bg-rose-500/10 border-rose-500/25 text-rose-300"
        }`}>
          {statusMessage.text}
        </div>
      )}

      {/* Filters: one row above the list they scope */}
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <div className="relative">
          <Icon name="search" className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search name, email, or skill"
            className="input pl-9 w-72"
          />
        </div>
        <input
          type="number"
          min="0"
          max="100"
          value={minimumScore}
          onChange={(event) => setMinimumScore(event.target.value)}
          placeholder="Minimum score"
          className="input w-36"
        />
        <div className="flex flex-wrap gap-1 p-1 card">
          {["all", ...APPLICATION_STATUSES].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-md text-sm capitalize transition-all ${
                filter === f ? "bg-blue-500 text-white" : "text-slate-400 hover:text-white"
              }`}
            >
              {f}
              <span className={`ml-1.5 text-xs ${filter === f ? "text-blue-100" : "text-slate-500"}`}>
                {f === "all" ? applications.length : statusCounts[f] || 0}
              </span>
            </button>
          ))}
        </div>
      </div>

      {applications.length > 0 && (
        <div className="card p-4 mb-5 flex flex-wrap items-center gap-3">
          <p className="text-sm text-slate-300" role="status">{selectedApplications.length} of {MAX_COMPARISON} selected</p>
          <span className="text-xs text-slate-500">Select 2 or 3 candidates to compare. Selection stays when filters change.</span>
          <button ref={compareTrigger} disabled={selectedApplications.length < 2} onClick={() => setComparisonOpen(true)} className="btn-primary btn-sm">Compare candidates</button>
          {selectedApplications.length > 0 && <button onClick={() => { setSelectedIds([]); setComparisonOpen(false); }} className="btn-secondary btn-sm">Clear selection</button>}
          <div className="w-full flex flex-wrap gap-2">
            {selectedApplications.map(app => <button key={app._id} onClick={() => setSelectedIds(current => current.filter(id => id !== app._id))} className="text-xs rounded-lg border border-blue-500/30 px-3 py-1.5 text-blue-300 hover:bg-blue-500/10" aria-label={`Remove ${app.candidate?.fullName || 'candidate'} from comparison`}>
              {app.candidate?.fullName || 'Unknown candidate'} <span aria-hidden="true">&times;</span>
            </button>)}
          </div>
        </div>
      )}

      {comparisonOpen && selectedApplications.length >= 2 && <CandidateComparison
        applications={selectedApplications}
        requiredSkills={job?.requiredSkills || []}
        onDownload={downloadResume}
        onClose={() => { setComparisonOpen(false); compareTrigger.current?.focus(); }}
      />}

      {filtered.length === 0 ? (
        <div className="card p-16 text-center">
          <p className="text-slate-400">No applications {filter !== "all" ? `with status "${filter}"` : "yet"}.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((app, i) => {
            const matchedPreview = (app.matchedSkills || []).slice(0, 4);
            const missingPreview = (app.missingSkills || []).slice(0, 3);
            return (
              <div key={app._id} className="card p-5 hover:border-slate-700 transition-colors">
                <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                  <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
                    <input type="checkbox" checked={selectedIds.includes(app._id)} onChange={() => setSelectedIds(current => toggleCandidate(current, app._id))}
                      disabled={!selectedIds.includes(app._id) && selectedIds.length >= MAX_COMPARISON}
                      aria-label={`Compare ${app.candidate?.fullName || 'candidate'} (${app.candidate?.email || app._id})`}
                      className="accent-blue-500 h-4 w-4 disabled:opacity-40" />
                    Compare
                  </label>
                  <ScoreRing score={app.matchScore} pending={isUnscored(app)} pendingLabel={isPendingAi(app) ? "Analyzing" : "No score"} />

                  {/* Candidate info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-semibold text-slate-500 tabular-nums">{isUnscored(app) ? "-" : `#${i + 1}`}</span>
                      <h3 className="text-white font-semibold">
                        {app.candidate?.fullName || "Unknown Candidate"}
                      </h3>
                      <StatusBadge status={app.status} />
                      <span className={`text-xs ${["fallback", "failed", "interrupted"].includes(analysisState(app)) ? "text-amber-300" : "text-slate-400"}`} role="status">{ANALYSIS_LABELS[analysisState(app)]}</span>
                    </div>
                    <p className="text-slate-400 text-sm mt-0.5">{app.candidate?.email}</p>
                    {app.processingFinishedAt && <p className="mt-1 text-xs text-slate-500">Last attempt: {new Date(app.processingFinishedAt).toLocaleString()} - {app.processingAttempts || 1} attempt(s)</p>}

                    {(matchedPreview.length > 0 || missingPreview.length > 0) && (
                      <div className="flex flex-wrap gap-1.5 mt-3">
                        {matchedPreview.map((skill) => <SkillChip key={`m-${skill}`} skill={skill} matched />)}
                        {missingPreview.map((skill) => <SkillChip key={`x-${skill}`} skill={skill} />)}
                        {(app.matchedSkills?.length || 0) + (app.missingSkills?.length || 0) > matchedPreview.length + missingPreview.length && (
                          <span className="text-xs text-slate-500 self-center">
                            +{(app.matchedSkills?.length || 0) + (app.missingSkills?.length || 0) - matchedPreview.length - missingPreview.length} more
                          </span>
                        )}
                      </div>
                    )}

                    <button
                      onClick={() => setExpanded((current) => ({ ...current, [app._id]: !current[app._id] }))}
                      className="mt-3 text-xs text-blue-400 hover:text-blue-300 transition-colors"
                      aria-expanded={Boolean(expanded[app._id])}
                    >
                      {expanded[app._id] ? "Hide score reasoning" : "Why this score?"}
                    </button>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap gap-2 shrink-0 sm:grid sm:grid-cols-2 sm:w-60">
                    <button onClick={() => retryAnalysis(app)} disabled={retrying !== null || isPendingAi(app)} className="btn-secondary btn-sm">
                      {retrying === app._id ? "Analyzing..." : ["fallback", "failed", "interrupted"].includes(analysisState(app)) ? "Retry analysis" : "Run analysis again"}
                    </button>
                    {app.resume && (
                      <button onClick={() => downloadResume(app)} className="btn-secondary btn-sm">
                        <Icon name="document" className="w-3.5 h-3.5" /> Resume
                      </button>
                    )}
                    <select
                      value={app.status}
                      onChange={(event) => updateStatus(app._id, event.target.value)}
                      disabled={updating === app._id}
                      className="text-xs px-2 py-1.5 bg-[#0D1B2A] border border-slate-700 text-slate-300 rounded-lg"
                      aria-label="Application status"
                    >
                      {APPLICATION_STATUSES.map((status) => (
                        <option key={status} value={status}>{STATUS_CONFIG[status].label}</option>
                      ))}
                    </select>
                    <button
                      onClick={() => updateStatus(app._id, "shortlisted")}
                      disabled={updating === app._id || app.status === "shortlisted"}
                      className="inline-flex items-center justify-center gap-1 text-xs px-3 py-1.5 bg-emerald-500/15 text-emerald-300 border border-emerald-500/25 rounded-lg hover:bg-emerald-500/25 transition-all disabled:opacity-40"
                    >
                      <Icon name="check" className="w-3.5 h-3.5" strokeWidth={2} /> Shortlist
                    </button>
                    <button
                      onClick={() => updateStatus(app._id, "rejected")}
                      disabled={updating === app._id || app.status === "rejected"}
                      className="inline-flex items-center justify-center gap-1 text-xs px-3 py-1.5 bg-rose-500/10 text-rose-300 border border-rose-500/25 rounded-lg hover:bg-rose-500/20 transition-all disabled:opacity-40"
                    >
                      <Icon name="x" className="w-3.5 h-3.5" strokeWidth={2} /> Reject
                    </button>
                  </div>
                </div>
                {expanded[app._id] && (
                  <>
                    <ScoreReasoning app={app} />
                    <div className="mt-4 pt-4 border-t border-slate-800">
                      <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                        Recruiter notes
                      </label>
                      <textarea
                        value={notes[app._id] || ""}
                        onChange={(event) => setNotes((current) => ({ ...current, [app._id]: event.target.value }))}
                        rows={3}
                        placeholder="Add interview observations or follow-up notes..."
                        className="input mt-2 w-full resize-y"
                      />
                      <button
                        onClick={() => updateStatus(app._id, app.status, notes[app._id])}
                        disabled={updating === app._id}
                        className="mt-2 px-3 py-1.5 bg-blue-500/15 text-blue-300 border border-blue-500/25 rounded-lg text-xs disabled:opacity-50"
                      >
                        Save notes
                      </button>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
