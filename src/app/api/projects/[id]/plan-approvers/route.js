import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Project from "@/models/Project";
import User from "@/models/User";
import Role from "@/models/Role";
import { withAuth } from "@/lib/middleware";

/**
 * GET /api/projects/:id/plan-approvers
 *
 * Returns users who can approve drawings/plans:
 * - All Admins / SuperAdmins / wildcard role holders in the organization (always included)
 * - Users assigned to this project with "plans:approve" permission (global or project-level role)
 */
export const GET = withAuth(async function (req, { params }) {
  try {
    const { id } = await params;
    await dbConnect();

    const project = await Project.findById(id).select("organization members createdBy");
    if (!project) {
      return NextResponse.json({ message: "Project not found" }, { status: 404 });
    }

    const orgId = project.organization || req.user?.organizationId;

    const query = { status: { $ne: "Inactive" } };
    if (orgId) {
      query.organization = orgId;
    }

    const allUsers = await User.find(query)
      .populate("role", "name permissions isSystemRole")
      .populate("projects.role", "name permissions isSystemRole")
      .select("name email role projects __enc_name status");

    const projectMemberIds = (project.members || []).map(m => m.user?.toString() || m._id?.toString() || m.toString());

    const approvers = allUsers.filter(u => {
      const uIdStr = u._id.toString();

      // 1. Global Admin check (always eligible to approve plans in the organization)
      const roleName = u.role?.name || "";
      const isGlobalAdmin =
        roleName === "Admin" ||
        roleName === "SuperAdmin" ||
        roleName === "Super Admin" ||
        u.role?.isSystemRole ||
        (u.role?.permissions && u.role.permissions.includes("*"));

      if (isGlobalAdmin) {
        return true;
      }

      // 2. Check if user has global plans:approve permission AND is assigned to this project
      const hasGlobalPlanApprove = u.role?.permissions && (u.role.permissions.includes("plans:approve") || u.role.permissions.includes("*"));
      const isAssignedToProject =
        projectMemberIds.includes(uIdStr) ||
        (u.projects && u.projects.some(p => p.project && p.project.toString() === id));

      if (hasGlobalPlanApprove && isAssignedToProject) {
        return true;
      }

      // 3. Check project-specific role in u.projects
      if (u.projects && Array.isArray(u.projects)) {
        const projAssigment = u.projects.find(p => p.project && p.project.toString() === id);
        if (projAssigment && projAssigment.role) {
          const projPerms = projAssigment.role.permissions || [];
          const projRoleName = projAssigment.role.name || "";
          if (
            projPerms.includes("plans:approve") ||
            projPerms.includes("*") ||
            projRoleName === "Admin"
          ) {
            return true;
          }
        }
      }

      // 4. Check project.members for project-specific role
      if (project.members && Array.isArray(project.members)) {
        const memberEntry = project.members.find(m => (m.user?.toString() || m._id?.toString()) === uIdStr);
        if (memberEntry && memberEntry.role) {
          const memberRoleId = memberEntry.role.toString();
          if (u.role && u.role._id.toString() === memberRoleId) {
            if (u.role.permissions?.includes("plans:approve") || u.role.permissions?.includes("*")) {
              return true;
            }
          }
        }
      }

      return false;
    });

    const result = approvers.map(u => ({
      _id: u._id,
      name: u.name,
      email: u.email,
      roleName: u.role?.name || "Member",
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error("Plan approvers error:", error);
    return NextResponse.json(
      { message: "Error fetching plan approvers" },
      { status: 500 }
    );
  }
});
