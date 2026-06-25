import { useEffect, useState, useRef } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";

export default function ApplyJob() {
  const { jobId } = useParams();
  const fileRef = useRef(null);

  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ fullName: "", email: "" });
  const [file, setFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const deadlinePassed = Boolean(job?.deadline && new Date(job.deadline) < new Date());

  useEffect(() => {
    axios.get(`/api/jobs/apply/${jobId}`)
      .then((res) => setJob(res.data.job || res.data))
      .catch(() => setError("Job not found or no longer available."))
      .finally(() => setLoading(false));
  }, [jobId]);

  const handleFile = (f) => {
    if (f && f.type === "application/pdf") { setFile(f); setError(""); }
    else setError("Please upload a PDF file.");
  };

  const handleDrop = (e) => {
    e.preventDefault(); setDragOver(false);
    handleFile(e.dataTransfer.files[0]);
  };

  const handleSubmit = async () => {
    if (!form.fullName.trim()) { setError("Please enter your full name."); return; }
    if (!form.email.trim()) { setError("Please enter your email."); return; }
    if (!file) { setError("Please attach your resume (PDF)."); return; }
    setSubmitting(true); setError("");
    try {
      const fd = new FormData();
      fd.append("resume", file);
      fd.append("fullName", form.fullName);
      fd.append("email", form.email);
      await axios.post(`/api/applications/jobs/${jobId}/apply`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setSuccess(true);
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data?.error || "Application failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-[#0D1B2A] flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (error && !job) return (
    <div className="min-h-screen bg-[#0D1B2A] flex items-center justify-center px-4">
      <p className="text-red-400">{error}</p>
    </div>
  );

  if (success) return (
    <div className="min-h-screen bg-[#0D1B2A] flex items-center justify-center px-4">
      <div className="bg-[#111D2C] border border-slate-800 rounded-2xl p-12 text-center max-w-md w-full">
        <div className="text-5xl mb-4">🎉</div>
        <h2 className="text-white text-2xl font-bold">Application Submitted!</h2>
        <p className="text-slate-400 mt-2">Our AI is analyzing your resume against the job requirements.</p>
        <p className="text-slate-500 text-sm mt-4">You'll hear back via email if you're shortlisted.</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0D1B2A]">
      <div className="absolute inset-0 bg-[linear-gradient(rgba(59,130,246,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(59,130,246,0.03)_1px,transparent_1px)] bg-[size:64px_64px]" />
      <div className="relative max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">

        {/* Logo */}
        <div className="flex items-center gap-2 mb-8">
          <div className="w-8 h-8 rounded-lg bg-blue-500 flex items-center justify-center shadow-lg shadow-blue-500/30">
            <svg className="w-4 h-4 text-white" viewBox="0 0 20 20" fill="currentColor">
              <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z"/>
              <path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5z" clipRule="evenodd"/>
            </svg>
          </div>
          <span className="text-white font-semibold">Resume<span className="text-blue-400">AI</span></span>
        </div>

        {/* Job header */}
        <div className="bg-[#111D2C] border border-slate-800 rounded-xl p-6 mb-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-white">{job?.title}</h1>
              <div className="flex flex-wrap gap-3 mt-2 text-sm text-slate-400">
                {job?.location && <span>📍 {job.location}</span>}
                {job?.type && <span className="capitalize">⏰ {job.type}</span>}
                {job?.company && <span>🏢 {job.company}</span>}
              </div>
            </div>
            <span className={`text-xs px-2.5 py-1 rounded-full border shrink-0 ${
              job?.status === "active" && !deadlinePassed
                ? "bg-green-500/10 text-green-400 border-green-500/20"
                : "bg-slate-500/10 text-slate-400 border-slate-700"
            }`}>
              {job?.status === "active" && !deadlinePassed ? "Now Hiring" : "Closed"}
            </span>
          </div>
          {job?.requiredSkills?.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-4">
              {job.requiredSkills.map((skill) => (
                <span key={skill} className="text-xs px-2 py-0.5 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-md">
                  {skill}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Job details */}
          <div className="space-y-4">
            {job?.description && (
              <div className="bg-[#111D2C] border border-slate-800 rounded-xl p-5">
                <h3 className="text-white font-semibold text-sm mb-3">About the Role</h3>
                <p className="text-slate-400 text-sm leading-relaxed whitespace-pre-line">{job.description}</p>
              </div>
            )}
            {job?.requirements?.length > 0 && (
              <div className="bg-[#111D2C] border border-slate-800 rounded-xl p-5">
                <h3 className="text-white font-semibold text-sm mb-3">Requirements</h3>
                <ul className="space-y-1.5">
                  {job.requirements.map((r, i) => (
                    <li key={i} className="text-slate-400 text-sm flex gap-2">
                      <span className="text-blue-400 mt-0.5">•</span><span>{r}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Application form */}
          <div className="bg-[#111D2C] border border-slate-800 rounded-xl p-6">
            <h2 className="text-white font-semibold mb-5">Apply Now</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Full Name <span className="text-blue-400">*</span></label>
                <input
                  type="text"
                  value={form.fullName}
                  onChange={(e) => setForm(f => ({ ...f, fullName: e.target.value }))}
                  placeholder="Jane Smith"
                  className="w-full px-4 py-2.5 bg-[#0D1B2A] border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-all text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Email <span className="text-blue-400">*</span></label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="you@example.com"
                  className="w-full px-4 py-2.5 bg-[#0D1B2A] border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-all text-sm"
                />
              </div>

              {/* Drop zone */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Resume (PDF) <span className="text-blue-400">*</span></label>
                <div
                  onClick={() => fileRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
                    dragOver ? "border-blue-500 bg-blue-500/5"
                    : file ? "border-green-500/40 bg-green-500/5"
                    : "border-slate-700 hover:border-slate-600"
                  }`}
                >
                  <input ref={fileRef} type="file" accept=".pdf" className="hidden" onChange={(e) => handleFile(e.target.files[0])} />
                  {file ? (
                    <div>
                      <div className="text-green-400 text-xl mb-1">✓</div>
                      <p className="text-green-400 text-sm font-medium">{file.name}</p>
                      <p className="text-slate-500 text-xs mt-0.5">Click to change</p>
                    </div>
                  ) : (
                    <div>
                      <div className="text-2xl mb-1">📄</div>
                      <p className="text-slate-300 text-sm font-medium">Drop your resume here</p>
                      <p className="text-slate-500 text-xs mt-0.5">or click to browse · PDF only</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {error && <p className="mt-3 text-red-400 text-sm">{error}</p>}

            <button
              onClick={handleSubmit}
              disabled={submitting || job?.status !== "active" || deadlinePassed}
              className="w-full mt-5 py-3 bg-blue-500 hover:bg-blue-400 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {submitting ? (
                <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Submitting…</>
              ) : job?.status !== "active" || deadlinePassed ? "Position Closed" : "Submit Application"}
            </button>
            <p className="mt-3 text-center text-xs text-slate-500">No account needed · Takes 30 seconds</p>
          </div>
        </div>
      </div>
    </div>
  );
}
