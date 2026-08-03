import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Room from "@/models/Room";
import Project from "@/models/Project";
import { withPermission } from "@/lib/middleware";

// GET /api/projects/[id]/rooms
export const GET = withPermission(async function (req, { params }) {
  try {
    await dbConnect();
    const { id } = await params;

    const rooms = await Room.find({ project: id })
      .sort({ floor: 1, name: 1 })
      .lean();

    return NextResponse.json(rooms);
  } catch (error) {
    return NextResponse.json({ message: "Error fetching rooms" }, { status: 500 });
  }
}, "rooms:view");

// POST /api/projects/[id]/rooms
export const POST = withPermission(async function (req, { params }) {
  try {
    await dbConnect();
    const { id } = await params;
    const body = await req.json();

    const project = await Project.findById(id).select("organization projectType");
    if (!project) {
      return NextResponse.json({ message: "Project not found" }, { status: 404 });
    }
    if (project.projectType !== "Interior") {
      return NextResponse.json({ message: "Rooms can only be added to Interior projects" }, { status: 400 });
    }

    const room = new Room({
      project:      id,
      organization: project.organization,
      name:         body.name,
      type:         body.type,
      floor:        body.floor,
      area:         body.area,
      areaUnit:     body.areaUnit,
      notes:        body.notes,
      createdBy:    req.user.id,
    });

    await room.save();
    return NextResponse.json(room, { status: 201 });
  } catch (error) {
    return NextResponse.json({ message: "Error creating room" }, { status: 500 });
  }
}, "rooms:create");
