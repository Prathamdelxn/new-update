import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Issue from "@/models/Issue";
import Project from "@/models/Project";
import User from "@/models/User";
import { withAuth } from "@/lib/middleware";
import { recordAudit } from "@/lib/auditHelper";
import { sendEmail } from "@/lib/email";
import { issueAssignedEmail } from "@/lib/emailTemplates";
import { emitToProject } from "@/lib/socket-server";
import RiskEngine from "@/lib/riskEngine";

export const GET = withAuth(async function (req, { params }) {
  try {
    const { id } = await params;
    await dbConnect();

    const issues = await Issue.find({ project: id })
      .populate('createdBy', 'name email __enc_name')
      .populate('assignedTo', 'name email __enc_name')
      .sort({ createdAt: -1 });

    return NextResponse.json(issues);
  } catch (error) {
    console.error("Fetch issues error:", error);
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
});

export const POST = withAuth(async function (req, { params }) {
  try {
    const { id } = await params;
    const body = await req.json();
    
    // Clean up empty strings for ObjectId fields
    if (body.assignedTo === "") delete body.assignedTo;

    await dbConnect();

    const newIssue = await Issue.create({
      ...body,
      project: id,
      organization: req.user.organizationId,
      createdBy: req.user.id
    });

    // Record audit trail in project
    const project = await Project.findById(id);
    if (project) {
      await recordAudit(project, req.user, "IssueAdded", `Issue reported: ${body.title}`);
    }

    // Auto-generate Risk if High/Critical
    if (body.priority === 'High' || body.priority === 'Critical') {
      const isSafety = body.category === 'Safety';
      await RiskEngine.evaluateAndCreateRisk({
        projectId: id,
        organizationId: req.user.organizationId,
        user: req.user,
        sourceType: 'Issue',
        sourceId: newIssue._id,
        sourceName: body.title,
        title: `${isSafety ? 'Safety' : 'Quality'} Risk: ${body.title}`,
        category: isSafety ? 'Safety' : 'Technical',
        description: `Auto-generated risk from a ${body.priority} priority issue: ${body.description || body.title}`,
        impact: body.priority === 'Critical' ? 'Very High' : 'High',
        probability: 'High'
      }).catch(err => console.error("Risk auto-gen failed for issue:", err));
    }

    // Email the assigned user (if any)
    if (body.assignedTo) {
      const assignee = await User.findById(body.assignedTo).select("name email");
      if (assignee?.email) {
        sendEmail({
          to: assignee.email,
          subject: `Issue Assigned to You — ${body.title}`,
          html: issueAssignedEmail({
            assigneeName: assignee.name,
            reporterName: req.user.name || "Team Member",
            projectName: project?.name || "Project",
            issueTitle: body.title,
            priority: body.priority,
            category: body.category,
          }),
        });
      }
    }

    emitToProject(id, 'issue:created', { issueId: newIssue._id.toString() });
    return NextResponse.json(newIssue, { status: 201 });
  } catch (error) {
    console.error("Create issue error:", error);
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
});
