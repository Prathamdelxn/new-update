import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import FFEItem from "@/models/FFEItem";
import Project from "@/models/Project";
import { withSubscription, withPermission } from "@/lib/middleware";

// GET /api/projects/[id]/ffe
// Optional query: ?room=<roomId>  to filter by room
export const GET = withSubscription(withPermission(async function (req, { params }) {
  try {
    await dbConnect();
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const roomId = searchParams.get("room");

    const query = { project: id };
    if (roomId) query.room = roomId;

    const items = await FFEItem.find(query)
      .populate("room", "name type floor")
      .sort({ category: 1, name: 1 })
      .lean();

    // Compute summary totals
    const totalCost = items.reduce((sum, i) => sum + (i.totalCost || 0), 0);
    const byStatus = items.reduce((acc, i) => {
      acc[i.status] = (acc[i.status] || 0) + 1;
      return acc;
    }, {});

    return NextResponse.json({ items, totalCost, byStatus });
  } catch (error) {
    return NextResponse.json({ message: "Error fetching FFE items" }, { status: 500 });
  }
}, "interior"), "ffe:view");

// POST /api/projects/[id]/ffe
export const POST = withSubscription(withPermission(async function (req, { params }) {
  try {
    await dbConnect();
    const { id } = await params;
    const body = await req.json();

    const project = await Project.findById(id).select("organization projectType");
    if (!project) {
      return NextResponse.json({ message: "Project not found" }, { status: 404 });
    }
    if (project.projectType !== "Interior") {
      return NextResponse.json({ message: "FFE items can only be added to Interior projects" }, { status: 400 });
    }

    const item = new FFEItem({
      project:          id,
      organization:     project.organization,
      room:             body.room || null,
      name:             body.name,
      category:         body.category,
      description:      body.description,
      quantity:         body.quantity,
      unit:             body.unit,
      unitCost:         body.unitCost,
      finish:           body.finish,
      colorCode:        body.colorCode,
      dimensions:       body.dimensions,
      brand:            body.brand,
      modelNo:          body.modelNo,
      supplier:         body.supplier,
      status:           body.status,
      orderedDate:      body.orderedDate,
      expectedDelivery: body.expectedDelivery,
      images:           body.images || [],
      notes:            body.notes,
      createdBy:        req.user.id,
      createdByName:    req.user.name,
    });

    await item.save();
    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    return NextResponse.json({ message: "Error creating FFE item" }, { status: 500 });
  }
}, "interior"), "ffe:create");
