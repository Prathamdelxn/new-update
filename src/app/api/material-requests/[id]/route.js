import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import MaterialRequest from "@/models/MaterialRequest";
import Material from "@/models/Material";
import { withAuth } from "@/lib/middleware";

// PATCH: Update request status or content
export const PATCH = withAuth(async function (req, { params }) {
  try {
    const { id: requestId } = await params;
    await dbConnect();
    const { status, items, commonNote } = await req.json();

    const materialRequest = await MaterialRequest.findOne({ 
      _id: requestId,
      organization: req.user.organizationId 
    });

    if (!materialRequest) {
      return NextResponse.json({ message: "Material request not found" }, { status: 404 });
    }

    // Handle Status Update
    if (status) {
      if (!["Pending", "Approved", "Rejected", "Fulfilled"].includes(status)) {
        return NextResponse.json({ message: "Invalid status" }, { status: 400 });
      }
      materialRequest.status = status;
    }

    // Handle Content Update (only if Pending)
    if (items || commonNote !== undefined) {
      if (materialRequest.status !== "Pending" && !status) {
        return NextResponse.json({ message: "Can only edit pending requests" }, { status: 400 });
      }

      if (commonNote !== undefined) materialRequest.commonNote = commonNote;

      if (items && Array.isArray(items)) {
        const processedItems = [];
        for (const item of items) {
          const material = await Material.findOne({ _id: item.materialId });
          if (material) {
            processedItems.push({
              materialId: material._id,
              quantity: Number(item.quantity),
              unit: material.unit
            });
          }
        }
        if (processedItems.length > 0) {
          materialRequest.items = processedItems;
        }
      }
    }

    await materialRequest.save();

    return NextResponse.json({
      message: "Material request updated successfully",
      request: materialRequest
    });
  } catch (error) {
    console.error("Update material request error:", error);
    return NextResponse.json({ message: "Error updating material request" }, { status: 500 });
  }
});

// DELETE: Remove material request
export const DELETE = withAuth(async function (req, { params }) {
  try {
    const { id: requestId } = await params;
    await dbConnect();

    const request = await MaterialRequest.findOneAndDelete({ 
      _id: requestId,
      organization: req.user.organizationId 
    });

    if (!request) {
      return NextResponse.json({ message: "Material request not found" }, { status: 404 });
    }

    return NextResponse.json({ message: "Request deleted successfully" });
  } catch (error) {
    console.error("Delete material request error:", error);
    return NextResponse.json({ message: "Error deleting material request" }, { status: 500 });
  }
});
