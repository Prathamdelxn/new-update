import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import LabourAttendance from "@/models/LabourAttendance";
import { withAuth } from "@/lib/middleware";

export const POST = withAuth(async function (req) {
  try {
    await dbConnect();
    const { projectId, date, attendances } = await req.json();

    if (!projectId || !date || !Array.isArray(attendances)) {
      return NextResponse.json({ message: "Invalid payload" }, { status: 400 });
    }

    const organizationId = req.user.organizationId;
    const markedBy = req.user.id;

    // Delete existing records for this project on this date to allow overwrite
    await LabourAttendance.deleteMany({
      project: projectId,
      attendanceDate: date
    });

    const recordsToInsert = attendances.map(record => ({
      organization: organizationId,
      project: projectId,
      labour: record.labourId,
      attendanceDate: date,
      status: record.status, // "Present", "Absent", "Half Day"
      markedBy
    }));

    if (recordsToInsert.length > 0) {
      await LabourAttendance.insertMany(recordsToInsert);
    }

    return NextResponse.json({ message: "Bulk attendance saved successfully" }, { status: 201 });
  } catch (error) {
    console.error("POST /api/labour-attendance/bulk error:", error);
    return NextResponse.json({ message: "Error saving bulk attendance" }, { status: 500 });
  }
});
