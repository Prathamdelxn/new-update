import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import { withAuth } from "@/lib/middleware";
import Project from "@/models/Project";
import Milestone from "@/models/Milestone";
import Issue from "@/models/Issue";
import Snag from "@/models/Snag";
import User from "@/models/User";
import { sendEmail } from "@/lib/email";
import puppeteerCore from "puppeteer-core";
import chromium from "@sparticuz/chromium";
import puppeteer from "puppeteer";
import { xt } from "@/lib/exportI18n";
import Organization from "@/models/Organization";
import { PDF_LOGO_DATA_URI } from "@/lib/pdfLogo";

// Same terms line as the web's downloaded project report (lib/pdf/pdfExport.ts PDF_TERMS.report)
const REPORT_TERMS = "Terms & Conditions: This report records site progress as reported on the stated date. Quantities and progress figures are indicative and subject to joint measurement and verification.";

export const POST = withAuth(async function (req, { params }) {
  try {
    const { id } = await params;
    const { reportType, startDate, endDate, customTargetEmail, lang: rawLang } = await req.json();
    // lang from the web app: Arabic report + email when the user has Arabic selected
    const lang = rawLang === "ar" ? "ar" : "en";
    const T = (s) => xt(lang, s);
    const dateLocale = lang === "ar" ? "ar" : undefined;

    if (!startDate || !endDate) {
      return NextResponse.json({ message: "startDate and endDate are required" }, { status: 400 });
    }

    await dbConnect();

    // Fetch data
    const [project, milestones, issues, snags] = await Promise.all([
      Project.findById(id).lean(),
      Milestone.find({ project: id }).lean(),
      Issue.find({ project: id }).lean(),
      Snag.find({ project: id }).lean(),
    ]);

    if (!project) {
      return NextResponse.json({ message: "Project not found" }, { status: 404 });
    }
    const org = project.organization
      ? await Organization.findById(project.organization).select("name").lean().catch(() => null)
      : null;
    const orgName = org?.name || "SkyStruct";
    const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

    // Determine exact date bounds based on frontend logic
    let startLimit = new Date(startDate);
    startLimit.setHours(0, 0, 0, 0);
    let endLimit = new Date(endDate);
    endLimit.setHours(23, 59, 59, 999);

    let reportTitle = "";
    let dateRangeInfo = "";

    if (reportType === 'Daily') {
      reportTitle = T("Daily Project Report (Last 7 Days)");
      dateRangeInfo = `${T("Generated on:")} ${new Date().toLocaleDateString(dateLocale)}`;
    } else if (reportType === 'Monthly') {
      reportTitle = T("Monthly Project Report (Last 6 Months)");
      dateRangeInfo = `${T("Generated on:")} ${new Date().toLocaleDateString(dateLocale)}`;
    } else {
      reportTitle = T("Custom Range Project Report");
      dateRangeInfo = `${T("Range:")} ${startLimit.toLocaleDateString(dateLocale)} - ${endLimit.toLocaleDateString(dateLocale)}`;
    }

    // Filter tasks
    const allCompletedTasks = [];
    milestones.forEach(m => {
      if (m.tasks) {
        m.tasks.forEach(t => {
          if (t.isCompleted) {
            const compDate = new Date(t.completedAt || m.updatedAt || new Date());
            if (compDate >= startLimit && compDate <= endLimit) {
              allCompletedTasks.push({
                ...t,
                milestoneName: m.name,
                completedAtDate: compDate
              });
            }
          }
        });
      }
    });

    // Filter logs
    const rangeLogs = (project.auditTrail || [])
      .filter(log => {
        const d = new Date(log.timestamp);
        return d >= startLimit && d <= endLimit;
      })
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    // Filter issues
    const rangeIssues = issues
      .filter(issue => {
        const d = new Date(issue.createdAt);
        return d >= startLimit && d <= endLimit;
      })
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

    // Filter snags
    const rangeSnags = snags
      .filter(snag => {
        const d = new Date(snag.createdAt);
        return d >= startLimit && d <= endLimit;
      })
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

    // Generate HTML
    let tasksHTML = `<h3>${T("Completed Tasks")}</h3>`;
    if (allCompletedTasks.length === 0) {
      tasksHTML += `<p class='empty'>${T("No tasks completed in this range.")}</p>`;
    } else {
      tasksHTML += `<table>
        <thead>
          <tr>
            <th>${T("Milestone")}</th>
            <th>${T("Task Title")}</th>
            <th>${T("Start Date")}</th>
            <th>${T("End Date")}</th>
            <th>${T("Completion Date")}</th>
            <th>${T("Created By")}</th>
            <th>${T("Completed By")}</th>
          </tr>
        </thead>
        <tbody>`;
      allCompletedTasks.forEach(t => {
        const startStr = t.startDate ? new Date(t.startDate).toLocaleDateString(dateLocale) : T('N/A');
        const endStr = t.endDate ? new Date(t.endDate).toLocaleDateString(dateLocale) : T('N/A');
        const createdByStr = t.createdByName || T('Unknown');
        const completedByStr = t.completedByName || T('Unknown');
        tasksHTML += `<tr>
          <td>${t.milestoneName}</td>
          <td>${t.title}</td>
          <td>${startStr}</td>
          <td>${endStr}</td>
          <td>${t.completedAtDate.toLocaleDateString(dateLocale)}</td>
          <td>${createdByStr}</td>
          <td>${completedByStr}</td>
        </tr>`;
      });
      tasksHTML += `</tbody></table>`;
    }

    let issuesHTML = `<h3>${T("Reported Issues")}</h3>`;
    if (rangeIssues.length === 0) {
      issuesHTML += `<p class='empty'>${T("No issues reported in this range.")}</p>`;
    } else {
      issuesHTML += `<table>
        <thead>
          <tr>
            <th>${T("Issue Title")}</th>
            <th>${T("Category")}</th>
            <th>${T("Priority")}</th>
            <th>${T("Status")}</th>
            <th>${T("Reported Date")}</th>
          </tr>
        </thead>
        <tbody>`;
      rangeIssues.forEach(issue => {
        issuesHTML += `<tr>
          <td><b>${issue.title}</b><br><small>${issue.description || ''}</small></td>
          <td>${T(issue.category || 'Other')}</td>
          <td>${T(issue.priority)}</td>
          <td>${T(issue.status)}</td>
          <td>${new Date(issue.createdAt).toLocaleDateString(dateLocale)}</td>
        </tr>`;
      });
      issuesHTML += `</tbody></table>`;
    }

    let snagsHTML = `<h3>${T("Reported Snags")}</h3>`;
    if (rangeSnags.length === 0) {
      snagsHTML += `<p class='empty'>${T("No snags reported in this range.")}</p>`;
    } else {
      snagsHTML += `<table>
        <thead>
          <tr>
            <th>${T("Snag Title")}</th>
            <th>${T("Priority")}</th>
            <th>${T("Status")}</th>
            <th>${T("Reported Date")}</th>
          </tr>
        </thead>
        <tbody>`;
      rangeSnags.forEach(snag => {
        snagsHTML += `<tr>
          <td><b>${snag.title}</b><br><small>${snag.description || ''}</small></td>
          <td>${T(snag.priority)}</td>
          <td>${T(snag.status)}</td>
          <td>${new Date(snag.createdAt).toLocaleDateString(dateLocale)}</td>
        </tr>`;
      });
      snagsHTML += `</tbody></table>`;
    }

    let logsHTML = `<h3>${T("Activity Logs")}</h3>`;
    if (rangeLogs.length === 0) {
      logsHTML += `<p class='empty'>${T("No activity logs in this range.")}</p>`;
    } else {
      logsHTML += `<table>
        <thead>
          <tr>
            <th>${T("User")}</th>
            <th>${T("Role")}</th>
            <th>${T("Action")}</th>
            <th>${T("Details")}</th>
            <th>${T("Timestamp")}</th>
          </tr>
        </thead>
        <tbody>`;
      rangeLogs.forEach(log => {
        logsHTML += `<tr>
          <td><b>${log.userName || T('System')}</b></td>
          <td>${T(log.userRole || 'Member')}</td>
          <td>${log.action}</td>
          <td>${log.details}</td>
          <td>${new Date(log.timestamp).toLocaleString(dateLocale)}</td>
        </tr>`;
      });
      logsHTML += `</tbody></table>`;
    }

    // "Generated on: 26/11/2026" / "Range: … - …" → label + value for the letterhead
    const cut = dateRangeInfo.indexOf(": ");
    const periodLabel = cut > 0 ? dateRangeInfo.slice(0, cut) : T("Period");
    const periodValue = cut > 0 ? dateRangeInfo.slice(cut + 2) : dateRangeInfo;

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="${lang}" dir="${lang === "ar" ? "rtl" : "ltr"}">
      <head>
        <meta charset="utf-8">
        ${lang === "ar" ? '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Sans+Arabic:wght@400;600;700&display=swap">' : ""}
        <style>
          /* Standard SkyStruct PDF format (same letterhead + tables as the web's downloaded PDFs) */
          * { box-sizing: border-box; }
          body {
            font-family: ${lang === "ar" ? "'Noto Sans Arabic', Tahoma, Arial, sans-serif" : "'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"};
            margin: 0; padding: 0; color: #0f172a; font-size: 11px; line-height: 1.45;
            -webkit-print-color-adjust: exact; print-color-adjust: exact;
          }
          .sd-head { display: table; width: 100%; border-bottom: 2px solid #1e3a8a; padding-bottom: 8px; margin-bottom: 14px; }
          .sd-head > div { display: table-cell; vertical-align: middle; }
          .sd-brand { display: table; }
          .sd-brand > div { display: table-cell; vertical-align: middle; }
          .sd-logo { padding-inline-end: 12px; }
          .sd-logo img { height: 38px; width: auto; display: block; }
          .sd-org-wrap { padding-inline-start: 12px; border-inline-start: 1px solid #e2e8f0; }
          .sd-org { font-size: 12.5px; font-weight: 800; color: #0f172a; }
          .sd-doc { text-align: end; }
          .sd-doc-type { font-size: 15px; font-weight: 900; color: #1e3a8a; letter-spacing: 1px; text-transform: uppercase; }
          .sd-meta { margin-top: 4px; margin-inline-start: auto; border-collapse: collapse; font-size: 9.5px; }
          .sd-meta td { padding: 0.5px 0; }
          .sd-meta td.k { color: #64748b; padding-inline-end: 10px; text-align: end; white-space: nowrap; }
          .sd-meta td.v { color: #0f172a; font-weight: 700; text-align: end; }
          h3 {
            font-size: 10px; font-weight: 800; color: #1e3a8a; text-transform: uppercase; letter-spacing: .8px;
            border-bottom: 1px solid #cbd5e1; padding-bottom: 3px; margin: 16px 0 6px; page-break-after: avoid;
          }
          table { width: 100%; border-collapse: collapse; margin-bottom: 14px; font-size: 10.5px; }
          thead { display: table-header-group; }
          tr { page-break-inside: avoid; }
          th {
            background: #1e3a8a; color: #ffffff; border: 1px solid #1e3a8a; font-weight: 700; font-size: 9px;
            text-transform: uppercase; letter-spacing: .5px; padding: 6px 8px; text-align: start;
          }
          td { padding: 6px 8px; border-bottom: 1px solid #e2e8f0; vertical-align: top; color: #1e293b; }
          tbody tr:nth-child(even) td { background: #f8fafc; }
          .empty { font-size: 11px; color: #94a3b8; font-style: italic; margin: 6px 0 14px; padding: 10px; border: 1px dashed #e2e8f0; border-radius: 6px; text-align: center; }
          small { color: #64748b; }
        </style>
      </head>
      <body>
        <div class="sd-head">
          <div class="sd-brand">
            <div class="sd-logo"><img src="${PDF_LOGO_DATA_URI}" alt="SkyStruct" /></div>
            <div class="sd-org-wrap"><div class="sd-org">${esc(orgName)}</div></div>
          </div>
          <div class="sd-doc">
            <div class="sd-doc-type">${esc(reportTitle)}</div>
            <table class="sd-meta">
              <tr><td class="k">${T("Project")}</td><td class="v">${esc(project.name || T("Project Details"))}</td></tr>
              <tr><td class="k">${esc(periodLabel)}</td><td class="v">${esc(periodValue)}</td></tr>
            </table>
          </div>
        </div>

        ${tasksHTML}
        ${issuesHTML}
        ${snagsHTML}
        ${logsHTML}
      </body>
      </html>
    `;

    // Generate PDF via Puppeteer
    let browser;
    if (process.env.VERCEL || process.env.VERCEL_ENV) {
      browser = await puppeteerCore.launch({
        args: chromium.args,
        defaultViewport: chromium.defaultViewport,
        executablePath: await chromium.executablePath(),
        headless: chromium.headless,
        ignoreHTTPSErrors: true,
      });
    } else {
      browser = await puppeteer.launch({
        headless: "new",
        args: ["--no-sandbox", "--disable-setuid-sandbox"]
      });
    }

    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: "networkidle0" });
    const footerDate = new Date().toLocaleDateString(dateLocale, { day: "2-digit", month: "short", year: "numeric" });
    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: "<div></div>",
      // Standard footer, like the web's PDFs: terms line + page number + organisation and date
      footerTemplate: `
        <div dir="${lang === "ar" ? "rtl" : "ltr"}" style="width:100%; margin:0 12mm; padding-top:5px; border-top:1px solid #cbd5e1; font-family:Arial, sans-serif; font-size:7px; color:#64748b; display:flex; justify-content:space-between; gap:12px; -webkit-print-color-adjust:exact;">
          <div style="flex:1; line-height:1.35;">${esc(T(REPORT_TERMS))}</div>
          <div style="text-align:end; white-space:nowrap; line-height:1.35;">
            <div style="font-weight:700; color:#1e3a8a;">${T("Page")} <span class="pageNumber"></span> ${T("of")} <span class="totalPages"></span></div>
            <div>${esc(orgName)} · ${esc(footerDate)}</div>
          </div>
        </div>`,
      margin: { top: "14mm", bottom: "22mm", left: "12mm", right: "12mm" },
    });
    await browser.close();

    // Determine recipient
    let recipientEmail = customTargetEmail;
    if (!recipientEmail && req.user?.id) {
      const dbUser = await User.findById(req.user.id).select("email").lean();
      recipientEmail = dbUser?.email;
    }

    if (!recipientEmail) {
      return NextResponse.json({ message: "No target email available to send to" }, { status: 400 });
    }

    // Send Email
    await sendEmail({
      to: recipientEmail,
      subject: `${T("Project Report:")} ${project.name || T("Details")}`,
      html: `
        <div dir="${lang === "ar" ? "rtl" : "ltr"}" style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
          <div style="background: linear-gradient(135deg, #2563eb, #3b82f6); padding: 30px; text-align: center;">
            <h2 style="color: #ffffff; margin: 0; font-size: 26px; font-weight: 600; letter-spacing: 0.5px;">SkyStruct Lite</h2>
          </div>
          <div style="padding: 40px 30px; background-color: #ffffff;">
            <h3 style="color: #0f172a; margin-top: 0; font-size: 22px; margin-bottom: 16px;">${T("Your Project Report is Ready!")}</h3>
            <p style="color: #475569; font-size: 16px; line-height: 1.6; margin-bottom: 24px;">
              ${T("Please find attached the latest detailed report for")} <strong>${project.name}</strong>.
            </p>
            <div style="background-color: #f8fafc; border-left: 4px solid #3b82f6; padding: 16px 20px; margin-bottom: 24px; border-radius: 0 8px 8px 0;">
              <p style="margin: 0; color: #334155; font-size: 15px; line-height: 1.5;">
                <span style="color: #64748b; font-size: 13px; text-transform: uppercase; font-weight: 600; letter-spacing: 0.5px;">${T("Report Timeline")}</span><br/>
                ${dateRangeInfo}
              </p>
            </div>
            <p style="color: #64748b; font-size: 14px; line-height: 1.6; margin: 0;">
              ${T("The attached PDF includes a comprehensive breakdown of all milestones, recently completed tasks, reported issues, and snag lists.")}
            </p>
          </div>
          <div style="background-color: #f8fafc; padding: 20px; text-align: center; border-top: 1px solid #e2e8f0;">
            <p style="color: #94a3b8; font-size: 12px; margin: 0;">
              &copy; ${new Date().getFullYear()} ${T("SkyStruct Lite Project Management. All rights reserved.")}
            </p>
          </div>
        </div>
      `,
      attachments: [
        {
          filename: `Project_Report_${project._id}.pdf`,
          content: pdfBuffer,
          contentType: "application/pdf"
        }
      ]
    });

    return NextResponse.json({ message: "Report generated and emailed successfully", sentTo: recipientEmail });

  } catch (error) {
    console.error("Email report error:", error);
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
});
