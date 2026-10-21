import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { PageHeader, Spinner, ScoreRing, StatusBadge, STATUS_CONFIG } from '../../components/ui';
import { ScoreReasoning } from '../../components/ScoreReasoning';
import { analysisState, isScoreReady } from '../../utils/candidateComparison';
import { notificationApprovalNeeded, notificationFeedback } from '../../utils/applicationWorkflow';

export default function CandidateDetail() {
  const { id } = useParams();
  const { api } = useAuth();
  const [application, setApplication] = useState(null);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [preview, setPreview] = useState(null);
  const previewRef = useRef(null);
  const refresh = useCallback(async () => {
    const { data } = await api.get(`/applications/${id}`);
    setApplication(data.application);
    return data.application;
  }, [api, id]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(''); setPreview(null);
    api.get(`/applications/${id}`).then(({ data }) => {
      if (active) { setApplication(data.application); setNotes(data.application.recruiterNotes || ''); }
    }).catch(err => { if (active) setError(err.response?.data?.error || 'Unable to load this application.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [api, id]);
  useEffect(() => () => { if (previewRef.current) URL.revokeObjectURL(previewRef.current); }, [id]);
  const pending = application && ['queued', 'processing'].includes(analysisState(application));
  useEffect(() => {
    if (!pending) return;
    const timer = setInterval(() => refresh().catch(() => {}), 20000);
    return () => clearInterval(timer);
  }, [pending, refresh]);

  const perform = async task => {
    setBusy(true); setError(''); setMessage('');
    try { await task(); }
    catch (err) { setError(err.response?.data?.error || 'The request did not finish. Refresh before trying again.'); }
    finally { setBusy(false); }
  };
  const changeStatus = next => {
    if (notificationApprovalNeeded(application.status, next) && !window.confirm(`Move ${application.candidate?.fullName || 'this applicant'} to ${next}? This will attempt to send a candidate email.`)) return;
    perform(async () => {
      const { data } = await api.patch(`/applications/${id}/status`, { status: next, expectedStatus: application.status });
      await refresh(); setMessage(notificationFeedback(data));
    });
  };
  const resumeFile = async previewOnly => perform(async () => {
    const response = await api.get(`/applications/${id}/resume`, { responseType: 'blob' });
    const url = URL.createObjectURL(new Blob([response.data], { type: previewOnly ? 'application/pdf' : response.data.type || 'application/octet-stream' }));
    if (previewOnly) {
      if (previewRef.current) URL.revokeObjectURL(previewRef.current);
      previewRef.current = url; setPreview(url);
    } else {
      const link = document.createElement('a'); link.href = url;
      link.download = application.resume?.originalFileName || 'resume'; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
  });

  if (loading) return <Spinner />;
  if (!application) return <div className="max-w-4xl mx-auto p-8"><p role="alert" className="text-rose-300">{error || 'Application not found.'}</p><Link to="/recruiter/jobs" className="btn-secondary mt-4">Back to jobs</Link></div>;
  const jobId = application.job.jobId;
  const isPdf = /\.pdf$/i.test(application.resume?.originalFileName || '');
  return <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
    <PageHeader title={application.candidate?.fullName || 'Candidate details'} subtitle={`${application.job.title} at ${application.job.company || 'your company'}`}
      eyebrow={<Link to={`/recruiter/jobs/${jobId}/applications`} className="text-blue-300 text-sm">Back to applications</Link>}
      actions={<><button disabled={busy} onClick={() => perform(async () => { await refresh(); setMessage('Application refreshed.'); })} className="btn-secondary">Refresh</button><Link to={`/recruiter/jobs/${jobId}/pipeline`} className="btn-secondary">Pipeline board</Link></>} />
    {error && <p role="alert" className="mb-5 rounded-lg border border-rose-500/30 p-4 text-rose-300">{error}</p>}
    {message && <p role="status" className="mb-5 rounded-lg border border-blue-500/30 p-4 text-blue-200">{message}</p>}
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-6">
        <section className="card p-5" aria-label="Candidate assessment">
          <div className="flex flex-wrap items-center gap-4">
            <ScoreRing score={application.matchScore} pending={!isScoreReady(application)} pendingLabel={pending ? 'Analyzing' : 'No score'} />
            <div className="flex-1"><StatusBadge status={application.status} /><p className="mt-2 text-sm text-slate-300">{application.candidate?.email}</p>{application.candidate?.phone && <p className="text-sm text-slate-400">{application.candidate.phone}</p>}
              <p className="mt-2 text-xs text-slate-400">Analysis: {analysisState(application)}</p></div>
            <button disabled={busy || pending} className="btn-secondary btn-sm" onClick={() => perform(async () => { await api.post(`/applications/${id}/reprocess`); await refresh(); setMessage('Analysis attempt finished. Review the result below.'); })}>Run analysis again</button>
          </div>
          <ScoreReasoning app={application} />
        </section>
        <section className="card p-5" aria-labelledby="resume-heading">
          <h2 id="resume-heading" className="text-lg text-white font-semibold">Resume</h2>
          <p className="mt-1 text-xs text-slate-400 break-all">{application.resume?.originalFileName || 'No resume attached'}</p>
          {application.resume && <div className="flex flex-wrap gap-3 mt-4">
            <button disabled={busy} onClick={() => resumeFile(false)} className="btn-secondary btn-sm">Download resume</button>
            {isPdf && <button disabled={busy} onClick={() => resumeFile(true)} className="btn-secondary btn-sm">Preview PDF</button>}
          </div>}
          {preview && <iframe title="Candidate resume preview" src={preview} className="w-full h-[600px] mt-4 rounded-lg bg-white" />}
          <details className="mt-4 text-sm text-slate-300"><summary className="cursor-pointer text-blue-300">Read extracted resume text</summary>
            <p className="mt-3 whitespace-pre-wrap break-words text-xs leading-relaxed">{application.resume?.rawText || 'No extracted text available.'}</p>
            {application.resume?.textTruncated && <p className="text-amber-300 text-xs mt-2">Preview shortened. Download the resume for the full document.</p>}
          </details>
        </section>
        {application.coverLetter && <section className="card p-5"><h2 className="font-semibold text-white">Cover letter</h2><p className="mt-3 whitespace-pre-wrap text-sm text-slate-300">{application.coverLetter}</p></section>}
      </div>
      <aside className="space-y-6">
        <section className="card p-5"><h2 className="font-semibold text-white">Hiring stage</h2>
          <label className="block text-xs text-slate-400 mt-3" htmlFor="candidate-stage">Move applicant to</label>
          <select id="candidate-stage" disabled={busy} value={application.status} onChange={event => changeStatus(event.target.value)} className="input w-full mt-2">{Object.entries(STATUS_CONFIG).map(([value, config]) => <option key={value} value={value}>{config.label}</option>)}</select>
        </section>
        <section className="card p-5"><label htmlFor="candidate-notes" className="font-semibold text-white">Recruiter notes</label>
          <textarea id="candidate-notes" value={notes} maxLength={20000} onChange={event => setNotes(event.target.value)} rows={7} className="input w-full mt-3" placeholder="Interview observations and follow-up notes" />
          <button className="btn-primary btn-sm mt-3" disabled={busy || notes === (application.recruiterNotes || '')} onClick={() => perform(async () => { await api.patch(`/applications/${id}/notes`, { recruiterNotes: notes }); setApplication(current => ({ ...current, recruiterNotes: notes })); setMessage('Notes saved.'); })}>Save notes</button>
          <p className="mt-2 text-xs text-slate-500">Only this job's recruiter can view these notes. Saving does not send an email.</p>
        </section>
        <section className="card p-5"><h2 className="font-semibold text-white">Application history</h2>
          <ol className="mt-4 space-y-4 text-sm text-slate-300">
            <li>Application submitted<p className="mt-1 text-xs text-slate-500">{new Date(application.createdAt).toLocaleString()}</p></li>
            {(application.statusHistory || []).filter(item => item.fromStatus).map((item, index) => <li key={item._id || index}>{STATUS_CONFIG[item.fromStatus]?.label || item.fromStatus} → {STATUS_CONFIG[item.toStatus]?.label || item.toStatus}<p className="mt-1 text-xs text-slate-500">{new Date(item.changedAt).toLocaleString()}{item.changedBy?.fullName ? ` by ${item.changedBy.fullName}` : ''}</p></li>)}
          </ol>
          {!application.statusHistory?.some(item => !item.fromStatus) && <p className="mt-3 text-xs text-slate-500">Earlier stage changes were not recorded. New changes will appear here.</p>}
        </section>
      </aside>
    </div>
  </div>;
}
