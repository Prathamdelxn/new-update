import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Project from "@/models/Project";
import User from "@/models/User";
import Role from "@/models/Role";
import { withAuth } from "@/lib/middleware";

/**
 * GET /api/projects/:id/plan-approvers
 *
 * Returns users who are assigned to this project (via either Project.members
 * OR User.projects) AND whose role has the "plans:approve" (or "*") permission.
 */
export const GET = withAuth(async function (req, { params }) {
  try {
    const { id } = await params;
    await dbConnect();

    // 1. First find all roles that have plans:approve or wildcard "*"
    const approverRoles = await Role.find({
      permissions: { $in: ["plans:approve", "*"] }
    }).select("_id");

    const approverRoleIds = approverRoles.map(r => r._id);

    if (approverRoleIds.length === 0) {
      return NextResponse.json([]); // No roles have this permission
    }

    // 2. Also get the project to collect its members array
    const project = await Project.findById(id).select("members");
    if (!project) {
      return NextResponse.json({ message: "Project not found" }, { status: 404 });
    }

    const allMemberUserIds = project.members.map(m => m.user);
    const memberUsersWithApproverRole = project.members
      .filter(m => approverRoleIds.some(rId => rId.toString() === m.role?.toString()))
      .map(m => m.user);

    // 3. Find all users who:
    //    - Have a global approver role AND are assigned to this project, OR
    //    - Have a project-specific approver role
    const assignedUsers = await User.find({
      $or: [
        {
          role: { $in: approverRoleIds },
          $or: [
            { "projects.project": id },
            { _id: { $in: allMemberUserIds } }
          ]
        },
        {
          projects: {
            $elemMatch: { project: id, role: { $in: approverRoleIds } }
          }
        },
        { _id: { $in: memberUsersWithApproverRole } }
      ]
    })
      .populate("role", "name permissions")
      .select("name email role __enc_name");

    const approvers = assignedUsers.map(u => ({
      _id: u._id,
      name: u.name,
      email: u.email,
      roleName: u.role?.name || "Member",
    }));
console.log(approvers);
    return NextResponse.json(approvers);
  } catch (error) {
    console.error("Plan approvers error:", error);
    return NextResponse.json(
      { message: "Error fetching plan approvers" },
      { status: 500 }
    );
  }
});
