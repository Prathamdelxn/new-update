import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Attendance from "@/models/Attendance";
import { withAuth } from "@/lib/middleware";

export const PUT = withAuth(async function (req) {
  try {
    await dbConnect();
    const { location } = await req.json();

    const now = new Date();
    const attendanceDate = now.toISOString().split("T")[0];

    // Find today's open record for this user
    const attendance = await Attendance.findOne({
      user: req.user.id,
      attendanceDate,
      checkOutTime: { $exists: false }
    });

    if (!attendance) {
      return NextResponse.json({ message: "No active check-in found for today to check out from." }, { status: 404 });
    }

    attendance.checkOutTime = now;
    if (location) {
      attendance.checkOutLocation = location;
    }

    // Calculate total hours
    const diffMs = attendance.checkOutTime - attendance.checkInTime;
    const diffHours = diffMs / (1000 * 60 * 60);
    attendance.totalWorkHours = Number(diffHours.toFixed(2));

    // Update status to Half Day if less than a threshold (e.g., 4.5 hours)
    if (attendance.totalWorkHours < 4.5 && attendance.status === "Present") {
      attendance.status = "Half Day";
    }

    await attendance.save();

    return NextResponse.json({ success: true, attendance }, { status: 200 });
  } catch (error) {
    console.error("PUT /api/attendance/check-out error:", error);
    return NextResponse.json({ message: "Error during check-out" }, { status: 500 });
  }
});
