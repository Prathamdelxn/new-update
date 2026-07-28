import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Room from "@/models/Room";
import { withSubscription, withPermission } from "@/lib/middleware";

// GET /api/projects/[id]/rooms/[roomId]
export const GET = withSubscription(withPermission(async function (req, { params }) {
  try {
    await dbConnect();
    const { roomId } = await params;

    const room = await Room.findById(roomId).lean();
    if (!room) {
      return NextResponse.json({ message: "Room not found" }, { status: 404 });
    }

    return NextResponse.json(room);
  } catch (error) {
    return NextResponse.json({ message: "Error fetching room" }, { status: 500 });
  }
}, "interior"), "rooms:view");

// PATCH /api/projects/[id]/rooms/[roomId]
export const PATCH = withSubscription(withPermission(async function (req, { params }) {
  try {
    await dbConnect();
    const { roomId } = await params;
    const updates = await req.json();

    const allowed = ["name", "type", "floor", "area", "areaUnit", "status", "notes"];
    const patch = {};
    allowed.forEach(k => { if (updates[k] !== undefined) patch[k] = updates[k]; });

    const room = await Room.findByIdAndUpdate(roomId, patch, { new: true, runValidators: true });
    if (!room) {
      return NextResponse.json({ message: "Room not found" }, { status: 404 });
    }

    return NextResponse.json(room);
  } catch (error) {
    return NextResponse.json({ message: "Error updating room" }, { status: 500 });
  }
}, "interior"), "rooms:update");

// DELETE /api/projects/[id]/rooms/[roomId]
export const DELETE = withSubscription(withPermission(async function (req, { params }) {
  try {
    await dbConnect();
    const { roomId } = await params;

    const room = await Room.findByIdAndDelete(roomId);
    if (!room) {
      return NextResponse.json({ message: "Room not found" }, { status: 404 });
    }

    return NextResponse.json({ message: "Room deleted" });
  } catch (error) {
    return NextResponse.json({ message: "Error deleting room" }, { status: 500 });
  }
}, "interior"), "rooms:delete");
