import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Home() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-[#0D1B2A] flex flex-col items-center justify-center px-4 text-center">
      <div className="absolute inset-0 bg-[linear-gradient(rgba(59,130,246,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(59,130,246,0.04)_1px,transparent_1px)] bg-[size:64px_64px]" />
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative max-w-2xl">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-500/10 border border-blue-500/20 rounded-full text-blue-400 text-xs font-medium mb-6">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
          AI-powered resume screening
        </div>

        <h1 className="text-5xl font-bold text-white leading-tight">
          Hire smarter with
          <span className="text-blue-400"> AI matching</span>
        </h1>

        <p className="text-slate-400 text-lg mt-4 max-w-xl mx-auto leading-relaxed">
          ResumeAI uses vector embeddings and LLMs to instantly rank candidates by job fit — so recruiters spend time on the best matches.
        </p>

        <div className="flex items-center justify-center gap-3 mt-8">
          {user ? (
            <Link
              to="/recruiter/dashboard"
              className="px-6 py-3 bg-blue-500 hover:bg-blue-400 text-white font-medium rounded-lg transition-colors"
            >
              Go to Dashboard →
            </Link>
          ) : (
            <>
              <Link to="/register" className="px-6 py-3 bg-blue-500 hover:bg-blue-400 text-white font-medium rounded-lg transition-colors">
                Create recruiter account
              </Link>
              <Link to="/login" className="px-6 py-3 border border-slate-700 hover:border-slate-600 text-slate-300 hover:text-white rounded-lg transition-all">
                Recruiter sign in
              </Link>
            </>
          )}
        </div>

        <div className="grid grid-cols-3 gap-4 mt-16">
          {[
            { icon: "🤖", label: "AI Scoring", desc: "LLM-powered match scores for every applicant" },
            { icon: "⚡", label: "Instant Ranking", desc: "Candidates ranked by fit in seconds" },
            { icon: "🔗", label: "Shareable Links", desc: "Unique apply links for every job posting" },
          ].map((f) => (
            <div key={f.label} className="bg-[#111D2C] border border-slate-800 rounded-xl p-5 text-left">
              <div className="text-2xl mb-2">{f.icon}</div>
              <p className="text-white text-sm font-semibold">{f.label}</p>
              <p className="text-slate-500 text-xs mt-1">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
