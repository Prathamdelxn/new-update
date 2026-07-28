import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Project from "@/models/Project";
import { withAuth } from "@/lib/middleware";

export const GET = withAuth(async function (req) {
  try {
    await dbConnect();
    const userId = req.user.id;

    // Find projects where status is "Under Snagging" and assigned to this user
    const projects = await Project.find({
      status: "Under Snagging",
      snaggedBy: userId,
      organization: req.user.organizationId
    }).select("name _id status");

    return NextResponse.json(projects);
  } catch (error) {
    return NextResponse.json({ message: "Error fetching assigned snaggings" }, { status: 500 });
  }
});
