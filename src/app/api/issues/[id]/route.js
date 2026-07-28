import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Issue from "@/models/Issue";
import Project from "@/models/Project";
import User from "@/models/User";
import { withAuth } from "@/lib/middleware";
import { recordAudit } from "@/lib/auditHelper";
import { sendEmail } from "@/lib/email";
import { issueAssignedEmail, issueStatusEmail } from "@/lib/emailTemplates";

export const PATCH = withAuth(async function (req, { params }) {
  try {
    const { id } = await params;
    const body = await req.json();
    if (body.assignedTo === "") body.assignedTo = null;
    await dbConnect();

    const issue = await Issue.findOne({ _id: id, organization: req.user.organizationId });
    if (!issue) {
      return NextResponse.json({ message: "Issue not found" }, { status: 404 });
    }

    // Update issue
    const updatedIssue = await Issue.findByIdAndUpdate(
      id,
      { 
        $set: body,
        $push: {
          history: {
            updatedBy: req.user.id,
            action: body.status ? "StatusUpdated" : "DetailsUpdated",
            details: body.note || `Issue updated: ${JSON.stringify(body)}`,
            timestamp: new Date()
          }
        }
      },
      { new: true }
    );

    // Record audit trail in project
    const project = await Project.findById(issue.project);
    if (project) {
      await recordAudit(project, req.user, "IssueUpdated", `Issue ${issue.title} updated to ${body.status || 'new details'}`);
    }

    // Email new assignee if assignment changed
    const newAssigneeId = body.assignedTo;
    const assigneeChanged = newAssigneeId && newAssigneeId !== issue.assignedTo?.toString();
    if (assigneeChanged) {
      const assignee = await User.findById(newAssigneeId).select("name email");
      if (assignee?.email) {
        sendEmail({
          to: assignee.email,
          subject: `Issue Assigned to You — ${issue.title}`,
          html: issueAssignedEmail({
            assigneeName: assignee.name,
            reporterName: req.user.name || "Team Member",
            projectName: project?.name || "Project",
            issueTitle: issue.title,
            priority: issue.priority,
            category: issue.category,
          }),
        });
      }
    }

    // Email existing assignee on status change
    if (body.status && body.status !== issue.status && issue.assignedTo && !assigneeChanged) {
      const assignee = await User.findById(issue.assignedTo).select("name email");
      if (assignee?.email) {
        sendEmail({
          to: assignee.email,
          subject: `Issue Status Updated — ${issue.title}`,
          html: issueStatusEmail({
            recipientName: assignee.name,
            issueTitle: issue.title,
            oldStatus: issue.status,
            newStatus: body.status,
            updatedByName: req.user.name || "Team Member",
            projectName: project?.name || "Project",
          }),
        });
      }
    }

    return NextResponse.json(updatedIssue);
  } catch (error) {
    console.error("Update issue error:", error);
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
});

export const DELETE = withAuth(async function (req, { params }) {
  try {
    const { id } = await params;
    await dbConnect();

    const issue = await Issue.findOne({ _id: id, organization: req.user.organizationId });
    if (!issue) {
      return NextResponse.json({ message: "Issue not found" }, { status: 404 });
    }

    await Issue.findByIdAndDelete(id);

    // Record audit trail
    const project = await Project.findById(issue.project);
    if (project) {
      await recordAudit(project, req.user, "IssueDeleted", `Issue removed: ${issue.title}`);
    }

    return NextResponse.json({ message: "Issue deleted successfully" });
  } catch (error) {
    console.error("Delete issue error:", error);
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
});
