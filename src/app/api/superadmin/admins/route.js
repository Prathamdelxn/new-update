import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Organization from "@/models/Organization";
import User from "@/models/User";
import Project from "@/models/Project";
import Template from "@/models/Template";
import { withSuperAdmin } from "@/lib/superadminMiddleware";

export const GET = withSuperAdmin(async function () {
  try {
    await dbConnect();

    const orgs = await Organization.find({})
      .populate("owner", "name email status createdAt")
      .sort({ createdAt: -1 });

    const admins = await Promise.all(
      orgs.map(async (org) => {
        const [userCount, projectCount, templateCount] = await Promise.all([
          User.countDocuments({ organization: org._id }),
          Project.countDocuments({ organization: org._id }),
          Template.countDocuments({ organization: org._id }),
        ]);

        return {
          orgId: org._id,
          orgName: org.name,
          createdAt: org.createdAt,
          admin: org.owner,
          stats: { userCount, projectCount, templateCount },
        };
      })
    );

    return NextResponse.json(admins);
  } catch (error) {
    console.error("SuperAdmin admins fetch error:", error);
    return NextResponse.json({ message: "Error fetching admins" }, { status: 500 });
  }
});
