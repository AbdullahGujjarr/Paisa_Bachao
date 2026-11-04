import nodemailer from 'nodemailer';

export const mailEnabled = Boolean(process.env.SMTP_HOST);

export function appUrl() {
  return (process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '');
}

let transport;
function getTransport() {
  transport ||= nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
  });
  return transport;
}

const escapeHtml = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/** Sends a one-button email. Without SMTP settings the link is printed to the server log instead. */
export async function sendActionEmail({ to, subject, heading, body, cta, url }) {
  if (!mailEnabled) {
    console.log(`[mail disabled] ${subject} -> ${to}\n  ${url}`);
    return false;
  }
  const html = `<div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:24px;color:#1f2933">
    <h2 style="color:#0b5d3f;margin:0 0 12px">${escapeHtml(heading)}</h2>
    <p style="line-height:1.5">${escapeHtml(body)}</p>
    <p style="margin:24px 0"><a href="${escapeHtml(url)}" style="background:#0b5d3f;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none">${escapeHtml(cta)}</a></p>
    <p style="color:#6b7280;font-size:13px">PaisaBachao - Your Money. Your Control. Your Savings.</p></div>`;
  await getTransport().sendMail({
    from: process.env.MAIL_FROM || 'PaisaBachao <no-reply@paisabachao.app>',
    to,
    subject,
    html,
    text: `${heading}\n\n${body}\n\n${cta}: ${url}`,
  });
  return true;
}
