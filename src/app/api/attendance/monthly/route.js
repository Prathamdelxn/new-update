import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Attendance from "@/models/Attendance";
import { withAuth } from "@/lib/middleware";
import User from "@/models/User";

export const GET = withAuth(async function (req) {
  try {
    await dbConnect();
    
    const url = new URL(req.url);
    const projectId = url.searchParams.get("projectId");
    const month = url.searchParams.get("month"); // e.g., "2026-06"
    
    // Allow fetching another user's attendance if passed (and if authorized), else fallback to self
    const userId = url.searchParams.get("userId") || req.user.id;

    if (!projectId || !month) {
      return NextResponse.json({ message: "Missing required query parameters: projectId, month" }, { status: 400 });
    }

    const userDoc = await User.findById(req.user.id).populate("role");
    const isAdmin = userDoc?.role?.name === "Admin" || req.user.role === "Admin";

    const query = {
      project: projectId,
      organization: req.user.organizationId,
      attendanceDate: { $regex: `^${month}` }
    };

    if (!isAdmin) {
      query.user = userId;
    }

    const records = await Attendance.find(query).populate("user").sort({ attendanceDate: -1 });

    return NextResponse.json({ records }, { status: 200 });
  } catch (error) {
    console.error("GET /api/attendance/monthly error:", error);
    return NextResponse.json({ message: "Error fetching monthly attendance" }, { status: 500 });
  }
});
