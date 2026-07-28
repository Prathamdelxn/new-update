import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Project from "@/models/Project";
import BOQ from "@/models/BOQ";
import mongoose from "mongoose";
import { withAuth } from "@/lib/middleware";
import { emitToProject } from "@/lib/socket-server";

/**
 * PATCH /api/projects/:id/boq/bulk-status
 * Updates the status of multiple BOQ items.
 */
export const PATCH = withAuth(async function (req, { params }) {
  try {
    const { id } = await params;
    await dbConnect();

    const { itemIds, status, requestedApproverId } = await req.json();

    if (!itemIds || !Array.isArray(itemIds) || itemIds.length === 0) {
      return NextResponse.json({ message: "No items selected" }, { status: 400 });
    }

    if (!["Approved", "Rejected", "Pending", "Draft"].includes(status)) {
      return NextResponse.json({ message: "Invalid status" }, { status: 400 });
    }

    const updateData = { 
      status,
      approvedBy: req.user.id,
      approvedByName: req.user.name || "User",
      approvedAt: new Date()
    };

    // If sending for approval, track the target approver
    if (status === "Pending" && requestedApproverId) {
      const User = mongoose.models.User || (await import("@/models/User")).default;
      const approver = await User.findById(requestedApproverId).select("name");
      if (approver) {
        updateData.requestedApprover = requestedApproverId;
        updateData.requestedApproverName = approver.name;
      }
    }

    // Update multiple items
    const result = await BOQ.updateMany(
      { _id: { $in: itemIds }, project: id },
      { $set: updateData }
    );

    // Log in audit trail
    const project = await Project.findById(id);
    if (project) {
      project.auditTrail.push({
        user: req.user.id,
        userName: req.user.name || "User",
        userRole: req.user.role === "Admin" ? "Admin" : (req.user.role?.name || "Member"),
        action: "Update",
        details: `Bulk updated ${result.modifiedCount} BOQ items to ${status}`,
      });
      await project.save();
    }

    emitToProject(id, 'boq:updated');

    // Check if project should transition to Ongoing
    if (status === "Approved") {
      const { checkAndTransitionToOngoing } = await import("@/lib/projectStatusHelper");
      await checkAndTransitionToOngoing(id);
    }

    return NextResponse.json({
      message: `Updated ${result.modifiedCount} items`,
      modifiedCount: result.modifiedCount
    });
  } catch (error) {
    console.error("BOQ bulk status update error:", error);
    return NextResponse.json({ message: "Error updating status" }, { status: 500 });
  }
});
