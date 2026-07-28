import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import LabourAttendance from "@/models/LabourAttendance";
import { withAuth } from "@/lib/middleware";

export const GET = withAuth(async function (req) {
  try {
    await dbConnect();
    
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");
    const date = searchParams.get("date");

    if (!projectId) {
      return NextResponse.json({ message: "projectId is required" }, { status: 400 });
    }

    const query = {
      organization: req.user.organizationId,
      project: projectId,
    };

    if (date) {
      query.attendanceDate = date;
    }

    const records = await LabourAttendance.find(query).populate("labour", "name type paymentCycle wageAmount");

    return NextResponse.json(records);
  } catch (error) {
    console.error("GET /api/labour-attendance error:", error);
    return NextResponse.json({ message: "Error fetching labour attendance" }, { status: 500 });
  }
});
