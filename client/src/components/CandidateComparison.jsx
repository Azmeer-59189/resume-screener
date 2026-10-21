import { useEffect, useRef } from 'react';
import { StatusBadge } from './ui';
import { comparisonSkills, skillAssessment, isScoreReady, analysisState, matchingEvidence } from '../utils/candidateComparison';

const methodName = { agent: 'Hiring agent', local: 'Local score', ai: 'AI assessment', vector: 'Vector similarity' };

export default function CandidateComparison({ applications, requiredSkills, onClose, onDownload }) {
  const heading = useRef(null);
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
    heading.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);
  const skills = comparisonSkills(requiredSkills, applications);
  const score = (app, field) => isScoreReady(app) && field != null ? `${Math.round(field)}%` : 'Not available';
  const row = (label, render) => (
    <tr className="border-t border-slate-800">
      <th scope="row" className="p-4 text-left text-xs font-semibold text-slate-400 align-top">{label}</th>
      {applications.map(app => <td key={app._id} className="p-4 align-top text-sm text-slate-300 break-words">{render(app)}</td>)}
    </tr>
  );

  return (
    <section className="card mb-6" aria-labelledby="comparison-heading">
      <div className="p-5 flex items-start justify-between gap-4">
        <div>
          <h2 id="comparison-heading" ref={heading} tabIndex={-1} className="text-lg font-semibold text-white focus:outline-none">Candidate comparison</h2>
          <p className="mt-1 text-xs text-slate-400">Review evidence alongside scores. Different scoring methods or weights may produce different rankings.</p>
          <p className="mt-1 text-xs text-slate-500">Scroll horizontally on smaller screens to view all candidates.</p>
        </div>
        <button onClick={onClose} className="btn-secondary btn-sm">Close comparison</button>
      </div>
      <div className="overflow-x-auto" role="region" aria-label="Candidate comparison table" tabIndex={0}>
        <table className="w-full table-fixed" style={{ minWidth: 180 + applications.length * 280 }}>
          <caption className="sr-only">Scores, required skills, and resume evidence for selected candidates</caption>
          <thead>
            <tr>
              <th className="w-44 p-4 text-left text-xs text-slate-500" scope="col">Review criteria</th>
              {applications.map(app => <th key={app._id} scope="col" className="p-4 text-left align-top">
                <p className="text-sm text-white break-words">{app.candidate?.fullName || 'Unknown candidate'}</p>
                <p className="mt-1 text-xs font-normal text-slate-400 break-all">{app.candidate?.email}</p>
                {app.resume && <button className="mt-3 btn-secondary btn-sm" onClick={() => onDownload(app)}>Download resume</button>}
              </th>)}
            </tr>
          </thead>
          <tbody>
            {row('Application status', app => <StatusBadge status={app.status} />)}
            {row('Analysis', app => isScoreReady(app) ? (analysisState(app) === 'fallback' ? 'Score available with warnings' : 'Completed') : analysisState(app) === 'interrupted' || analysisState(app) === 'failed' ? 'Retry needed' : 'Analysis in progress')}
            {row('Overall score', app => <strong className="text-white text-lg">{score(app, app.matchScore)}</strong>)}
            {row('Scoring method', app => isScoreReady(app) ? methodName[app.scoringMethod] || 'Unknown' : 'Not available')}
            {row('Required skills score', app => <>{score(app, app.scoreBreakdown?.skillScore)}{isScoreReady(app) && app.scoreBreakdown?.skillWeight != null && <span className="block mt-1 text-xs text-slate-500">{app.scoreBreakdown.skillWeight}% weight</span>}</>)}
            {row('Context score', app => <>{score(app, app.scoreBreakdown?.contextScore)}{isScoreReady(app) && app.scoreBreakdown?.contextWeight != null && <span className="block mt-1 text-xs text-slate-500">{app.scoreBreakdown.contextWeight}% weight</span>}</>)}
            {skills.map(skill => <tr key={skill.toLowerCase()} className="border-t border-slate-800">
              <th scope="row" className="p-4 text-left text-xs text-slate-400 align-top break-words">{skill}</th>
              {applications.map(app => {
                const assessment = skillAssessment(app, skill);
                const evidence = isScoreReady(app) ? matchingEvidence(app, skill) : null;
                return <td key={app._id} className="p-4 align-top text-xs">
                  <p className={assessment === 'Matched' ? 'text-emerald-300' : assessment === 'Not demonstrated' ? 'text-amber-300' : 'text-slate-400'}>{assessment}</p>
                  {assessment === 'Matched' && (evidence?.excerpt ? <details className="mt-2 text-slate-400">
                    <summary className="cursor-pointer text-blue-300">View resume mention</summary>
                    <blockquote className="mt-2 whitespace-pre-wrap leading-relaxed">{evidence.excerpt}</blockquote>
                    <p className="mt-2 text-slate-500">A mention does not establish proficiency.</p>
                  </details> : <p className="mt-2 text-slate-500">No direct quotation saved. Review the resume.</p>)}
                </td>;
              })}
            </tr>)}
            {row('Score reasoning', app => isScoreReady(app) ? app.aiAnalysis || app.experienceSummary || 'No explanation available.' : 'Available after analysis completes.')}
            {row('Strengths', app => isScoreReady(app) ? app.strengths?.join(' ') || 'None recorded.' : 'Not available')}
            {row('Gaps', app => isScoreReady(app) ? app.weaknesses?.join(' ') || 'None recorded.' : 'Not available')}
            {row('Saved recruiter notes', app => <span className="whitespace-pre-wrap">{app.recruiterNotes || 'No saved notes.'}</span>)}
          </tbody>
        </table>
      </div>
    </section>
  );
}
