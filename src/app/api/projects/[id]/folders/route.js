import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import PlanFolder from "@/models/PlanFolder";
import Project from "@/models/Project";
import { withPermission } from "@/lib/middleware";
import { emitToProject } from "@/lib/socket-server";

// GET /api/projects/[id]/folders
// Fetch all folders for a project
export const GET = withPermission(async function (req, { params }) {
  try {
    const { id } = await params;
    await dbConnect();

    // Verify Project exists
    const project = await Project.findById(id);
    if (!project) {
      return NextResponse.json({ message: "Project not found" }, { status: 404 });
    }

    const folders = await PlanFolder.find({ project: id }).sort({ createdAt: 1 });
    return NextResponse.json(folders);
  } catch (error) {
    return NextResponse.json({ message: "Error fetching plan folders" }, { status: 500 });
  }
}, "plans:view");

// POST /api/projects/[id]/folders
// Create a new folder
export const POST = withPermission(async function (req, { params }) {
  try {
    const { id } = await params;
    await dbConnect();

    const { name } = await req.json();

    if (!name?.trim()) {
      return NextResponse.json({ message: "Folder name is required" }, { status: 400 });
    }

    const project = await Project.findById(id);
    if (!project) {
      return NextResponse.json({ message: "Project not found" }, { status: 404 });
    }

    const newFolder = new PlanFolder({
      name: name.trim(),
      project: id,
      createdBy: req.user.id,
      documents: []
    });

    await newFolder.save();

    // Automatically move to Planning status if it is Initialized
    if (project.status === "Initialized") {
      project.status = "Planning";
      project.auditTrail.push({
        user: req.user.id,
        userName: req.user.name || "User",
        userRole: req.user.role || "Member",
        action: "StatusChange",
        details: "Project automatically moved to Planning status following technical plan creation.",
      });
    }

    // Add audit entry to Project
    project.auditTrail.push({
      user: req.user.id,
      userName: req.user.name || "User",
      userRole: req.user.role || "Member",
      action: "Update",
      details: `Created new plans folder: ${name.trim()}`,
    });
    await project.save();

    emitToProject(id, 'plans:updated');
    return NextResponse.json(newFolder, { status: 201 });
  } catch (error) {
    return NextResponse.json({ message: "Error creating plan folder" }, { status: 500 });
  }
}, "plans:create");
