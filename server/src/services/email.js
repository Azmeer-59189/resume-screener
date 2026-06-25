const nodemailer = require('nodemailer');
const logger = require('../utils/logger');

let transporter;

const escapeHtml = value => String(value || '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');

const getTransporter = () => {
  if (transporter) return transporter;
  const port = Number(process.env.SMTP_PORT || 587);
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: process.env.SMTP_SECURE === 'true' || port === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
  return transporter;
};

exports.isEmailConfigured = () => Boolean(
  process.env.SMTP_HOST
  && process.env.SMTP_USER
  && process.env.SMTP_PASS
  && process.env.MAIL_FROM
);

exports.buildStatusEmail = ({ status, candidateName, jobTitle, company }) => {
  const safeName = escapeHtml(candidateName || 'Candidate');
  const safeJob = escapeHtml(jobTitle);
  const safeCompany = escapeHtml(company || 'the hiring team');

  if (status === 'shortlisted') {
    return {
      subject: `Your application for ${jobTitle} has been shortlisted`,
      text: `Hello ${candidateName},\n\nGood news — your application for ${jobTitle} at ${company} has been shortlisted. The hiring team will contact you with the next steps.\n\nBest regards,\n${company}`,
      html: `<p>Hello ${safeName},</p>
        <p>Good news — your application for <strong>${safeJob}</strong> at <strong>${safeCompany}</strong> has been shortlisted.</p>
        <p>The hiring team will contact you with the next steps.</p>
        <p>Best regards,<br>${safeCompany}</p>`
    };
  }

  if (status === 'rejected') {
    return {
      subject: `Update on your application for ${jobTitle}`,
      text: `Hello ${candidateName},\n\nThank you for applying for ${jobTitle} at ${company}. After careful review, we will not be moving forward with your application at this time.\n\nWe appreciate your interest and wish you success in your job search.\n\nBest regards,\n${company}`,
      html: `<p>Hello ${safeName},</p>
        <p>Thank you for applying for <strong>${safeJob}</strong> at <strong>${safeCompany}</strong>.</p>
        <p>After careful review, we will not be moving forward with your application at this time.</p>
        <p>We appreciate your interest and wish you success in your job search.</p>
        <p>Best regards,<br>${safeCompany}</p>`
    };
  }

  throw new Error(`No candidate email template exists for status: ${status}`);
};

exports.sendApplicationStatusEmail = async ({
  to,
  status,
  candidateName,
  jobTitle,
  company
}) => {
  if (!exports.isEmailConfigured()) {
    return {
      sent: false,
      skipped: true,
      error: 'Email is not configured. Add SMTP settings to server/.env.'
    };
  }

  const message = exports.buildStatusEmail({ status, candidateName, jobTitle, company });
  try {
    const result = await getTransporter().sendMail({
      from: process.env.MAIL_FROM,
      to,
      replyTo: process.env.MAIL_REPLY_TO || process.env.MAIL_FROM,
      subject: message.subject,
      text: message.text,
      html: message.html
    });
    logger.info(`Application ${status} email sent to ${to}`);
    return { sent: true, messageId: result.messageId };
  } catch (error) {
    logger.error(`Application email failed for ${to}: ${error.message}`);
    return { sent: false, error: error.message };
  }
};

exports.resetTransporterForTests = () => {
  transporter = undefined;
};
