import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import SiteSurvey from "@/models/SiteSurvey";
import Project from "@/models/Project";
import User from "@/models/User";
import { withAuth } from "@/lib/middleware";
import { sendEmail } from "@/lib/email";
import { budgetRequestEmail } from "@/lib/emailTemplates";
import { emitToProject } from "@/lib/socket-server";

export const POST = withAuth(async function (req, { params }) {
  try {
    const { id: projectId } = await params;
    await dbConnect();

    const body = await req.json();
    const { approverId, amount, reason } = body || {};

    const project = await Project.findOne({ _id: projectId, organization: req.user.organizationId });
    if (!project) {
      return NextResponse.json({ message: "Project not found" }, { status: 404 });
    }

    let requestAmount = amount !== undefined && amount !== null && amount !== "" ? Number(amount) : null;
    let requestReason = reason ? String(reason).trim() : "";
    let isSurveyRequest = false;
    let survey = null;

    if (requestAmount === null || isNaN(requestAmount)) {
      // Fallback to survey if amount was not directly provided
      survey = await SiteSurvey.findOne({ project: projectId, organization: req.user.organizationId });
      if (!survey) {
        return NextResponse.json({ message: "Survey or amount not provided" }, { status: 400 });
      }
      if (!survey.affectsBudget || !survey.recommendedBudget) {
        return NextResponse.json({ message: "Survey does not affect budget" }, { status: 400 });
      }
      if (survey.budgetRequestSent) {
        return NextResponse.json({ message: "Budget request already sent" }, { status: 400 });
      }
      requestAmount = Number(survey.recommendedBudget);
      requestReason = survey.budgetReason || "Survey recommended budget adjustment";
      isSurveyRequest = true;
    }

    let approverName = "Approver";
    if (approverId) {
      const approver = await User.findById(approverId);
      if (approver) approverName = approver.name;
    }

    const formattedReason = approverId
      ? `${isSurveyRequest ? 'Survey Validation Request' : 'Budget Change Request'} sent to ${approverName}: ${requestReason}`
      : requestReason || "Budget Change Request";

    // Add pending request to budget history
    project.budgetHistory.push({
      amount: requestAmount,
      reason: formattedReason,
      approvalStatus: "Pending",
      updatedBy: req.user.id,
      updatedByName: req.user.name || "System",
      timestamp: new Date()
    });

    project.auditTrail.push({
      user: req.user.id,
      userName: req.user.name || "System",
      userRole: req.user.role || "Member",
      action: "Update",
      details: `Requested budget change of $${requestAmount}. Reason: ${requestReason}${approverId ? `. Sent to: ${approverName}` : ''}`,
    });

    if (isSurveyRequest && survey) {
      survey.budgetRequestSent = true;
      await survey.save();
    }

    await project.save();

    // Email the approver about the pending request
    if (approverId) {
      const approver = await User.findById(approverId).select("name email");
      if (approver?.email) {
        sendEmail({
          to: approver.email,
          subject: `Budget Approval Required — ${project.name}`,
          html: budgetRequestEmail({
            approverName: approver.name,
            requesterName: req.user.name || "Team Member",
            projectName: project.name,
            amount: survey.recommendedBudget,
            reason: survey.budgetReason,
          }),
        });
      }
    }

    emitToProject(projectId, 'budget:updated');
    return NextResponse.json({ message: "Budget request sent successfully", survey });
  } catch (error) {
    console.error("Budget request error:", error);
    return NextResponse.json(
      { message: "Error sending budget request" },
      { status: 500 }
    );
  }
});
