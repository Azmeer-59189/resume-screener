import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import Icon from "../../components/Icon";
import { ChartCard, HorizontalBars, TierColumns, TrendChart } from "../../components/charts/Charts";
import { SCORE_TIERS, chart } from "../../components/charts/theme";
import { JobStatusBadge, PageHeader, ScoreMeter, Spinner, StatTile, StatusBadge } from "../../components/ui";

const PIPELINE_STAGES = [
  { key: "applied", label: "Applied" },
  { key: "reviewing", label: "Reviewing" },
  { key: "shortlisted", label: "Shortlisted" },
  { key: "interviewed", label: "Interviewed" },
  { key: "offered", label: "Offered" },
  { key: "rejected", label: "Rejected" },
];

const shortDate = (date) =>
  date.toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" });

/** Expand the sparse per-day counts into a continuous series (UTC days, matching the API). */
function buildTrend(analytics) {
  if (!analytics) return [];
  const counts = new Map(analytics.applicationsByDay.map((item) => [item.date, item.count]));
  const start = new Date(analytics.trendStart);
  return Array.from({ length: analytics.trendDays }, (_, index) => {
    const day = new Date(start);
    day.setUTCDate(start.getUTCDate() + index);
    const key = day.toISOString().slice(0, 10);
    return { date: key, label: shortDate(day), count: counts.get(key) || 0 };
  });
}

export default function RecruiterDashboard() {
  const { api, user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.get("/recruiter/dashboard")
      .then((res) => setData(res.data))
      .catch((err) => setError(err.response?.data?.error || "Could not load dashboard data."))
      .finally(() => setLoading(false));
  }, [api]);

  const analytics = data?.analytics;
  const trend = useMemo(() => buildTrend(analytics), [analytics]);

  if (loading) return <Spinner />;

  const lastWeek = trend.slice(-7).reduce((sum, day) => sum + day.count, 0);
  const priorWeek = trend.slice(-14, -7).reduce((sum, day) => sum + day.count, 0);
  const trendTotal = trend.reduce((sum, day) => sum + day.count, 0);

  const statusCounts = analytics?.statusCounts || {};
  const pipeline = PIPELINE_STAGES.map((stage) => ({
    label: stage.label,
    value: statusCounts[stage.key] || 0,
    // Rejected is context, not progress: de-emphasized gray.
    color: stage.key === "rejected" ? chart.deemphasis : chart.series,
  }));

  const scored = analytics?.scoredApplications || 0;
  const tiers = SCORE_TIERS.map((tier) => {
    const value = analytics?.scoreTiers?.[tier.key] || 0;
    return { ...tier, value, share: scored ? Math.round((value / scored) * 100) : null };
  });

  const skillGaps = (analytics?.topSkillGaps || []).map((gap) => ({
    label: gap.skill,
    value: gap.count,
    share: scored ? Math.round((gap.count / scored) * 100) : 0,
  }));

  const jobs = analytics?.jobs || [];
  const shortlistRate = data?.totalApplications
    ? Math.round((data.shortlisted / data.totalApplications) * 100)
    : null;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <PageHeader
        title={`Good ${getGreeting()}, ${(user?.fullName || user?.name || "").split(" ")[0]}`}
        subtitle="Here's how your hiring pipeline is doing."
        actions={
          <Link to="/recruiter/jobs/new" className="btn-primary">
            <Icon name="plus" className="w-4 h-4" strokeWidth={2} /> Post a job
          </Link>
        }
      />

      {error && (
        <div className="mb-6 px-4 py-3 rounded-lg border border-rose-500/25 bg-rose-500/10 text-rose-300 text-sm">{error}</div>
      )}

      {/* KPI row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatTile
          label="Active jobs"
          value={data?.activeJobs ?? 0}
          icon="briefcase"
          hint={`${data?.totalJobs ?? 0} posted in total`}
        />
        <StatTile
          label="Applications"
          value={data?.totalApplications ?? 0}
          icon="inbox"
          delta={trend.length ? lastWeek - priorWeek : undefined}
          deltaLabel="last 7 days vs prior 7"
        />
        <StatTile
          label="Average match score"
          value={analytics?.averageScore != null ? `${analytics.averageScore}%` : "—"}
          icon="target"
          hint={scored ? `across ${scored} scored application${scored === 1 ? "" : "s"}` : "No scored applications yet"}
        />
        <StatTile
          label="Shortlisted"
          value={data?.shortlisted ?? 0}
          icon="star"
          hint={shortlistRate != null ? `${shortlistRate}% of all applications` : "No applications yet"}
        />
      </div>

      {/* Trend + pipeline */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        <ChartCard
          className="lg:col-span-2"
          title="Applications over time"
          subtitle={`${trendTotal} in the last ${analytics?.trendDays ?? 30} days`}
          empty={!trendTotal}
          emptyText="No applications in the last 30 days"
          table={{
            columns: ["Day", "Applications"],
            rows: trend.filter((day) => day.count).map((day) => [day.label, day.count]),
          }}
        >
          <TrendChart data={trend} />
        </ChartCard>

        <ChartCard
          title="Pipeline"
          subtitle="Candidates by current status"
          empty={!data?.totalApplications}
          table={{ columns: ["Status", "Candidates"], rows: pipeline.map((row) => [row.label, row.value]) }}
        >
          <HorizontalBars
            data={pipeline}
            ariaLabel="Candidates by pipeline status"
            tooltipValue={(value) => `${value} candidate${value === 1 ? "" : "s"}`}
          />
        </ChartCard>
      </div>

      {/* Score quality + skill gaps */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <ChartCard
          title="Match quality"
          subtitle="Scored candidates by recommendation tier"
          empty={!scored}
          emptyText="Scores will appear once applications are processed"
          table={{
            columns: ["Tier", "Score range", "Candidates", "Share"],
            rows: tiers.map((tier) => [tier.label, tier.range, tier.value, `${tier.share ?? 0}%`]),
          }}
        >
          <TierColumns data={tiers} ariaLabel="Scored candidates by recommendation tier" />
        </ChartCard>

        <ChartCard
          title="Most common skill gaps"
          subtitle="Required skills candidates most often lack"
          empty={!skillGaps.length}
          emptyText="No skill gaps detected yet"
          table={{
            columns: ["Skill", "Candidates missing it", "Share of scored"],
            rows: skillGaps.map((gap) => [gap.label, gap.value, `${gap.share}%`]),
          }}
        >
          <HorizontalBars
            data={skillGaps}
            ariaLabel="Most common missing skills"
            tooltipValue={(value, row) => `${value} candidate${value === 1 ? "" : "s"} (${row.share}%) missing`}
          />
        </ChartCard>
      </div>

      {/* Jobs table */}
      <section className="card overflow-hidden mb-6">
        <header className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-white">Jobs</h2>
            <p className="text-xs text-slate-400 mt-0.5">Applications and average match score per posting</p>
          </div>
          <Link to="/recruiter/jobs" className="text-xs text-blue-400 hover:text-blue-300 inline-flex items-center gap-1 whitespace-nowrap shrink-0">
            Manage jobs <Icon name="arrowRight" className="w-3.5 h-3.5" />
          </Link>
        </header>
        {jobs.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-slate-400 text-sm">No jobs posted yet.</p>
            <Link to="/recruiter/jobs/new" className="text-blue-400 text-sm hover:underline mt-2 inline-block">
              Post your first job
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-400 border-b border-slate-800">
                  <th className="px-5 py-2.5 font-medium">Job</th>
                  <th className="px-3 py-2.5 font-medium">Status</th>
                  <th className="px-3 py-2.5 font-medium text-right">Applications</th>
                  <th className="px-3 py-2.5 font-medium w-48">Avg. score</th>
                  <th className="px-3 py-2.5 font-medium text-right">Top score</th>
                  <th className="px-3 py-2.5 font-medium text-right">Shortlisted</th>
                  <th className="px-5 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {jobs.map((job) => (
                  <tr key={job._id} className="border-b border-slate-800/60 last:border-0 hover:bg-slate-800/20 transition-colors">
                    <td className="px-5 py-3">
                      <p className="text-white font-medium">{job.title}</p>
                      <p className="text-xs text-slate-500 mt-0.5">Posted {new Date(job.createdAt).toLocaleDateString()}</p>
                    </td>
                    <td className="px-3 py-3"><JobStatusBadge status={job.status} /></td>
                    <td className="px-3 py-3 text-right tabular-nums text-slate-200">{job.applications}</td>
                    <td className="px-3 py-3"><ScoreMeter score={job.averageScore} /></td>
                    <td className="px-3 py-3 text-right tabular-nums text-slate-200">{job.topScore != null ? `${Math.round(job.topScore)}%` : "—"}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-slate-200">{job.shortlisted}</td>
                    <td className="px-5 py-3 text-right">
                      <Link
                        to={`/recruiter/jobs/${job.jobId}/applications`}
                        className="text-xs text-blue-400 hover:text-blue-300 whitespace-nowrap"
                      >
                        Candidates →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Recent applications */}
      {data?.recentApplications?.length > 0 && (
        <section className="card overflow-hidden">
          <header className="px-5 py-4 border-b border-slate-800">
            <h2 className="text-sm font-semibold text-white">Recent applications</h2>
          </header>
          <ul className="divide-y divide-slate-800/60">
            {data.recentApplications.map((app) => (
              <li key={app._id} className="px-5 py-3 flex items-center gap-4">
                <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-xs font-semibold text-slate-300 shrink-0">
                  {(app.candidate?.fullName || "?")[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white truncate">{app.candidate?.fullName || "Unknown candidate"}</p>
                  <p className="text-xs text-slate-500 truncate">
                    {app.job?.title} · {new Date(app.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <StatusBadge status={app.status} />
                <div className="w-32 hidden sm:block">
                  <ScoreMeter
                    score={app.scoringMethod === "agent" && !app.isAiProcessed ? null : app.matchScore}
                    emptyText="AI pending"
                  />
                </div>
                {app.job?.jobId && (
                  <Link to={`/recruiter/jobs/${app.job.jobId}/applications`} className="text-xs text-blue-400 hover:text-blue-300">
                    View
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  return "evening";
}
