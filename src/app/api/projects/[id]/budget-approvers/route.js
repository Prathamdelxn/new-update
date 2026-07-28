import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Project from "@/models/Project";
import User from "@/models/User";
import Role from "@/models/Role";
import { withAuth } from "@/lib/middleware";

/**
 * GET /api/projects/:id/budget-approvers
 *
 * Returns users who are assigned to this project (via User.projects)
 * AND whose role has the "budget:approve" (or "*") permission.
 */
export const GET = withAuth(async function (req, { params }) {
  try {
    const { id } = await params;
    await dbConnect();

    // 1. First find all roles that have budget:approve or wildcard "*" within the same organization
    const approverRoles = await Role.find({
      organization: req.user.organizationId,
      permissions: { $in: ["budget:approve", "*"] }
    }).select("_id permissions");

    const approverRoleIds = approverRoles.map(r => r._id);
    const globalAdminRoleIds = approverRoles
      .filter(r => r.permissions.includes("*"))
      .map(r => r._id);

    if (approverRoleIds.length === 0) {
      return NextResponse.json([]); // No roles have this permission
    }

    // 2. Also get the project to collect its members array (verify organization)
    const project = await Project.findOne({ 
      _id: id, 
      organization: req.user.organizationId 
    }).select("members");
    
    if (!project) {
      return NextResponse.json({ message: "Project not found" }, { status: 404 });
    }

    const allMemberUserIds = project.members.map(m => m.user);
    const memberUsersWithApproverRole = project.members
      .filter(m => approverRoleIds.some(rId => rId.toString() === m.role?.toString()))
      .map(m => m.user);

    // 3. Find all users who:
    //    - Belong to the same organization, AND
    //    - Have an approver role globally or project-specifically, OR are global admins
    const assignedUsers = await User.find({
      organization: req.user.organizationId,
      $or: [
        {
          role: { $in: approverRoleIds },
          $or: [
            { "projects.project": id },
            { _id: { $in: allMemberUserIds } },
            { role: { $in: globalAdminRoleIds } } // global admins
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

    return NextResponse.json(approvers);
  } catch (error) {
    console.error("Budget approvers error:", error);
    return NextResponse.json(
      { message: "Error fetching budget approvers" },
      { status: 500 }
    );
  }
});
