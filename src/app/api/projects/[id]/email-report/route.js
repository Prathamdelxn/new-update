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

export const POST = withAuth(async function (req, { params }) {
  try {
    const { id } = await params;
    const { reportType, startDate, endDate, customTargetEmail } = await req.json();

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

    // Determine exact date bounds based on frontend logic
    let startLimit = new Date(startDate);
    startLimit.setHours(0, 0, 0, 0);
    let endLimit = new Date(endDate);
    endLimit.setHours(23, 59, 59, 999);

    let reportTitle = "";
    let dateRangeInfo = "";

    if (reportType === 'Daily') {
      reportTitle = "Daily Project Report (Last 7 Days)";
      dateRangeInfo = `Generated on: ${new Date().toLocaleDateString()}`;
    } else if (reportType === 'Monthly') {
      reportTitle = "Monthly Project Report (Last 6 Months)";
      dateRangeInfo = `Generated on: ${new Date().toLocaleDateString()}`;
    } else {
      reportTitle = "Custom Range Project Report";
      dateRangeInfo = `Range: ${startLimit.toLocaleDateString()} - ${endLimit.toLocaleDateString()}`;
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
    let tasksHTML = "<h3>Completed Tasks</h3>";
    if (allCompletedTasks.length === 0) {
      tasksHTML += "<p class='empty'>No tasks completed in this range.</p>";
    } else {
      tasksHTML += `<table>
        <thead>
          <tr>
            <th>Milestone</th>
            <th>Task Title</th>
            <th>Start Date</th>
            <th>End Date</th>
            <th>Completion Date</th>
            <th>Created By</th>
            <th>Completed By</th>
          </tr>
        </thead>
        <tbody>`;
      allCompletedTasks.forEach(t => {
        const startStr = t.startDate ? new Date(t.startDate).toLocaleDateString() : 'N/A';
        const endStr = t.endDate ? new Date(t.endDate).toLocaleDateString() : 'N/A';
        const createdByStr = t.createdByName || 'Unknown';
        const completedByStr = t.completedByName || 'Unknown';
        tasksHTML += `<tr>
          <td>${t.milestoneName}</td>
          <td>${t.title}</td>
          <td>${startStr}</td>
          <td>${endStr}</td>
          <td>${t.completedAtDate.toLocaleDateString()}</td>
          <td>${createdByStr}</td>
          <td>${completedByStr}</td>
        </tr>`;
      });
      tasksHTML += `</tbody></table>`;
    }

    let issuesHTML = "<h3>Reported Issues</h3>";
    if (rangeIssues.length === 0) {
      issuesHTML += "<p class='empty'>No issues reported in this range.</p>";
    } else {
      issuesHTML += `<table>
        <thead>
          <tr>
            <th>Issue Title</th>
            <th>Category</th>
            <th>Priority</th>
            <th>Status</th>
            <th>Reported Date</th>
          </tr>
        </thead>
        <tbody>`;
      rangeIssues.forEach(issue => {
        issuesHTML += `<tr>
          <td><b>${issue.title}</b><br><small>${issue.description || ''}</small></td>
          <td>${issue.category || 'Other'}</td>
          <td>${issue.priority}</td>
          <td>${issue.status}</td>
          <td>${new Date(issue.createdAt).toLocaleDateString()}</td>
        </tr>`;
      });
      issuesHTML += `</tbody></table>`;
    }

    let snagsHTML = "<h3>Reported Snags</h3>";
    if (rangeSnags.length === 0) {
      snagsHTML += "<p class='empty'>No snags reported in this range.</p>";
    } else {
      snagsHTML += `<table>
        <thead>
          <tr>
            <th>Snag Title</th>
            <th>Priority</th>
            <th>Status</th>
            <th>Reported Date</th>
          </tr>
        </thead>
        <tbody>`;
      rangeSnags.forEach(snag => {
        snagsHTML += `<tr>
          <td><b>${snag.title}</b><br><small>${snag.description || ''}</small></td>
          <td>${snag.priority}</td>
          <td>${snag.status}</td>
          <td>${new Date(snag.createdAt).toLocaleDateString()}</td>
        </tr>`;
      });
      snagsHTML += `</tbody></table>`;
    }

    let logsHTML = "<h3>Activity Logs</h3>";
    if (rangeLogs.length === 0) {
      logsHTML += "<p class='empty'>No activity logs in this range.</p>";
    } else {
      logsHTML += `<table>
        <thead>
          <tr>
            <th>User</th>
            <th>Role</th>
            <th>Action</th>
            <th>Details</th>
            <th>Timestamp</th>
          </tr>
        </thead>
        <tbody>`;
      rangeLogs.forEach(log => {
        logsHTML += `<tr>
          <td><b>${log.userName || 'System'}</b></td>
          <td>${log.userRole || 'Member'}</td>
          <td>${log.action}</td>
          <td>${log.details}</td>
          <td>${new Date(log.timestamp).toLocaleString()}</td>
        </tr>`;
      });
      logsHTML += `</tbody></table>`;
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body {
            font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
            padding: 30px;
            color: #1e293b;
          }
          .header-container {
            border-bottom: 2px solid #e2e8f0;
            padding-bottom: 20px;
            margin-bottom: 30px;
          }
          h1 {
            font-size: 24px;
            color: #0f172a;
            margin: 0 0 8px 0;
          }
          h2 {
            font-size: 16px;
            color: #3b82f6;
            margin: 0 0 4px 0;
            font-weight: 600;
          }
          h3 {
            font-size: 15px;
            color: #1e293b;
            margin: 30px 0 12px 0;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            border-bottom: 1px solid #cbd5e1;
            padding-bottom: 6px;
          }
          .date-range {
            font-size: 13px;
            color: #64748b;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 25px;
          }
          th {
            background-color: #f8fafc;
            border: 1px solid #e2e8f0;
            padding: 10px 12px;
            text-align: left;
            font-size: 11px;
            font-weight: 700;
            color: #475569;
            text-transform: uppercase;
          }
          td {
            border: 1px solid #e2e8f0;
            padding: 10px 12px;
            font-size: 12px;
            color: #334155;
          }
          tr:nth-child(even) td {
            background-color: #fafbfc;
          }
          .empty {
            font-size: 13px;
            color: #94a3b8;
            font-style: italic;
            margin: 15px 0 25px 0;
          }
          small {
            color: #64748b;
          }
        </style>
      </head>
      <body>
        <div class="header-container">
          <h2>Project: ${project.name || "Project Details"}</h2>
          <h1>${reportTitle}</h1>
          <div class="date-range">${dateRangeInfo}</div>
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
    const pdfBuffer = await page.pdf({ format: "A4", printBackground: true });
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
      subject: `Project Report: ${project.name || "Details"}`,
      html: `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
          <div style="background: linear-gradient(135deg, #2563eb, #3b82f6); padding: 30px; text-align: center;">
            <h2 style="color: #ffffff; margin: 0; font-size: 26px; font-weight: 600; letter-spacing: 0.5px;">Sky-Lite</h2>
          </div>
          <div style="padding: 40px 30px; background-color: #ffffff;">
            <h3 style="color: #0f172a; margin-top: 0; font-size: 22px; margin-bottom: 16px;">Your Project Report is Ready!</h3>
            <p style="color: #475569; font-size: 16px; line-height: 1.6; margin-bottom: 24px;">
              Please find attached the latest detailed report for <strong>${project.name}</strong>.
            </p>
            <div style="background-color: #f8fafc; border-left: 4px solid #3b82f6; padding: 16px 20px; margin-bottom: 24px; border-radius: 0 8px 8px 0;">
              <p style="margin: 0; color: #334155; font-size: 15px; line-height: 1.5;">
                <span style="color: #64748b; font-size: 13px; text-transform: uppercase; font-weight: 600; letter-spacing: 0.5px;">Report Timeline</span><br/>
                ${dateRangeInfo}
              </p>
            </div>
            <p style="color: #64748b; font-size: 14px; line-height: 1.6; margin: 0;">
              The attached PDF includes a comprehensive breakdown of all milestones, recently completed tasks, reported issues, and snag lists.
            </p>
          </div>
          <div style="background-color: #f8fafc; padding: 20px; text-align: center; border-top: 1px solid #e2e8f0;">
            <p style="color: #94a3b8; font-size: 12px; margin: 0;">
              &copy; ${new Date().getFullYear()} Sky-Lite Project Management. All rights reserved.
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
