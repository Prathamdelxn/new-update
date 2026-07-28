import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Attendance from "@/models/Attendance";
import { withAuth } from "@/lib/middleware";

export const GET = withAuth(async function (req) {
  try {
    await dbConnect();
    
    const now = new Date();
    const attendanceDate = now.toISOString().split("T")[0];

    // Find an open check-in for the current user today
    const activeAttendance = await Attendance.findOne({
      user: req.user.id,
      attendanceDate,
      checkOutTime: { $exists: false }
    }).populate("project", "name siteLocation attendanceRadius");

    if (activeAttendance) {
      return NextResponse.json({ 
        active: true, 
        record: activeAttendance 
      }, { status: 200 });
    }

    return NextResponse.json({ active: false, record: null }, { status: 200 });
  } catch (error) {
    console.error("GET /api/attendance/today error:", error);
    return NextResponse.json({ message: "Error fetching today's status" }, { status: 500 });
  }
});
