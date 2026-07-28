import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Project from "@/models/Project";
import User from "@/models/User";
import { withAuth } from "@/lib/middleware";
import { emitToProject } from "@/lib/socket-server";

// Add a member to a project
export const POST = withAuth(async function (req, { params }) {
  try {
    const { id } = await params;
    await dbConnect();
    const { userIds, roleId, userId } = await req.json(); // Fallback to userId for compatibility

    const usersToAdd = userIds || (userId ? [userId] : []);

    if (usersToAdd.length === 0 || !roleId) {
      return NextResponse.json({ message: "User IDs and Role ID are required" }, { status: 400 });
    }

    const project = await Project.findOne({ _id: id, organization: req.user.organizationId });
    if (!project) {
      return NextResponse.json({ message: "Project not found" }, { status: 404 });
    }

    let addedCount = 0;
    const namesAdded = [];

    for (const uid of usersToAdd) {
      const userToAssign = await User.findOne({ _id: uid, organization: req.user.organizationId });
      if (!userToAssign) continue;

      // Check if user is already a member
      const isMember = project.members.some(m => m.user?.toString() === uid);
      if (isMember) continue;

      // Add to project members
      project.members.push({ user: uid, role: roleId });
      namesAdded.push(userToAssign.name);
      addedCount++;

      // Also update User.projects
      const hasProject = userToAssign.projects.some(p => p.project?.toString() === id);
      if (!hasProject) {
        userToAssign.projects.push({ project: id, role: roleId });
        await userToAssign.save();
      }
    }

    if (addedCount > 0) {
      // Audit trail
      project.auditTrail.push({
        user: req.user.id,
        userName: req.user.name || "Manager",
        userRole: req.user.role || "Member",
        action: "MemberAdded",
        details: `Added ${namesAdded.join(", ")} to the project`,
      });
      await project.save();
      emitToProject(id, 'project:updated');
    }

    return NextResponse.json({ message: `${addedCount} member(s) added successfully`, project });
  } catch (error) {
    console.error("Error adding project member:", error);
    return NextResponse.json({ message: "Error adding member" }, { status: 500 });
  }
});
