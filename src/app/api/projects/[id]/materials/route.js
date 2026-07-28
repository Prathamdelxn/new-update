import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Material from "@/models/Material";
import { withAuth } from "@/lib/middleware";
import { emitToProject } from "@/lib/socket-server";

// GET all materials for a specific project
export const GET = withAuth(async function (req, { params }) {
  try {
    const { id } = await params;
    await dbConnect();
    
    const materials = await Material.find({ 
      project: id, 
      organization: req.user.organizationId 
    }).sort({ updatedAt: -1 });

    return NextResponse.json(materials);
  } catch (error) {
    return NextResponse.json({ message: "Error fetching materials" }, { status: 500 });
  }
});

// POST: Add a new material to a project
export const POST = withAuth(async function (req, { params }) {
  try {
    const { id } = await params;
    await dbConnect();
    const body = await req.json();
    const { name, unit, initialStock } = body;

    const newMaterial = new Material({
      name,
      unit,
      project: id,
      organization: req.user.organizationId,
      totalReceived: initialStock || 0,
      logs: initialStock > 0 ? [{
        type: "In",
        quantity: initialStock,
        note: "Initial stock entry",
        updatedBy: req.user.id,
        updatedByName: req.user.name
      }] : []
    });

    await newMaterial.save();
    emitToProject(id, 'material:updated');
    return NextResponse.json(newMaterial, { status: 201 });
  } catch (error) {
    return NextResponse.json({ message: "Error creating material" }, { status: 500 });
  }
});
