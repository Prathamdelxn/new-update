import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import MaterialRequest from "@/models/MaterialRequest";
import Material from "@/models/Material";
import { withAuth } from "@/lib/middleware";
import { emitToProject } from "@/lib/socket-server";

// GET: Fetch all material requests for a project
export const GET = withAuth(async function (req, { params }) {
  try {
    const { id: projectId } = await params;
    await dbConnect();

    const requests = await MaterialRequest.find({
      project: projectId,
      organization: req.user.organizationId,
    })
      .populate("items.materialId", "name unit")
      .sort({ createdAt: -1 });

    return NextResponse.json(requests);
  } catch (error) {
    console.error("Fetch material requests error:", error);
    return NextResponse.json({ message: "Error fetching material requests" }, { status: 500 });
  }
});

// POST: Create a new material request
export const POST = withAuth(async function (req, { params }) {
  try {
    const { id: projectId } = await params;
    await dbConnect();
    const { items, commonNote } = await req.json();

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ message: "No items provided" }, { status: 400 });
    }

    // Process items to include units for historical accuracy (if material gets deleted later)
    const processedItems = [];
    for (const item of items) {
      const material = await Material.findOne({ 
        _id: item.materialId, 
        project: projectId,
        organization: req.user.organizationId 
      });

      if (material) {
        processedItems.push({
          materialId: material._id,
          quantity: item.quantity,
          unit: material.unit
        });
      }
    }

    if (processedItems.length === 0) {
      return NextResponse.json({ message: "No valid materials found for request" }, { status: 400 });
    }

    const newRequest = await MaterialRequest.create({
      project: projectId,
      organization: req.user.organizationId,
      requestedBy: req.user.id,
      requestedByName: req.user.name,
      items: processedItems,
      commonNote: commonNote || "",
      status: "Pending"
    });

    emitToProject(projectId, 'material:updated');
    return NextResponse.json({
      message: "Material request created successfully",
      request: newRequest
    }, { status: 201 });
  } catch (error) {
    console.error("Create material request error:", error);
    return NextResponse.json({ message: "Error creating material request" }, { status: 500 });
  }
});
