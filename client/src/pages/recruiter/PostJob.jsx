import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

const JOB_TYPES = ["full-time", "part-time", "contract", "internship"];

export default function PostJob() {
  const { api } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    title: "", description: "", requirements: "", skills: "",
    type: "full-time", location: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const payload = {
        ...form,
        requiredSkills: form.skills.split(",").map((s) => s.trim()).filter(Boolean),
        requirements: form.requirements.split("\n").filter(Boolean),
      };
      await api.post("/jobs", payload);
      navigate("/recruiter/jobs");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to post job");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Post a New Job</h1>
        <p className="text-slate-400 text-sm mt-1">Fill out the details below — our AI will match the best candidates</p>
      </div>

      {error && (
        <div className="mb-6 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-[#111D2C] border border-slate-800 rounded-xl p-6 space-y-5">
          <h2 className="text-white font-medium text-sm uppercase tracking-wider text-slate-400 pb-2 border-b border-slate-800">
            Job Details
          </h2>

          <Field label="Job Title" required>
            <input
              type="text"
              name="title"
              value={form.title}
              onChange={handleChange}
              required
              placeholder="e.g. Senior Frontend Engineer"
              className={inputCls}
            />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Job Type" required>
              <select name="type" value={form.type} onChange={handleChange} className={inputCls}>
                {JOB_TYPES.map((t) => (
                  <option key={t} value={t} className="bg-[#0D1B2A]">{t}</option>
                ))}
              </select>
            </Field>
            <Field label="Location" required>
              <input
                type="text"
                name="location"
                value={form.location}
                onChange={handleChange}
                required
                placeholder="e.g. Remote, New York"
                className={inputCls}
              />
            </Field>
          </div>

          <Field label="Job Description" required>
            <textarea
              name="description"
              value={form.description}
              onChange={handleChange}
              required
              rows={5}
              placeholder="Describe the role, responsibilities, and what you're looking for…"
              className={inputCls}
            />
          </Field>

          <Field label="Requirements" hint="One per line" required>
            <textarea
              name="requirements"
              value={form.requirements}
              onChange={handleChange}
              required
              rows={4}
              placeholder={"3+ years of React experience\nStrong TypeScript skills\nExperience with REST APIs"}
              className={inputCls}
            />
          </Field>

          <Field label="Skills" hint="Comma-separated">
            <input
              type="text"
              name="skills"
              value={form.skills}
              onChange={handleChange}
              placeholder="React, TypeScript, Node.js, GraphQL"
              className={inputCls}
            />
          </Field>
        </div>

        <div className="flex gap-3 justify-end">
          <button
            type="button"
            onClick={() => navigate("/recruiter/jobs")}
            className="px-5 py-2.5 text-sm text-slate-400 hover:text-white border border-slate-700 hover:border-slate-600 rounded-lg transition-all"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2.5 bg-blue-500 hover:bg-blue-400 disabled:opacity-50 text-white font-medium rounded-lg text-sm transition-colors flex items-center gap-2"
          >
            {loading ? (
              <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Publishing…</>
            ) : "Publish Job"}
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
