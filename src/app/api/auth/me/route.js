import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import User from "@/models/User";
import Role from "@/models/Role";
import Organization from "@/models/Organization";
import { withAuth } from "@/lib/middleware";

export const GET = withAuth(async function (req) {
  try {
    await dbConnect();
    const user = await User.findById(req.user.id)
      .populate("role")
      .populate("organization")
      .populate("projects.role");

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
          : typeof user.organization === 'string' && user.organization.length === 24
            ? user.organization
            : undefined,
        organization: user.organization,
        industryType: user.organization?.industryType || "construction",
        projects: (user.projects || []).map((p) => ({ project: p.project, role: p.role })),
      },
    });
  } catch (error) {
    console.error("Auth me error:", error);
    return NextResponse.json({ message: "Failed to fetch session" }, { status: 500 });
  }
});
