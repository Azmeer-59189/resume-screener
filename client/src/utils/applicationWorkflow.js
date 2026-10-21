export const notificationApprovalNeeded = (current, next) => current !== next && ['shortlisted', 'rejected'].includes(next);
export function notificationFeedback(data) {
  if (data.notification?.sent) return 'Stage updated and candidate email sent.';
  if (data.notification && !data.notification.sent) return `Stage updated. ${data.notification.error || 'No email was sent.'}`;
  return 'Stage updated.';
}
