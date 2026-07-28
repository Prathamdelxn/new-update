import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Project from "@/models/Project";
import User from "@/models/User";
import Role from "@/models/Role";
import { withAuth } from "@/lib/middleware";

/**
 * GET /api/projects/:id/boq-approvers
 *
 * Returns users who have the "boq:approve" (or "*") permission
 * in the same organization, prioritized by project membership.
 */
export const GET = withAuth(async function (req, { params }) {
  try {
    const { id } = await params;
    await dbConnect();

    // 1. Find all roles that have boq:approve or wildcard "*"
    const approverRoles = await Role.find({
      organization: req.user.organizationId,
      permissions: { $in: ["boq:approve", "*"] }
    }).select("_id name");

    const approverRoleIds = approverRoles.map(r => r._id);
    const adminRoleId = approverRoles.find(r => r.name === "Admin")?._id;

    if (approverRoleIds.length === 0) {
      return NextResponse.json([]); // No roles have this permission
    }

    // 2. Get the project to collect its members
    const project = await Project.findById(id).select("members");
    if (!project) {
      return NextResponse.json({ message: "Project not found" }, { status: 404 });
    }

    const allMemberUserIds = project.members.map(m => m.user);
    const memberUsersWithApproverRole = project.members
      .filter(m => approverRoleIds.some(rId => rId.toString() === m.role?.toString()))
      .map(m => m.user);

    // 3. Find users in the organization who:
    //    - Have an approver role globally or project-specifically
    const query = {
      organization: req.user.organizationId,
      status: "Active",
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
    };

    // If we found an Admin role, allow Admins even if not assigned to the project
    if (adminRoleId) {
      query.$or.push({ role: adminRoleId });
    }

    const users = await User.find(query)
      .populate("role", "name permissions")
      .select("name email role projects __enc_name");

    // Map and format results
    const approvers = users.map(u => ({
      _id: u._id,
      name: u.name,
      email: u.email,
      roleName: u.role?.name || "Member",
      isProjectMember: u.projects.includes(id) || project.members.includes(u._id)
    }));

    return NextResponse.json(approvers);
  } catch (error) {
    console.error("BOQ approvers error:", error);
    return NextResponse.json(
      { message: "Error fetching BOQ approvers" },
      { status: 500 }
    );
  }
});
