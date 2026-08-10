import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Milestone from "@/models/Milestone";
import User from "@/models/User";
import { withAuth, withPermission } from "@/lib/middleware";
import { emitToProject } from "@/lib/socket-server";

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

export const GET = withPermission(async function (req, { params }) {
  try {
    await dbConnect();
    const { id } = await params;
    
    const milestones = await Milestone.find({ 
      project: id,
      organization: req.user.organizationId 
    }).sort({ dueDate: 1 });

    return NextResponse.json(milestones);
  } catch (error) {
    return NextResponse.json({ message: "Error fetching milestones" }, { status: 500 });
  }
}, "tasks:view");

export const POST = withAuth(async function (req, { params }) {
  try {
    await dbConnect();
    const { id } = await params;
    const { name, description, dueDate, status, tasks } = await req.json();

    if (!(await userHasTasksPermission(req, id, "tasks:create"))) {
      return NextResponse.json({ message: "Forbidden: No task creation permission" }, { status: 403 });
    }
    if ((tasks || []).some(t => t.assignedTo) && !(await userHasTasksPermission(req, id, "tasks:assign"))) {
      return NextResponse.json({ message: "Forbidden: No task assignment permission" }, { status: 403 });
    }

    const milestoneData = {
      name,
      description,
      dueDate,
      status: status || "Pending",
      project: id,
      organization: req.user.organizationId,
      createdBy: req.user.id,
      tasks: (tasks || []).map(t => ({
        ...t,
        createdBy: req.user.id,
        createdByName: req.user.name,
      })),
    };

    const milestone = new Milestone(milestoneData);

    // Add initial audit entry
    milestone.auditTrail.push({
      user: req.user.id,
      userName: req.user.name || "User",
      userRole: req.user.role || "Member",
      action: "Create",
      details: `Milestone "${name}" created`,
    });

    await milestone.save();
    emitToProject(id, 'milestone:created', { milestoneId: milestone._id.toString() });

    // Check if project should transition to Ongoing
    const { checkAndTransitionToOngoing } = await import("@/lib/projectStatusHelper");
    await checkAndTransitionToOngoing(id);

    return NextResponse.json(milestone, { status: 201 });
  } catch (error) {
    return NextResponse.json({ message: "Error creating milestone" }, { status: 500 });
  }
});
