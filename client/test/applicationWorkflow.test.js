import test from 'node:test';
import assert from 'node:assert/strict';
import { notificationApprovalNeeded, notificationFeedback } from '../src/utils/applicationWorkflow.js';

test('only transitions that can send a candidate status email need approval', () => {
  assert.equal(notificationApprovalNeeded('applied', 'shortlisted'), true);
  assert.equal(notificationApprovalNeeded('reviewing', 'rejected'), true);
  assert.equal(notificationApprovalNeeded('applied', 'reviewing'), false);
  assert.equal(notificationApprovalNeeded('shortlisted', 'shortlisted'), false);
});
test('failed email delivery is not represented as a failed stage change', () => {
  assert.equal(notificationFeedback({ notification: { sent: false, error: 'SMTP not configured.' } }), 'Stage updated. SMTP not configured.');
  assert.equal(notificationFeedback({ notification: { sent: true } }), 'Stage updated and candidate email sent.');
});
