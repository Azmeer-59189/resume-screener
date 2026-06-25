import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

export default function MyJobs() {
  const { api } = useAuth();
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(null);
  const [updating, setUpdating] = useState(null);

  useEffect(() => {
    api.get("/jobs/my")
      .then((res) => setJobs(res.data.jobs || res.data || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const copyLink = (jobId) => {
    // ✅ FIX: use job.jobId (JOB-xxx) not job._id (MongoDB ObjectId)
    const url = `${window.location.origin}/jobs/apply/${jobId}`;
    navigator.clipboard.writeText(url);
    setCopied(jobId);
    setTimeout(() => setCopied(null), 2000);
  };

  const toggleStatus = async (job) => {
    const next = job.status === "active" ? "paused" : "active";
    setUpdating(job._id);
    try {
      await api.patch(`/jobs/${job._id}/status`, { status: next });
      setJobs((prev) => prev.map((j) => j._id === job._id ? { ...j, status: next } : j));
    } catch (err) {
      console.error(err);
    } finally {
      setUpdating(null);
    }
  };

  const deleteJob = async (job) => {
    const confirmed = window.confirm(
      `Delete "${job.title}" and all of its applications and uploaded resumes? This cannot be undone.`
    );
    if (!confirmed) return;
    setUpdating(job._id);
    try {
      await api.delete(`/jobs/${job._id}`);
      setJobs((previous) => previous.filter((item) => item._id !== job._id));
    } catch (err) {
      window.alert(err.response?.data?.error || "Failed to delete job.");
    } finally {
      setUpdating(null);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">My Jobs</h1>
          <p className="text-slate-400 text-sm mt-1">
            {jobs.length} job{jobs.length !== 1 ? "s" : ""} posted
          </p>
        </div>
        <Link
          to="/recruiter/jobs/new"
          className="flex items-center gap-2 bg-blue-500 hover:bg-blue-400 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          + Post New Job
        </Link>
      </div>

      {jobs.length === 0 ? (
        <div className="bg-[#111D2C] border border-slate-800 rounded-xl p-16 text-center">
          <div className="text-4xl mb-4">📋</div>
          <p className="text-white font-medium">No jobs yet</p>
          <p className="text-slate-400 text-sm mt-1">
            Create your first job posting to start finding candidates
          </p>
          <Link
            to="/recruiter/jobs/new"
            className="mt-4 inline-flex items-center gap-1 text-blue-400 hover:text-blue-300 text-sm transition-colors"
          >
            Post a job →
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {jobs.map((job) => (
            <div
              key={job._id}
              className="bg-[#111D2C] border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition-all"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-white font-semibold">{job.title}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${
                      job.status === "active"
                        ? "bg-green-500/10 text-green-400 border-green-500/20"
                        : job.status === "paused"
                        ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                        : "bg-slate-500/10 text-slate-400 border-slate-700"
                    }`}>
                      {job.status}
                    </span>
                  </div>
                  <p className="text-slate-400 text-sm mt-1">
                    {job.location} · <span className="capitalize">{job.type}</span>
                  </p>

                  {/* ✅ Show the unique jobId */}
                  <p className="text-slate-600 text-xs mt-1 font-mono">ID: {job.jobId}</p>

                  {job.requiredSkills?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2.5">
                      {job.requiredSkills.slice(0, 6).map((skill) => (
                        <span
                          key={skill}
                          className="text-xs px-2 py-0.5 bg-blue-500/10 text-blue-400 rounded-md border border-blue-500/20"
                        >
                          {skill}
                        </span>
                      ))}
                      {job.requiredSkills.length > 6 && (
                        <span className="text-xs px-2 py-0.5 text-slate-500">
                          +{job.requiredSkills.length - 6} more
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                  <Link
                    to={`/recruiter/jobs/${job._id}/edit`}
                    className="text-xs px-3 py-1.5 border border-slate-700 text-slate-300 rounded-lg hover:border-slate-600 hover:text-white transition-all"
                  >
                    Edit
                  </Link>
                  {/* ✅ FIX: pass job.jobId not job._id to copyLink */}
                  <button
                    onClick={() => copyLink(job.jobId)}
                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 border border-slate-700 text-slate-300 rounded-lg hover:border-slate-600 hover:text-white transition-all"
                  >
                    {copied === job.jobId ? "✓ Copied!" : "🔗 Copy Link"}
                  </button>

                  <button
                    onClick={() => toggleStatus(job)}
                    disabled={updating === job._id}
                    className="text-xs px-3 py-1.5 border border-slate-700 text-slate-300 rounded-lg hover:border-slate-600 hover:text-white transition-all disabled:opacity-50"
                  >
                    {updating === job._id ? "…" : job.status === "active" ? "Pause" : "Activate"}
                  </button>

                  <button
                    onClick={() => deleteJob(job)}
                    disabled={updating === job._id}
                    className="text-xs px-3 py-1.5 border border-red-500/20 text-red-400 rounded-lg hover:bg-red-500/10 transition-all disabled:opacity-50"
                  >
                    Delete
                  </button>

                  <Link
                    to={`/recruiter/jobs/${job.jobId}/applications`}
                    className="text-xs px-3 py-1.5 bg-blue-500/15 text-blue-400 border border-blue-500/20 rounded-lg hover:bg-blue-500/25 transition-all"
                  >
                    View Applications →
                  </Link>
                </div>
              </div>

              <div className="mt-3 pt-3 border-t border-slate-800 flex items-center gap-4 text-xs text-slate-500">
                <span>Posted {new Date(job.createdAt).toLocaleDateString()}</span>
                <span>{job.totalApplications || 0} application{job.totalApplications !== 1 ? "s" : ""}</span>
                {job.deadline && <span>Deadline {new Date(job.deadline).toLocaleDateString()}</span>}
                <span className="capitalize">{job.experienceLevel || "mid"} level</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
