import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

const STATUS_CONFIG = {
  applied:     { label: "Applied",     cls: "bg-slate-500/10 text-slate-400 border-slate-700" },
  reviewing:   { label: "Reviewing",   cls: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  shortlisted: { label: "Shortlisted", cls: "bg-green-500/10 text-green-400 border-green-500/20" },
  interviewed: { label: "Interviewed", cls: "bg-purple-500/10 text-purple-400 border-purple-500/20" },
  offered:     { label: "Offered",     cls: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20" },
  rejected:    { label: "Rejected",    cls: "bg-red-500/10 text-red-400 border-red-500/20" },
};

const APPLICATION_STATUSES = Object.keys(STATUS_CONFIG);

function ScoreBar({ score }) {
  const pct = Math.max(0, Math.min(100, Math.round(Number(score) || 0)));
  const color = pct >= 75 ? "bg-green-500" : pct >= 50 ? "bg-blue-500" : pct >= 30 ? "bg-amber-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`text-xs font-bold tabular-nums ${
        pct >= 75 ? "text-green-400" : pct >= 50 ? "text-blue-400" : pct >= 30 ? "text-amber-400" : "text-red-400"
      }`}>{pct}%</span>
    </div>
  );
}

function DetailList({ title, items, tone }) {
  if (!items?.length) return null;
  const color = tone === "positive" ? "text-green-400" : "text-amber-400";
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

function ScoreReasoning({ app }) {
  const breakdown = app.scoreBreakdown;
  const methodLabel = app.scoringMethod === "ai"
    ? "AI assessment"
    : app.scoringMethod === "vector"
      ? "Vector similarity"
      : "Local evidence score";

  return (
    <div className="mt-4 pt-4 border-t border-slate-800">
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <span className="text-xs text-slate-500">Scoring method</span>
        <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
          {methodLabel}
        </span>
      </div>

      {breakdown && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          <div className="rounded-lg bg-[#0D1B2A] border border-slate-800 p-3">
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">Required skills ({breakdown.skillWeight ?? 0}% weight)</span>
              <span className="text-white font-semibold">{breakdown.skillScore ?? 0}%</span>
            </div>
            <p className="text-slate-500 text-xs mt-1">
              {breakdown.matchedSkillCount ?? 0} of {breakdown.totalSkillCount ?? 0} explicitly detected
            </p>
          </div>
          <div className="rounded-lg bg-[#0D1B2A] border border-slate-800 p-3">
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">Job context ({breakdown.contextWeight ?? 0}% weight)</span>
              <span className="text-white font-semibold">{breakdown.contextScore ?? 0}%</span>
            </div>
            <p className="text-slate-500 text-xs mt-1">
              {breakdown.matchedTermCount ?? 0} of {breakdown.totalTermCount ?? 0} role terms detected
            </p>
          </div>
          <p className="sm:col-span-2 text-xs text-slate-500">{breakdown.formula}</p>
        </div>
      )}

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
              {app.matchedSkills?.map(skill => (
                <span key={skill} className="text-xs px-2 py-0.5 rounded bg-green-500/10 text-green-400 border border-green-500/20">
                  {skill}
                </span>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs text-slate-500 mb-2">Missing or not demonstrated</p>
            <div className="flex flex-wrap gap-1.5">
              {app.missingSkills?.map(skill => (
                <span key={skill} className="text-xs px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  {skill}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {breakdown?.matchedTerms?.length > 0 && (
        <p className="text-xs text-slate-500 mt-4">
          Supporting terms found: {breakdown.matchedTerms.join(", ")}
        </p>
      )}
    </div>
  );
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
  }, [jobId]);

  const updateStatus = async (appId, status, recruiterNotes = notes[appId]) => {
    setUpdating(appId);
    try {
      await api.patch(`/applications/${appId}/status`, { status, recruiterNotes });
      setApplications((prev) =>
        prev.map((a) => a._id === appId ? { ...a, status, recruiterNotes } : a)
      );
    } catch (err) {
      console.error(err);
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
    const matchesScore = minimumScore === "" || Number(app.matchScore || 0) >= Number(minimumScore);
    return matchesStatus && matchesSearch && matchesScore;
  });

  const exportCsv = () => {
    const escape = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
    const rows = [
      ["Rank", "Candidate", "Email", "Score", "Status", "Matched Skills", "Missing Skills", "Notes"],
      ...filtered.map((app, index) => [
        index + 1,
        app.candidate?.fullName,
        app.candidate?.email,
        Math.round(Number(app.matchScore) || 0),
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

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <Link to="/recruiter/jobs" className="text-slate-500 hover:text-slate-300 text-sm transition-colors flex items-center gap-1 mb-3">
          ← My Jobs
        </Link>
        <h1 className="text-2xl font-bold text-white">{job?.title || "Job Applications"}</h1>
        <p className="text-slate-400 text-sm mt-1">
          {applications.length} candidate{applications.length !== 1 ? "s" : ""} · ranked by AI match score
        </p>
      </div>

      <div className="mb-6 space-y-3">
        <div className="flex flex-wrap gap-2">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search name, email, or skill"
            className="min-w-64 px-3 py-2 bg-[#111D2C] border border-slate-800 rounded-lg text-sm text-white placeholder-slate-500"
          />
          <input
            type="number"
            min="0"
            max="100"
            value={minimumScore}
            onChange={(event) => setMinimumScore(event.target.value)}
            placeholder="Minimum score"
            className="w-40 px-3 py-2 bg-[#111D2C] border border-slate-800 rounded-lg text-sm text-white placeholder-slate-500"
          />
          <button
            onClick={exportCsv}
            disabled={!filtered.length}
            className="px-4 py-2 border border-slate-700 text-slate-300 rounded-lg text-sm hover:text-white disabled:opacity-40"
          >
            Export CSV
          </button>
        </div>
        <div className="flex flex-wrap gap-1 p-1 bg-[#111D2C] border border-slate-800 rounded-lg w-fit">
          {["all", ...APPLICATION_STATUSES].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-md text-sm capitalize transition-all ${
                filter === f ? "bg-blue-500 text-white" : "text-slate-400 hover:text-white"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-[#111D2C] border border-slate-800 rounded-xl p-16 text-center">
          <p className="text-slate-400">No applications {filter !== "all" ? `with status "${filter}"` : "yet"}.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((app, i) => {
            const sc = STATUS_CONFIG[app.status] || STATUS_CONFIG.applied;
            return (
              <div key={app._id} className="bg-[#111D2C] border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition-all">
                <div className="flex items-start gap-4">
                  {/* Rank */}
                  <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 text-xs font-bold shrink-0 mt-0.5">
                    {i + 1}
                  </div>

                  {/* Candidate info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-white font-semibold">
                        {app.candidate?.fullName || "Unknown Candidate"}
                      </h3>
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${sc.cls}`}>
                        {sc.label}
                      </span>
                    </div>
                    <p className="text-slate-400 text-sm mt-0.5">{app.candidate?.email}</p>

                    {/* Score bar */}
                    <div className="mt-3 max-w-xs">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-slate-500">Match Score</span>
                      </div>
                      <ScoreBar score={app.matchScore ?? 0} />
                    </div>

                    <button
                      onClick={() => setExpanded(current => ({ ...current, [app._id]: !current[app._id] }))}
                      className="mt-3 text-xs text-blue-400 hover:text-blue-300 transition-colors"
                    >
                      {expanded[app._id] ? "Hide score reasoning" : "Why this score?"}
                    </button>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col gap-2 shrink-0">
                    {app.resume && (
                      <button
                        onClick={() => downloadResume(app)}
                        className="text-xs px-3 py-1.5 border border-slate-700 text-slate-300 rounded-lg hover:border-slate-600 hover:text-white transition-all text-center"
                      >
                        📄 Resume
                      </button>
                    )}
                    <select
                      value={app.status}
                      onChange={(event) => updateStatus(app._id, event.target.value)}
                      disabled={updating === app._id}
                      className="text-xs px-2 py-1.5 bg-[#0D1B2A] border border-slate-700 text-slate-300 rounded-lg capitalize"
                    >
                      {APPLICATION_STATUSES.map((status) => (
                        <option key={status} value={status}>{STATUS_CONFIG[status].label}</option>
                      ))}
                    </select>
                    <button
                      onClick={() => updateStatus(app._id, "shortlisted")}
                      disabled={updating === app._id || app.status === "shortlisted"}
                      className="text-xs px-3 py-1.5 bg-green-500/15 text-green-400 border border-green-500/20 rounded-lg hover:bg-green-500/25 transition-all disabled:opacity-40"
                    >
                      ✓ Shortlist
                    </button>
                    <button
                      onClick={() => updateStatus(app._id, "rejected")}
                      disabled={updating === app._id || app.status === "rejected"}
                      className="text-xs px-3 py-1.5 bg-red-500/10 text-red-400 border border-red-500/20 rounded-lg hover:bg-red-500/20 transition-all disabled:opacity-40"
                    >
                      ✗ Reject
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
                        className="mt-2 w-full px-3 py-2 bg-[#0D1B2A] border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 resize-y"
                      />
                      <button
                        onClick={() => updateStatus(app._id, app.status, notes[app._id])}
                        disabled={updating === app._id}
                        className="mt-2 px-3 py-1.5 bg-blue-500/15 text-blue-400 border border-blue-500/20 rounded-lg text-xs disabled:opacity-50"
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
