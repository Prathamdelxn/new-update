import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Project from "@/models/Project";
import User from "@/models/User";
import Role from "@/models/Role";
import { withAuth } from "@/lib/middleware";
import { sendEmail } from "@/lib/email";
import { budgetDecisionEmail } from "@/lib/emailTemplates";
import { emitToProject } from "@/lib/socket-server";

/**
 * PATCH /api/projects/:id/budget-action
 *
 * Handles Approval/Rejection of a budget history item.
 */
export const PATCH = withAuth(async function (req, { params }) {
  try {
    const { id: projectId } = await params;
    await dbConnect();

    const { budgetId, action } = await req.json(); // action = "Approved" or "Rejected"

    if (!["Approved", "Rejected"].includes(action)) {
      return NextResponse.json({ message: "Invalid action" }, { status: 400 });
    }

    // 1. Check if user has permission to approve budget
    const userWithRole = await User.findById(req.user.id).populate("role");
    const userRole = userWithRole?.role;
    const hasPermission = userRole?.permissions?.includes("budget:approve") || userRole?.permissions?.includes("*");

    if (!hasPermission) {
      return NextResponse.json({ message: "Forbidden: No budget approval permission" }, { status: 403 });
    }

    // 2. Find the project and update the budget item
    const project = await Project.findOne({ _id: projectId, organization: req.user.organizationId });
    if (!project) {
      return NextResponse.json({ message: "Project not found" }, { status: 404 });
    }

    const budgetItem = project.budgetHistory.id(budgetId);
    if (!budgetItem) {
      return NextResponse.json({ message: "Budget item not found" }, { status: 404 });
    }

    if (budgetItem.approvalStatus !== "Pending") {
      return NextResponse.json({ message: "Budget item is already " + budgetItem.approvalStatus }, { status: 400 });
    }

    // 3. Update Status
    budgetItem.approvalStatus = action;
    budgetItem.updatedBy = req.user.id;
    budgetItem.updatedByName = req.user.name || "Approver";
    budgetItem.timestamp = new Date();

    // 4. Audit Trail
    project.auditTrail.push({
      user: req.user.id,
      userName: req.user.name || "Approver",
      userRole: userRole?.name || "Member",
      action: "Update",
      details: `Budget request for $${budgetItem.amount} was ${action}.`,
    });

    await project.save();

    // Email the requester about the decision
    if (budgetItem.updatedBy) {
      const requester = await User.findById(budgetItem.updatedBy).select("name email");
      if (requester?.email) {
        sendEmail({
          to: requester.email,
          subject: `Budget Request ${action} — ${project.name}`,
          html: budgetDecisionEmail({
            requesterName: requester.name,
            approverName: req.user.name || "Admin",
            projectName: project.name,
            amount: budgetItem.amount,
            action,
          }),
        });
      }
    }

    emitToProject(projectId, 'budget:updated');
    return NextResponse.json({ message: `Budget ${action} successfully`, project });
  } catch (error) {
    console.error("Budget action error:", error);
    return NextResponse.json(
      { message: "Error updating budget status" },
      { status: 500 }
    );
  }
});
