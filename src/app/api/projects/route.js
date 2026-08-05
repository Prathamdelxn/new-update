import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Project from "@/models/Project";
import { withAuth } from "@/lib/middleware"; // trigger rebuild

export const POST = withAuth(async function (req) {
  try {
    await dbConnect();
    const data = await req.json();

    const {
      name,
      description,
      category,
      startDate,
      endDate,
      needSiteSurvey,
      projectType,
      budget,
      currency,
      areaUnit,
      area,
      documents,
      drawings,
      siteLocation,
      attendanceRadius,
      templateId,
      createdBy,
    } = data;

    if (!name) {
      return NextResponse.json({ message: "Project name is required" }, { status: 400 });
    }

    const project = await Project.create({
      name,
      description,
      category,
      templateId,
      startDate,
      endDate,
      needSiteSurvey,
      projectType,
      budget,
      currency,
      areaUnit,
      area,
      documents,
      drawings,
      siteLocation,
      attendanceRadius,
      organization: req.user.organizationId,
      createdBy: req.user.id || createdBy,
    });

    return NextResponse.json(project, { status: 201 });

  } catch (error) {
    console.error("Create Project Error:", error);
    return NextResponse.json(
      { message: "Failed to create project", error: error.message },
      { status: 500 }
    );
  }
});

export const GET = withAuth(async function (req) {
  try {
    await dbConnect();

    const projects = await Project.find({ organization: req.user.organizationId })
      .populate('customer', 'name email mobileNumber propertyType')
      .populate('assignedTo', 'name')
      .sort({ createdAt: -1 });

    // Decrypt populated customer fields if using encryption
    projects.forEach(proj => {
      if (proj.customer && typeof proj.customer.decryptFieldsSync === 'function') {
        proj.customer.decryptFieldsSync();
      }
      if (proj.assignedTo && Array.isArray(proj.assignedTo)) {
        proj.assignedTo.forEach(user => {
          if (user && typeof user.decryptFieldsSync === 'function') {
            user.decryptFieldsSync();
          }
        });
      }
    });

    return NextResponse.json(projects, { status: 200 });

  } catch (error) {
    console.error("Fetch Projects Error:", error);
    return NextResponse.json(
      { message: "Failed to fetch projects" },
      { status: 500 }
    );
  }
});
