import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Project from "@/models/Project";
import BOQ from "@/models/BOQ";
import User from "@/models/User";
import { withAuth } from "@/lib/middleware";
import { emitToProject } from "@/lib/socket-server";
import { sendEmail } from "@/lib/email";
import { boqStatusEmail } from "@/lib/emailTemplates";

/**
 * PATCH /api/projects/:id/boq/:itemId/status
 * Updates the approval status of a BOQ item.
 */
export const PATCH = withAuth(async function (req, { params }) {
  try {
    const { id, itemId } = await params;
    await dbConnect();

    const { status, updateBudget, budgetReason, rejectionReason } = await req.json();

    if (!["Approved", "Rejected", "Pending", "Draft"].includes(status)) {
      return NextResponse.json({ message: "Invalid status" }, { status: 400 });
    }

    const item = await BOQ.findOne({ _id: itemId, project: id });
    if (!item) {
      return NextResponse.json({ message: "BOQ item not found" }, { status: 404 });
    }

    const oldStatus = item.status;
    item.status = status;
    
    // Track who did the approval/rejection
    item.approvedBy = req.user.id;
    item.approvedByName = req.user.name || "Admin";
    item.approvedAt = new Date();

    // Store rejection reason if provided
    if (status === "Rejected" && rejectionReason) {
      item.rejectionReason = rejectionReason;
    } else if (status !== "Rejected") {
      item.rejectionReason = undefined;
    }
    
    await item.save();

    // Log in audit trail and handle budget update
    const project = await Project.findById(id);
    if (project) {
      // 1. Audit trail for BOQ item
      project.auditTrail.push({
        user: req.user.id,
        userName: req.user.name || "User",
        userRole: req.user.role === "Admin" ? "Admin" : (req.user.role?.name || "Member"),
        action: "Update",
        details: `${status} BOQ item: ${item.itemNumber || item.itemDescription} (v${item.version})${status === 'Rejected' && rejectionReason ? ` — Reason: ${rejectionReason}` : ''}`,
      });

      // 2. Budget Impact Logic
      // Only trigger if: status is Approved, it's a newer version, and user confirmed budget update
      if (status === "Approved" && oldStatus !== "Approved" && item.version > 1 && updateBudget) {
        // Find the previous version to calculate difference
        const prevVersion = await BOQ.findOne({
          historyId: item.historyId,
          version: item.version - 1
        });

        if (prevVersion) {
          const diff = (item.totalCost || 0) - (prevVersion.totalCost || 0);
          
          if (diff !== 0) {
            // Get current budget from history or start at 0
            const lastBudget = project.budgetHistory.length > 0 
              ? project.budgetHistory[project.budgetHistory.length - 1].amount 
              : 0;
            
            const newTotalBudget = lastBudget + diff;

            project.budgetHistory.push({
              amount: newTotalBudget,
              reason: budgetReason || `BOQ Adjustment: ${item.itemNumber || item.itemDescription} (v${item.version})`,
              approvalStatus: "Approved",
              updatedBy: req.user.id,
              updatedByName: req.user.name || "Admin",
              timestamp: new Date()
            });

            // Add budget-specific audit log
            project.auditTrail.push({
              user: req.user.id,
              userName: req.user.name || "User",
              userRole: "Admin",
              action: "Update",
              details: `Project budget adjusted by ${diff > 0 ? '+' : ''}${diff} due to BOQ version ${item.version} approval.`,
            });
          }
        }
      }

      await project.save();
    }

    // Notify the BOQ item creator of the decision (disabled)
    /*
    if (item.createdBy && ["Approved", "Rejected"].includes(status)) {
      const creator = await User.findById(item.createdBy).select("name email");
      if (creator?.email) {
        sendEmail({
          to: creator.email,
          subject: `BOQ Item ${status} — ${project?.name || "Project"}`,
          html: boqStatusEmail({
            recipientName: creator.name,
            itemDescription: item.itemDescription,
            itemNumber: item.itemNumber,
            status,
            approverName: req.user.name || "Admin",
            projectName: project?.name || "—",
            version: item.version,
          }),
        });
      }
    }
    */

    emitToProject(id, 'boq:updated');

    // Check if project should transition to Ongoing
    if (status === "Approved") {
      const { checkAndTransitionToOngoing } = await import("@/lib/projectStatusHelper");
      await checkAndTransitionToOngoing(id);
    }

    return NextResponse.json(item);
  } catch (error) {
    console.error("BOQ status update error:", error);
    return NextResponse.json({ message: "Error updating status" }, { status: 500 });
  }
});
