import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

function StatCard({ label, value, icon, accent }) {
  return (
    <div className="bg-[#111D2C] border border-slate-800 rounded-xl p-6 flex items-center gap-4">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl ${accent}`}>
        {icon}
      </div>
      <div>
        <p className="text-slate-400 text-sm">{label}</p>
        <p className="text-white text-2xl font-bold mt-0.5">{value ?? "—"}</p>
      </div>
    </div>
  );
}

export default function RecruiterDashboard() {
  const { api, user } = useAuth();
  const [stats, setStats] = useState(null);
  const [recentJobs, setRecentJobs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [statsRes, jobsRes] = await Promise.all([
          api.get("/recruiter/dashboard"),
          api.get("/jobs/my"),
        ]);
        setStats(statsRes.data);
        setRecentJobs((jobsRes.data.jobs || jobsRes.data || []).slice(0, 5));
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">
            Good {getGreeting()}, {(user?.fullName || user?.name)?.split(" ")[0]} 👋
          </h1>
          <p className="text-slate-400 text-sm mt-1">Here's your hiring overview</p>
        </div>
        <Link
          to="/recruiter/jobs/new"
          className="flex items-center gap-2 bg-blue-500 hover:bg-blue-400 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <span>+</span> Post a Job
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <StatCard label="Total Jobs Posted" value={stats?.totalJobs} icon="📋" accent="bg-blue-500/10 text-blue-400" />
        <StatCard label="Total Applications" value={stats?.totalApplications} icon="📨" accent="bg-purple-500/10 text-purple-400" />
        <StatCard label="Shortlisted" value={stats?.shortlisted} icon="⭐" accent="bg-amber-500/10 text-amber-400" />
      </div>

      {/* Recent jobs */}
      <div className="bg-[#111D2C] border border-slate-800 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <h2 className="text-white font-semibold">Recent Jobs</h2>
          <Link to="/recruiter/jobs" className="text-blue-400 text-sm hover:text-blue-300 transition-colors">
            View all →
          </Link>
        </div>
        {recentJobs.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-slate-400 text-sm">No jobs posted yet.</p>
            <Link to="/recruiter/jobs/new" className="text-blue-400 text-sm hover:underline mt-2 inline-block">
              Post your first job →
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-slate-800">
            {recentJobs.map((job) => (
              <div key={job._id} className="px-6 py-4 flex items-center justify-between hover:bg-slate-800/30 transition-colors">
                <div>
                  <p className="text-white font-medium text-sm">{job.title}</p>
                  <p className="text-slate-400 text-xs mt-0.5">{job.location} · {job.type}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full border ${
                    job.status === "active" ? "bg-green-500/10 text-green-400 border-green-500/20"
                    : job.status === "paused" ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                    : "bg-slate-500/10 text-slate-400 border-slate-700"
                  }`}>
                    {job.status}
                  </span>
                  <Link
                    to={`/recruiter/jobs/${job.jobId}/applications`}
                    className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                  >
                    View apps →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  return "evening";
}
