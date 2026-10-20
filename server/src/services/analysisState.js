const ANALYSIS_LEASE_MS = 6 * 60 * 1000;

const analysisStatus = (application, now = Date.now()) => {
  const status = application.processingStatus;
  if ((!status || status === 'queued') && application.isAiProcessed) {
    return application.processingError ? 'fallback' : 'completed';
  }
  if (['completed', 'fallback', 'failed'].includes(status)) return status;
  const started = new Date(application.processingStartedAt || application.createdAt).getTime();
  if (Number.isFinite(started) && now - started > ANALYSIS_LEASE_MS) return 'interrupted';
  return status === 'processing' ? 'processing' : 'queued';
};

module.exports = { ANALYSIS_LEASE_MS, analysisStatus };
