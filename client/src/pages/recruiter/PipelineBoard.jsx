import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { PageHeader, Spinner, STATUS_CONFIG } from '../../components/ui';
import { analysisState, isScoreReady } from '../../utils/candidateComparison';
import { notificationApprovalNeeded, notificationFeedback } from '../../utils/applicationWorkflow';

export default function PipelineBoard() {
  const { jobId } = useParams();
  const { api } = useAuth();
  const [job, setJob] = useState(null);
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');
  const [dragging, setDragging] = useState(null);
  const load = useCallback(async () => {
    const { data } = await api.get(`/applications/job/${jobId}`);
    setJob(data.job); setApplications(data.applications || []);
  }, [api, jobId]);
  useEffect(() => {
    load().catch(err => setError(err.response?.data?.error || 'Unable to load the pipeline.')).finally(() => setLoading(false));
  }, [load]);

  const move = async (application, next) => {
    if (busy || application.status === next || !STATUS_CONFIG[next]) return;
    if (notificationApprovalNeeded(application.status, next) && !window.confirm(`Move ${application.candidate?.fullName || 'this applicant'} to ${next}? This will attempt to send a candidate email.`)) return;
    setBusy(true); setError(''); setMessage('');
    try {
      const { data } = await api.patch(`/applications/${application._id}/status`, { status: next, expectedStatus: application.status });
      setApplications(current => current.map(item => item._id === application._id ? { ...item, status: next, statusHistory: data.application.statusHistory } : item));
      setMessage(notificationFeedback(data));
    } catch (err) {
      setError(err.response?.data?.error || 'Stage update failed. Refresh and try again.');
      if (err.response?.status === 409) await load().catch(() => {});
    } finally { setBusy(false); setDragging(null); }
  };
  const query = search.trim().toLowerCase();
  const filtered = applications.filter(app => !query || `${app.candidate?.fullName || ''} ${app.candidate?.email || ''}`.toLowerCase().includes(query));
  if (loading) return <Spinner />;
  return <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
    <PageHeader title="Hiring pipeline" subtitle={job?.title || 'Job applications'}
      eyebrow={<Link className="text-sm text-blue-300" to={`/recruiter/jobs/${jobId}/applications`}>Back to applications</Link>}
      actions={<button className="btn-secondary" disabled={busy} onClick={() => load().catch(() => setError('Unable to refresh the board.'))}>Refresh board</button>} />
    <p className="text-sm text-slate-400 mb-4">Drag a card to a stage, or use its stage menu. Shortlist and rejection moves require email confirmation.</p>
    <label htmlFor="pipeline-search" className="sr-only">Search candidates</label>
    <input id="pipeline-search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search candidate name or email" className="input w-full sm:w-80 mb-5" />
    {error && <p role="alert" className="mb-4 border border-rose-500/30 rounded-lg p-3 text-sm text-rose-300">{error}</p>}
    {message && <p role="status" className="mb-4 border border-blue-500/30 rounded-lg p-3 text-sm text-blue-200">{message}</p>}
    {!applications.length && !error && <p className="text-slate-400 mb-5">No applicants yet. Share the job’s application link to get started.</p>}
    <div className="overflow-x-auto pb-4" role="region" aria-label="Hiring stages" tabIndex={0}>
      <div className="grid grid-cols-6 gap-4 min-w-[1500px]">
        {Object.entries(STATUS_CONFIG).map(([stage, config]) => {
          const candidates = filtered.filter(app => app.status === stage);
          return <section key={stage} aria-label={`${config.label} stage`} className={`rounded-xl border p-3 min-h-64 ${dragging ? 'border-blue-500/50 bg-blue-500/5' : 'border-slate-800 bg-[#0D1B2A]'}`}
            onDragOver={event => { if (dragging && !busy) event.preventDefault(); }}
            onDrop={event => { event.preventDefault(); const id = event.dataTransfer.getData('text/plain'); const app = applications.find(item => item._id === id); setDragging(null); if (app) move(app, stage); }}>
            <h2 className="flex justify-between gap-2 text-sm font-semibold text-white mb-4"><span>{config.label}</span><span className="text-slate-500">{candidates.length}</span></h2>
            <div className="space-y-3">{candidates.map(app => <article key={app._id} draggable={!busy} aria-label={`${app.candidate?.fullName || 'Candidate'} in ${config.label}`} className="card p-3 cursor-grab active:cursor-grabbing"
              onDragStart={event => { event.dataTransfer.setData('text/plain', app._id); event.dataTransfer.effectAllowed = 'move'; setDragging(app._id); }} onDragEnd={() => setDragging(null)}>
              <Link to={`/recruiter/applications/${app._id}`} className="font-semibold text-sm text-white hover:text-blue-300 break-words">{app.candidate?.fullName || 'Unknown candidate'}</Link>
              <p className="mt-1 text-xs text-slate-500 break-all">{app.candidate?.email}</p>
              <p className="mt-3 text-xs text-slate-300">{isScoreReady(app) ? `Match score: ${Math.round(app.matchScore || 0)}%` : `Analysis: ${analysisState(app)}`}</p>
              {analysisState(app) === 'fallback' && <p className="mt-1 text-xs text-amber-300">Fallback score - review evidence</p>}
              <label className="block mt-3 text-xs text-slate-500">Move to
                <select value={app.status} disabled={busy} onChange={event => move(app, event.target.value)} className="input w-full text-xs mt-1">{Object.entries(STATUS_CONFIG).map(([value, option]) => <option key={value} value={value}>{option.label}</option>)}</select>
              </label>
            </article>)}</div>
            {!candidates.length && <p className="text-xs text-slate-600 border border-dashed border-slate-800 rounded-lg p-4">{query ? 'No matching applicants' : 'No applicants in this stage'}</p>}
          </section>;
        })}
      </div>
    </div>
  </div>;
}
