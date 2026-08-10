import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Project from "@/models/Project";
import BOQ from "@/models/BOQ";
import User from "@/models/User";
import mongoose from "mongoose";
import { withAuth } from "@/lib/middleware";
import { emitToProject } from "@/lib/socket-server";

// Duplicated per-file, matching this codebase's convention (no shared
// permission helpers across API route files).
async function userHasBOQPermission(req, projectId, permission) {
  if (req.user.role === "Admin") return true;
  const userWithRole = await User.findById(req.user.id)
    .populate("role")
    .populate("projects.role")
    .select("role projects");
  let perms = userWithRole?.role?.permissions || [];
  if (!perms.includes("*") && !perms.includes(permission)) {
    const projectAssignment = userWithRole.projects?.find((p) => p.project.toString() === projectId);
    if (projectAssignment?.role) {
      const projPerms = projectAssignment.role.permissions || [];
      perms = [...perms, ...projPerms];
      if (projectAssignment.role.name === "Admin" || projectAssignment.role.isSystemRole) {
        perms.push("*");
      }
    }
  }
  return perms.includes("*") || perms.includes(permission);
}

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

    // "Send for Approval" (status Pending + a target approver) is an assign
    // action; actually deciding Approved/Rejected is an approve action.
    // Previously this endpoint had no permission check at all.
    const requiredPermission = status === "Pending" && requestedApproverId ? "boq:assign" : "boq:approve";
    if (!(await userHasBOQPermission(req, id, requiredPermission))) {
      return NextResponse.json({ message: "Forbidden: Insufficient BOQ permissions" }, { status: 403 });
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
