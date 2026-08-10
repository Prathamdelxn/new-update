import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Milestone from "@/models/Milestone";
import User from "@/models/User";
import { withAuth, withPermission } from "@/lib/middleware";
import { emitToProject } from "@/lib/socket-server";
import RiskEngine from "@/lib/riskEngine";

// Duplicated per-file, matching this codebase's convention (no shared
// permission helpers across API route files).
async function userHasTasksPermission(req, projectId, permission) {
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

export const PATCH = withAuth(async function (req, { params }) {
  try {
    await dbConnect();
    const { id, milestoneId } = await params;
    const updates = await req.json();

    const milestone = await Milestone.findOne({
      _id: milestoneId,
      project: id,
      organization: req.user.organizationId
    });

    if (!milestone) {
      return NextResponse.json({ message: "Milestone not found" }, { status: 404 });
    }

    // This endpoint is shared by every task/milestone mutation (rename
    // milestone, add a task, toggle complete, reassign, delete a task,
    // change status) — the frontend always PATCHes the whole `tasks` array.
    // Previously the whole thing was gated by a single blanket
    // "tasks:update", so a member with only tasks:create couldn't add a
    // task to an existing milestone, while a member with only tasks:update
    // (and no tasks:assign/tasks:complete/tasks:delete) could freely
    // reassign, complete, or remove tasks. Diff the incoming tasks array
    // against what's stored and require the permission that actually
    // matches each kind of change present in this request.
    const neededPermissions = new Set();
    let hasNonTaskFieldChanges = false;
    for (const key of Object.keys(updates)) {
      if (key !== "tasks" && updates[key] !== undefined) hasNonTaskFieldChanges = true;
    }
    if (hasNonTaskFieldChanges) neededPermissions.add("tasks:update");

    if (updates.tasks) {
      const existingById = new Map(milestone.tasks.map(t => [t._id.toString(), t]));
      const incomingIds = new Set();

      for (const incoming of updates.tasks) {
        const existing = incoming._id ? existingById.get(incoming._id.toString()) : null;

        if (!existing) {
          neededPermissions.add("tasks:create");
          if (incoming.assignedTo) neededPermissions.add("tasks:assign");
          continue;
        }
        incomingIds.add(existing._id.toString());

        const existingAssignee = existing.assignedTo ? existing.assignedTo.toString() : null;
        const incomingAssignee = incoming.assignedTo ? incoming.assignedTo.toString() : null;
        if (existingAssignee !== incomingAssignee) neededPermissions.add("tasks:assign");

        if (!!incoming.isCompleted !== !!existing.isCompleted) neededPermissions.add("tasks:complete");

        const otherFieldsChanged =
          (incoming.title ?? existing.title) !== existing.title ||
          (incoming.description ?? existing.description) !== existing.description ||
          String(incoming.startDate ?? existing.startDate ?? "") !== String(existing.startDate ?? "") ||
          String(incoming.endDate ?? existing.endDate ?? "") !== String(existing.endDate ?? "");
        if (otherFieldsChanged) neededPermissions.add("tasks:update");
      }

      for (const existingId of existingById.keys()) {
        if (!incomingIds.has(existingId)) neededPermissions.add("tasks:delete");
      }
    }

    for (const permission of neededPermissions) {
      if (!(await userHasTasksPermission(req, id, permission))) {
        return NextResponse.json({ message: "Forbidden: Insufficient task permissions" }, { status: 403 });
      }
    }

    // Track status change for audit log
    if (updates.status && updates.status !== milestone.status) {
      milestone.auditTrail.push({
        user: req.user.id,
        userName: req.user.name,
        userRole: req.user.role,
        action: "StatusChange",
        details: `Status changed from ${milestone.status} to ${updates.status}`,
      });
      
      if (updates.status === "Completed") {
        milestone.completedAt = new Date();
      } else {
        milestone.completedAt = null;
      }
    }

    // Track task updates
    if (updates.tasks) {
        milestone.auditTrail.push({
            user: req.user.id,
            userName: req.user.name,
            userRole: req.user.role,
            action: "TaskUpdated",
            details: `Tasks updated`,
        });

        // Auto-generate Risk for any Delayed Tasks
        const delayedTasks = updates.tasks.filter(t => t.status === 'Delayed');
        for (const task of delayedTasks) {
          // Prevent spamming if risk already generated (could be checked in engine, but basic protection here)
          await RiskEngine.evaluateAndCreateRisk({
            projectId: id,
            organizationId: req.user.organizationId,
            user: req.user,
            sourceType: 'Task',
            sourceId: task._id || milestone._id, // task might not have _id if just a subdoc without it
            sourceName: task.title,
            title: `Schedule Risk: ${task.title} Delayed`,
            category: 'Logistics',
            description: `Auto-generated risk due to delayed task in milestone ${milestone.name}.`,
            impact: 'High',
            probability: 'High'
          }).catch(err => console.error("Risk auto-gen failed for task:", err));
        }
        // Map over incoming tasks to preserve or set user fields
        updates.tasks = updates.tasks.map(incomingTask => {
          const existingTask = incomingTask._id ? milestone.tasks.id(incomingTask._id) : null;
          
          let createdBy = existingTask && existingTask.createdBy ? existingTask.createdBy : req.user.id;
          let createdByName = existingTask && existingTask.createdByName ? existingTask.createdByName : req.user.name;
          
          let completedBy = existingTask ? existingTask.completedBy : null;
          let completedByName = existingTask ? existingTask.completedByName : null;

          if (incomingTask.isCompleted && (!existingTask || !existingTask.isCompleted)) {
            completedBy = req.user.id;
            completedByName = req.user.name;
            incomingTask.completedAt = new Date();
          } else if (!incomingTask.isCompleted) {
            completedBy = null;
            completedByName = null;
            incomingTask.completedAt = null;
          }

          return {
            ...incomingTask,
            createdBy,
            createdByName,
            completedBy,
            completedByName
          };
        });
    }

    // Generic update
    Object.assign(milestone, updates);

    await milestone.save();
    emitToProject(id, 'milestone:updated', { milestoneId });

    return NextResponse.json(milestone);
  } catch (error) {
    return NextResponse.json({ message: "Error updating milestone" }, { status: 500 });
  }
});

export const DELETE = withPermission(async function (req, { params }) {
  try {
    await dbConnect();
    const { id, milestoneId } = await params;

    const result = await Milestone.deleteOne({
      _id: milestoneId,
      project: id,
      organization: req.user.organizationId
    });

    if (result.deletedCount === 0) {
      return NextResponse.json({ message: "Milestone not found" }, { status: 404 });
    }

    emitToProject(id, 'milestone:deleted', { milestoneId });
    return NextResponse.json({ message: "Milestone deleted successfully" });
  } catch (error) {
    return NextResponse.json({ message: "Error deleting milestone" }, { status: 500 });
  }
}, "tasks:delete");
