import nodemailer from "nodemailer";

// Lazily created transporter so env vars are read at call time
let _transporter = null;

function getTransporter() {
  if (_transporter) return _transporter;

  _transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === "true", // true for 465, false for 587
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  return _transporter;
}

/**
 * Send an email. Fires-and-forgets so it never blocks an API response.
 * Logs the error if sending fails — never throws.
 */
export async function sendEmail({ to, subject, html, attachments = [] }) {
  if (!process.env.SMTP_USER) {
    console.warn("[email] SMTP_USER not set — email skipped:", subject);
    return;
  }

  try {
    const transporter = getTransporter();
    await transporter.sendMail({
      from: `"${process.env.SMTP_FROM_NAME || "Skystruct App"}" <${process.env.SMTP_USER}>`,
      to,
      subject,
      html,
      attachments,
    });
    console.log(`[email] Sent "${subject}" → ${to}`);
  } catch (err) {
    console.error("[email] Failed to send:", subject, "→", to, err.message);
  }
}
