// ─── Shared layout wrapper ───────────────────────────────────────────────────
function wrap(title, bodyHtml) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#F1F5F9;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F1F5F9;padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#FFFFFF;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#1E40AF 0%,#3B82F6 100%);padding:32px 40px;">
            <h1 style="margin:0;color:#FFFFFF;font-size:24px;font-weight:700;letter-spacing:-0.5px;">Skystruct</h1>
            <p style="margin:4px 0 0;color:rgba(255,255,255,0.75);font-size:13px;">Project Management Platform</p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:36px 40px;">
            ${bodyHtml}
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#F8FAFF;padding:20px 40px;border-top:1px solid #E2E8F0;">
            <p style="margin:0;color:#94A3B8;font-size:12px;text-align:center;">
              This is an automated notification from Skystruct App. Please do not reply to this email.
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ─── Reusable UI blocks ───────────────────────────────────────────────────────
function infoRow(label, value) {
  return `<tr>
    <td style="padding:10px 0;border-bottom:1px solid #F1F5F9;">
      <span style="color:#64748B;font-size:13px;">${label}</span>
    </td>
    <td style="padding:10px 0;border-bottom:1px solid #F1F5F9;text-align:right;">
      <span style="color:#0F172A;font-size:13px;font-weight:600;">${value}</span>
    </td>
  </tr>`;
}

function badge(text, color) {
  const colors = {
    green:  { bg: "#D1FAE5", fg: "#065F46" },
    red:    { bg: "#FEE2E2", fg: "#991B1B" },
    blue:   { bg: "#DBEAFE", fg: "#1E40AF" },
    yellow: { bg: "#FEF3C7", fg: "#92400E" },
    gray:   { bg: "#F1F5F9", fg: "#475569" },
  };
  const c = colors[color] || colors.gray;
  return `<span style="background:${c.bg};color:${c.fg};padding:4px 12px;border-radius:999px;font-size:12px;font-weight:700;display:inline-block;">${text}</span>`;
}

// ─── 1. Welcome / User Onboarding ────────────────────────────────────────────
export function welcomeEmail({ name, email, password, role, projects = [] }) {
  const projectList = projects.length
    ? `<ul style="margin:0;padding-left:18px;color:#475569;font-size:14px;">${projects.map(p => `<li>${p}</li>`).join("")}</ul>`
    : `<p style="color:#94A3B8;font-size:13px;margin:0;">No projects assigned yet.</p>`;

  return wrap("Welcome to Skystruct", `
    <h2 style="margin:0 0 8px;color:#0F172A;font-size:22px;font-weight:700;">Welcome aboard, ${name}!</h2>
    <p style="margin:0 0 28px;color:#64748B;font-size:15px;line-height:1.6;">
      Your account has been created on <strong>Skystruct</strong>. Below are your login credentials. Please log in and change your password as soon as possible.
    </p>

    <div style="background:#F8FAFF;border:1px solid #E2E8F0;border-radius:12px;padding:24px;margin-bottom:28px;">
      <p style="margin:0 0 4px;font-size:11px;font-weight:700;color:#94A3B8;text-transform:uppercase;letter-spacing:1px;">Your Credentials</p>
      <table width="100%" cellpadding="0" cellspacing="0">
        ${infoRow("Email", email)}
        ${infoRow("Password", `<code style="background:#EFF6FF;padding:2px 8px;border-radius:6px;font-size:14px;color:#1E40AF;">${password}</code>`)}
        ${infoRow("Role", role || "Team Member")}
      </table>
    </div>

    <p style="margin:0 0 8px;font-size:13px;font-weight:700;color:#0F172A;text-transform:uppercase;letter-spacing:0.5px;">Assigned Projects</p>
    ${projectList}

    <div style="margin-top:28px;background:#FEF3C7;border:1px solid #FDE68A;border-radius:10px;padding:14px 18px;">
      <p style="margin:0;color:#92400E;font-size:13px;">
        <strong>Security reminder:</strong> Change your password immediately after your first login.
      </p>
    </div>
  `);
}

// ─── 2. BOQ Item Status Changed ───────────────────────────────────────────────
export function boqStatusEmail({ recipientName, itemDescription, itemNumber, status, approverName, projectName, version }) {
  const isApproved = status === "Approved";
  const statusBadge = badge(status, isApproved ? "green" : status === "Rejected" ? "red" : "yellow");

  return wrap(`BOQ Item ${status}`, `
    <h2 style="margin:0 0 8px;color:#0F172A;font-size:20px;font-weight:700;">BOQ Item ${status}</h2>
    <p style="margin:0 0 24px;color:#64748B;font-size:14px;">
      Hi ${recipientName}, a BOQ item you submitted has been reviewed.
    </p>

    <div style="background:#F8FAFF;border:1px solid #E2E8F0;border-radius:12px;padding:24px;margin-bottom:24px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        ${infoRow("Project", projectName)}
        ${infoRow("Item", itemDescription || itemNumber)}
        ${infoRow("Version", `v${version || 1}`)}
        ${infoRow("Status", statusBadge)}
        ${infoRow("Reviewed by", approverName)}
      </table>
    </div>

    ${isApproved
      ? `<p style="color:#065F46;background:#D1FAE5;border-radius:10px;padding:14px 18px;margin:0;font-size:14px;">This BOQ item has been <strong>approved</strong> and will be reflected in project budgeting.</p>`
      : `<p style="color:#991B1B;background:#FEE2E2;border-radius:10px;padding:14px 18px;margin:0;font-size:14px;">This BOQ item was <strong>not approved</strong>. Please revise it and resubmit for approval.</p>`
    }
  `);
}

// ─── 3. Budget Request (sent to approver) ─────────────────────────────────────
export function budgetRequestEmail({ approverName, requesterName, projectName, amount, reason }) {
  return wrap("Budget Approval Request", `
    <h2 style="margin:0 0 8px;color:#0F172A;font-size:20px;font-weight:700;">Budget Increase Request</h2>
    <p style="margin:0 0 24px;color:#64748B;font-size:14px;">
      Hi ${approverName}, <strong>${requesterName}</strong> has submitted a budget increase request for your review.
    </p>

    <div style="background:#F8FAFF;border:1px solid #E2E8F0;border-radius:12px;padding:24px;margin-bottom:24px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        ${infoRow("Project", projectName)}
        ${infoRow("Requested Amount", `<strong style="color:#1E40AF;">₹${Number(amount).toLocaleString("en-IN")}</strong>`)}
        ${infoRow("Reason", reason || "—")}
        ${infoRow("Requested by", requesterName)}
      </table>
    </div>

    <p style="color:#92400E;background:#FEF3C7;border-radius:10px;padding:14px 18px;margin:0;font-size:14px;">
      Please open the Skystruct app to <strong>approve or reject</strong> this budget request.
    </p>
  `);
}

// ─── 4. Budget Decision (sent to requester) ───────────────────────────────────
export function budgetDecisionEmail({ requesterName, approverName, projectName, amount, action }) {
  const isApproved = action === "Approved";
  return wrap(`Budget Request ${action}`, `
    <h2 style="margin:0 0 8px;color:#0F172A;font-size:20px;font-weight:700;">Budget Request ${action}</h2>
    <p style="margin:0 0 24px;color:#64748B;font-size:14px;">
      Hi ${requesterName}, your budget increase request has been reviewed.
    </p>

    <div style="background:#F8FAFF;border:1px solid #E2E8F0;border-radius:12px;padding:24px;margin-bottom:24px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        ${infoRow("Project", projectName)}
        ${infoRow("Amount", `₹${Number(amount).toLocaleString("en-IN")}`)}
        ${infoRow("Decision", badge(action, isApproved ? "green" : "red"))}
        ${infoRow("Decided by", approverName)}
      </table>
    </div>

    ${isApproved
      ? `<p style="color:#065F46;background:#D1FAE5;border-radius:10px;padding:14px 18px;margin:0;font-size:14px;">Your budget request has been <strong>approved</strong>. The project budget has been updated.</p>`
      : `<p style="color:#991B1B;background:#FEE2E2;border-radius:10px;padding:14px 18px;margin:0;font-size:14px;">Your budget request was <strong>rejected</strong>. Please contact your project admin for more details.</p>`
    }
  `);
}

// ─── 5. Site Survey Submitted (sent to admin) ─────────────────────────────────
export function surveySumbittedEmail({ adminName, surveyorName, projectName }) {
  return wrap("Site Survey Submitted", `
    <h2 style="margin:0 0 8px;color:#0F172A;font-size:20px;font-weight:700;">Site Survey Submitted</h2>
    <p style="margin:0 0 24px;color:#64748B;font-size:14px;">
      Hi ${adminName}, a site survey has been submitted and is awaiting your review.
    </p>

    <div style="background:#F8FAFF;border:1px solid #E2E8F0;border-radius:12px;padding:24px;margin-bottom:24px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        ${infoRow("Project", projectName)}
        ${infoRow("Submitted by", surveyorName)}
        ${infoRow("Status", badge("Awaiting Review", "yellow"))}
      </table>
    </div>

    <p style="color:#1E40AF;background:#DBEAFE;border-radius:10px;padding:14px 18px;margin:0;font-size:14px;">
      Open the Skystruct app to review the survey findings and approve or request changes.
    </p>
  `);
}

// ─── 6. Site Survey Decision (sent to surveyor) ───────────────────────────────
export function surveyDecisionEmail({ surveyorName, adminName, projectName, action, rejectionReason }) {
  const isApproved = action === "Approve";
  return wrap(`Site Survey ${isApproved ? "Approved" : "Needs Attention"}`, `
    <h2 style="margin:0 0 8px;color:#0F172A;font-size:20px;font-weight:700;">
      Site Survey ${isApproved ? "Approved" : "Requires Revision"}
    </h2>
    <p style="margin:0 0 24px;color:#64748B;font-size:14px;">
      Hi ${surveyorName}, your site survey for <strong>${projectName}</strong> has been reviewed.
    </p>

    <div style="background:#F8FAFF;border:1px solid #E2E8F0;border-radius:12px;padding:24px;margin-bottom:24px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        ${infoRow("Project", projectName)}
        ${infoRow("Reviewed by", adminName)}
        ${infoRow("Decision", badge(isApproved ? "Approved" : "Needs Attention", isApproved ? "green" : "red"))}
        ${!isApproved && rejectionReason ? infoRow("Reason", rejectionReason) : ""}
      </table>
    </div>

    ${isApproved
      ? `<p style="color:#065F46;background:#D1FAE5;border-radius:10px;padding:14px 18px;margin:0;font-size:14px;">Great work! The project has been advanced to the <strong>Planning</strong> stage.</p>`
      : `<p style="color:#991B1B;background:#FEE2E2;border-radius:10px;padding:14px 18px;margin:0;font-size:14px;">Please review the feedback and resubmit the survey via the Skystruct lite app.</p>`
    }
  `);
}

// ─── 7. Issue Assigned ────────────────────────────────────────────────────────
export function issueAssignedEmail({ assigneeName, reporterName, projectName, issueTitle, priority, category }) {
  const priorityColor = { High: "red", Medium: "yellow", Low: "green" }[priority] || "gray";
  return wrap("Issue Assigned to You", `
    <h2 style="margin:0 0 8px;color:#0F172A;font-size:20px;font-weight:700;">Issue Assigned to You</h2>
    <p style="margin:0 0 24px;color:#64748B;font-size:14px;">
      Hi ${assigneeName}, an issue has been assigned to you for resolution.
    </p>

    <div style="background:#F8FAFF;border:1px solid #E2E8F0;border-radius:12px;padding:24px;margin-bottom:24px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        ${infoRow("Project", projectName)}
        ${infoRow("Issue", `<strong>${issueTitle}</strong>`)}
        ${infoRow("Category", category || "—")}
        ${infoRow("Priority", badge(priority || "Medium", priorityColor))}
        ${infoRow("Reported by", reporterName)}
      </table>
    </div>

    <p style="color:#1E40AF;background:#DBEAFE;border-radius:10px;padding:14px 18px;margin:0;font-size:14px;">
      Open the Skystruct lite app to view the full issue details and begin resolution.
    </p>
  `);
}

// ─── 8. Issue Status Changed ──────────────────────────────────────────────────
export function issueStatusEmail({ recipientName, issueTitle, oldStatus, newStatus, updatedByName, projectName }) {
  const statusColor = { Resolved: "green", Closed: "green", Escalated: "red", "In Progress": "blue" }[newStatus] || "gray";
  return wrap(`Issue Status: ${newStatus}`, `
    <h2 style="margin:0 0 8px;color:#0F172A;font-size:20px;font-weight:700;">Issue Status Updated</h2>
    <p style="margin:0 0 24px;color:#64748B;font-size:14px;">
      Hi ${recipientName}, an issue you are tracking has been updated.
    </p>

    <div style="background:#F8FAFF;border:1px solid #E2E8F0;border-radius:12px;padding:24px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        ${infoRow("Project", projectName)}
        ${infoRow("Issue", `<strong>${issueTitle}</strong>`)}
        ${infoRow("Previous Status", badge(oldStatus, "gray"))}
        ${infoRow("New Status", badge(newStatus, statusColor))}
        ${infoRow("Updated by", updatedByName)}
      </table>
    </div>
  `);
}

// ─── 9. Snag Assigned ────────────────────────────────────────────────────────
export function snagAssignedEmail({ assigneeName, reporterName, projectName, snagTitle, priority }) {
  const priorityColor = { High: "red", Medium: "yellow", Low: "green" }[priority] || "gray";
  return wrap("Snag Assigned to You", `
    <h2 style="margin:0 0 8px;color:#0F172A;font-size:20px;font-weight:700;">Snag Assigned to You</h2>
    <p style="margin:0 0 24px;color:#64748B;font-size:14px;">
      Hi ${assigneeName}, a snagging item has been assigned to you for rectification.
    </p>

    <div style="background:#F8FAFF;border:1px solid #E2E8F0;border-radius:12px;padding:24px;margin-bottom:24px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        ${infoRow("Project", projectName)}
        ${infoRow("Snag", `<strong>${snagTitle}</strong>`)}
        ${infoRow("Priority", badge(priority || "Medium", priorityColor))}
        ${infoRow("Reported by", reporterName)}
      </table>
    </div>

    <p style="color:#1E40AF;background:#DBEAFE;border-radius:10px;padding:14px 18px;margin:0;font-size:14px;">
      Please open the Skystruct lite app to view photos and details, then begin rectification.
    </p>
  `);
}

// ─── 10. Snag Status Changed ──────────────────────────────────────────────────
export function snagStatusEmail({ recipientName, snagTitle, newStatus, updatedByName, projectName }) {
  const statusColor = { Resolved: "green", Closed: "green", "In Progress": "blue" }[newStatus] || "gray";
  return wrap(`Snag Status: ${newStatus}`, `
    <h2 style="margin:0 0 8px;color:#0F172A;font-size:20px;font-weight:700;">Snag Status Updated</h2>
    <p style="margin:0 0 24px;color:#64748B;font-size:14px;">
      Hi ${recipientName}, a snag item you are tracking has a new status.
    </p>

    <div style="background:#F8FAFF;border:1px solid #E2E8F0;border-radius:12px;padding:24px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        ${infoRow("Project", projectName)}
        ${infoRow("Snag", `<strong>${snagTitle}</strong>`)}
        ${infoRow("New Status", badge(newStatus, statusColor))}
        ${infoRow("Updated by", updatedByName)}
      </table>
    </div>
  `);
}

// ─── 11. Document Approval Request ────────────────────────────────────────────
export function documentUploadedEmail({ approverName, uploaderName, projectName, documentName }) {
  return wrap("Document Awaiting Approval", `
    <h2 style="margin:0 0 8px;color:#0F172A;font-size:20px;font-weight:700;">Document Awaiting Your Approval</h2>
    <p style="margin:0 0 24px;color:#64748B;font-size:14px;">
      Hi ${approverName}, a document has been uploaded and requires your review.
    </p>

    <div style="background:#F8FAFF;border:1px solid #E2E8F0;border-radius:12px;padding:24px;margin-bottom:24px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        ${infoRow("Project", projectName)}
        ${infoRow("Document", `<strong>${documentName}</strong>`)}
        ${infoRow("Uploaded by", uploaderName)}
        ${infoRow("Status", badge("Pending Review", "yellow"))}
      </table>
    </div>

    <p style="color:#1E40AF;background:#DBEAFE;border-radius:10px;padding:14px 18px;margin:0;font-size:14px;">
      Open the Skystruct lite app to review and approve or reject this document.
    </p>
  `);
}

// ─── 12. Document Decision (sent to uploader) ─────────────────────────────────
export function documentDecisionEmail({ uploaderName, approverName, projectName, documentName, action, comment }) {
  const isApproved = action === "Approved";
  return wrap(`Document ${action}`, `
    <h2 style="margin:0 0 8px;color:#0F172A;font-size:20px;font-weight:700;">Document ${action}</h2>
    <p style="margin:0 0 24px;color:#64748B;font-size:14px;">
      Hi ${uploaderName}, a document you uploaded has been reviewed.
    </p>

    <div style="background:#F8FAFF;border:1px solid #E2E8F0;border-radius:12px;padding:24px;margin-bottom:24px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        ${infoRow("Project", projectName)}
        ${infoRow("Document", `<strong>${documentName}</strong>`)}
        ${infoRow("Decision", badge(action, isApproved ? "green" : "red"))}
        ${infoRow("Reviewed by", approverName)}
        ${comment ? infoRow("Comment", comment) : ""}
      </table>
    </div>

    ${isApproved
      ? `<p style="color:#065F46;background:#D1FAE5;border-radius:10px;padding:14px 18px;margin:0;font-size:14px;">Your document has been <strong>approved</strong> and is now active on the project.</p>`
      : `<p style="color:#991B1B;background:#FEE2E2;border-radius:10px;padding:14px 18px;margin:0;font-size:14px;">Your document requires revision. Please review the comment and upload a new version.</p>`
    }
  `);
}

// ─── 13. Password Reset OTP ───────────────────────────────────────────────────
export function otpEmail({ name, otp }) {
  return wrap("Password Reset OTP", `
    <h2 style="margin:0 0 8px;color:#0F172A;font-size:20px;font-weight:700;">Password Reset Request</h2>
    <p style="margin:0 0 24px;color:#64748B;font-size:14px;">
      Hi ${name}, we received a request to reset your password. Here is your One-Time Password (OTP).
    </p>

    <div style="background:#F8FAFF;border:1px solid #E2E8F0;border-radius:12px;padding:32px;margin-bottom:24px;text-align:center;">
      <p style="margin:0 0 8px;font-size:12px;font-weight:700;color:#94A3B8;text-transform:uppercase;letter-spacing:1px;">Your OTP Code</p>
      <div style="font-size:32px;font-weight:800;color:#1E40AF;letter-spacing:4px;">${otp}</div>
    </div>

    <p style="color:#92400E;background:#FEF3C7;border-radius:10px;padding:14px 18px;margin:0;font-size:14px;">
      <strong>Note:</strong> This OTP is valid for 10 minutes. If you did not request a password reset, please ignore this email.
    </p>
  `);
}
