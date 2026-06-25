import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

const JOB_TYPES = ["full-time", "part-time", "contract", "internship"];
const EXPERIENCE_LEVELS = ["entry", "mid", "senior", "lead"];

const emptyForm = {
  title: "",
  description: "",
  requirements: "",
  skills: "",
  niceToHaveSkills: "",
  type: "full-time",
  location: "",
  experienceLevel: "mid",
  deadline: "",
};

export default function PostJob() {
  const { api } = useAuth();
  const navigate = useNavigate();
  const { id } = useParams();
  const editing = Boolean(id);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingJob, setLoadingJob] = useState(editing);

  useEffect(() => {
    if (!editing) return;
    api.get(`/jobs/manage/${id}`)
      .then(({ data }) => {
        const job = data.job;
        setForm({
          title: job.title || "",
          description: job.description || "",
          requirements: (job.requirements || []).join("\n"),
          skills: (job.requiredSkills || []).join(", "),
          niceToHaveSkills: (job.niceToHaveSkills || []).join(", "),
          type: job.type || "full-time",
          location: job.location || "",
          experienceLevel: job.experienceLevel || "mid",
          deadline: job.deadline ? new Date(job.deadline).toISOString().slice(0, 10) : "",
        });
      })
      .catch((err) => setError(err.response?.data?.error || "Failed to load job"))
      .finally(() => setLoadingJob(false));
  }, [api, editing, id]);

  const handleChange = (event) => {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const payload = {
        title: form.title,
        description: form.description,
        type: form.type,
        location: form.location,
        experienceLevel: form.experienceLevel,
        deadline: form.deadline || null,
        requiredSkills: form.skills.split(",").map((skill) => skill.trim()).filter(Boolean),
        niceToHaveSkills: form.niceToHaveSkills.split(",").map((skill) => skill.trim()).filter(Boolean),
        requirements: form.requirements.split("\n").map((item) => item.trim()).filter(Boolean),
      };

      if (editing) {
        await api.put(`/jobs/${id}`, payload);
      } else {
        await api.post("/jobs", payload);
      }
      navigate("/recruiter/jobs");
    } catch (err) {
      setError(err.response?.data?.error || err.response?.data?.message || "Failed to save job");
    } finally {
      setLoading(false);
    }
  };

  if (loadingJob) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">{editing ? "Edit Job" : "Post a New Job"}</h1>
        <p className="text-slate-400 text-sm mt-1">
          {editing
            ? "Saving changes will automatically re-score existing applications."
            : "Add clear requirements so candidate rankings are meaningful."}
        </p>
      </div>

      {error && (
        <div className="mb-6 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-[#111D2C] border border-slate-800 rounded-xl p-6 space-y-5">
          <h2 className="text-sm uppercase tracking-wider text-slate-400 pb-2 border-b border-slate-800">
            Job Details
          </h2>

          <Field label="Job Title" required>
            <input name="title" value={form.title} onChange={handleChange} required placeholder="Senior Frontend Engineer" className={inputCls} />
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Job Type" required>
              <select name="type" value={form.type} onChange={handleChange} className={inputCls}>
                {JOB_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
              </select>
            </Field>
            <Field label="Location" required>
              <input name="location" value={form.location} onChange={handleChange} required placeholder="Remote or city" className={inputCls} />
            </Field>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Experience Level" required>
              <select name="experienceLevel" value={form.experienceLevel} onChange={handleChange} className={inputCls}>
                {EXPERIENCE_LEVELS.map((level) => <option key={level} value={level}>{level}</option>)}
              </select>
            </Field>
            <Field label="Application Deadline">
              <input
                type="date"
                name="deadline"
                value={form.deadline}
                onChange={handleChange}
                min={editing ? undefined : new Date(Date.now() + 86400000).toISOString().slice(0, 10)}
                className={inputCls}
              />
            </Field>
          </div>

          <Field label="Job Description" required>
            <textarea name="description" value={form.description} onChange={handleChange} required rows={5} placeholder="Responsibilities and role context" className={inputCls} />
          </Field>

          <Field label="Requirements" hint="One per line" required>
            <textarea name="requirements" value={form.requirements} onChange={handleChange} required rows={4} placeholder={"3+ years of experience\nStrong API design skills"} className={inputCls} />
          </Field>

          <Field label="Required Skills" hint="Comma-separated; 75% of local score" required>
            <input name="skills" value={form.skills} onChange={handleChange} required placeholder="React, TypeScript, Node.js" className={inputCls} />
          </Field>

          <Field label="Nice-to-have Skills" hint="Comma-separated">
            <input name="niceToHaveSkills" value={form.niceToHaveSkills} onChange={handleChange} placeholder="AWS, Docker, CI/CD" className={inputCls} />
          </Field>
        </div>

        <div className="flex gap-3 justify-end">
          <button type="button" onClick={() => navigate("/recruiter/jobs")} className="px-5 py-2.5 text-sm text-slate-400 hover:text-white border border-slate-700 rounded-lg">
            Cancel
          </button>
          <button type="submit" disabled={loading} className="px-6 py-2.5 bg-blue-500 hover:bg-blue-400 disabled:opacity-50 text-white font-medium rounded-lg text-sm">
            {loading ? "Saving..." : editing ? "Save and Re-score" : "Publish Job"}
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, hint, required, children }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-300 mb-1.5">
        {label}
        {required && <span className="text-blue-400 ml-1">*</span>}
        {hint && <span className="text-slate-500 font-normal ml-2 text-xs">{hint}</span>}
      </label>
      {children}
    </div>
  );
}

const inputCls = "w-full px-4 py-2.5 bg-[#0D1B2A] border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-all text-sm resize-none";
