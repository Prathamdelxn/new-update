import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import User from "@/models/User";
import Role from "@/models/Role"; // Ensure Role schema is registered for population
import Organization from "@/models/Organization"; // Ensure Organization schema is registered for population
import { withAuth } from "@/lib/middleware";

// GET: the logged-in user with their current role/permissions, in the same
// shape as the login response. Lets clients pick up role changes an admin
// made after login instead of keeping the permissions from login time.
export const GET = withAuth(async function (req) {
  try {
    await dbConnect();
    const user = await User.findById(req.user.id)
      .populate("role")
      .populate("organization")
      .populate("projects.role", "name permissions isSystemRole");
    if (!user) {
      return NextResponse.json({ message: "User not found" }, { status: 404 });
    }

    return NextResponse.json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        organizationId: user.organization?._id
          ? user.organization._id.toString()
          : typeof user.organization === "string" && user.organization.length === 24
            ? user.organization
            : undefined,
        organization: user.organization,
        industryType: user.organization?.industryType || "construction",
        // Project-level roles — lets clients show actions like "Create Project"
        // that a project role can grant.
        projects: (user.projects || []).map((p) => ({ project: p.project, role: p.role })),
      },
    });
  } catch (error) {
    console.error("Fetch current user error:", error);
    return NextResponse.json({ message: "Error fetching current user" }, { status: 500 });
  }
});
