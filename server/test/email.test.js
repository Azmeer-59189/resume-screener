const test = require('node:test');
const assert = require('node:assert/strict');
const { buildStatusEmail, isEmailConfigured } = require('../src/services/email');

test('builds a shortlisted candidate email with job details', () => {
  const message = buildStatusEmail({
    status: 'shortlisted',
    candidateName: 'Jane Smith',
    jobTitle: 'AI Engineer',
    company: 'Acme'
  });

  assert.match(message.subject, /AI Engineer/);
  assert.match(message.text, /shortlisted/);
  assert.match(message.html, /Jane Smith/);
});

test('builds a respectful rejection email', () => {
  const message = buildStatusEmail({
    status: 'rejected',
    candidateName: 'Jane Smith',
    jobTitle: 'AI Engineer',
    company: 'Acme'
  });

  assert.match(message.subject, /Update/);
  assert.match(message.text, /not be moving forward/);
});

test('reports email as unconfigured without SMTP credentials', () => {
  const original = {
    SMTP_HOST: process.env.SMTP_HOST,
    SMTP_USER: process.env.SMTP_USER,
    SMTP_PASS: process.env.SMTP_PASS,
    MAIL_FROM: process.env.MAIL_FROM
  };
  delete process.env.SMTP_HOST;
  delete process.env.SMTP_USER;
  delete process.env.SMTP_PASS;
  delete process.env.MAIL_FROM;

  assert.equal(isEmailConfigured(), false);

  Object.assign(process.env, Object.fromEntries(
    Object.entries(original).filter(([, value]) => value !== undefined)
  ));
});
