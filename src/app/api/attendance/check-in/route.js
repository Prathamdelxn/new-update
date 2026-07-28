import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Attendance from "@/models/Attendance";
import Project from "@/models/Project";
import { withAuth } from "@/lib/middleware";

// Haversine formula to calculate distance between two coordinates in meters
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Earth radius in meters
  const toRad = (value) => (value * Math.PI) / 180;
  
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
            
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export const POST = withAuth(async function (req) {
  try {
    await dbConnect();
    const { projectId, location, checkInPhoto, deviceInfo } = await req.json();

    if (!projectId || !location) {
      return NextResponse.json({ message: "Project and location are required." }, { status: 400 });
    }

    const project = await Project.findById(projectId);
    if (!project) {
      return NextResponse.json({ message: "Project not found." }, { status: 404 });
    }

    // Determine current date (YYYY-MM-DD) based on server time
    const now = new Date();
    const attendanceDate = now.toISOString().split("T")[0];

    // Check if an active record already exists for today
    const existing = await Attendance.findOne({
      user: req.user.id,
      attendanceDate,
      checkOutTime: { $exists: false }
    });

    if (existing) {
      return NextResponse.json({ message: "You are already checked in today." }, { status: 400 });
    }

    let siteDistanceInMeters = null;
    let withinAllowedRadius = true;

    // Validate GPS if project has siteLocation
    if (project.siteLocation && project.siteLocation.latitude && project.siteLocation.longitude) {
      siteDistanceInMeters = calculateDistance(
        location.latitude,
        location.longitude,
        project.siteLocation.latitude,
        project.siteLocation.longitude
      );
      const radius = project.attendanceRadius || 100; // default 100m
      withinAllowedRadius = siteDistanceInMeters <= radius;

      // You can enforce strict server-side blocking here if you want:
      // if (!withinAllowedRadius) return NextResponse.json({ message: "Outside radius" }, { status: 403 });
    }

    // Determine Status (Always Present for successful check-ins)
    const status = "Present";

    const attendance = new Attendance({
      organization: req.user.organizationId,
      project: projectId,
      user: req.user.id,
      attendanceDate,
      checkInTime: now,
      checkInLocation: location,
      status,
      siteDistanceInMeters,
      withinAllowedRadius,
      checkInPhoto,
      deviceInfo,
      source: "Mobile"
    });

    await attendance.save();

    return NextResponse.json({ success: true, attendance }, { status: 201 });
  } catch (error) {
    console.error("POST /api/attendance/check-in error:", error);
    return NextResponse.json({ message: "Error during check-in" }, { status: 500 });
  }
});
