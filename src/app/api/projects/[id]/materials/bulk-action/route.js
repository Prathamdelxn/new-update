import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Material from "@/models/Material";
import { withAuth } from "@/lib/middleware";
import { emitToProject } from "@/lib/socket-server";

// POST: Perform bulk actions on multiple materials
export const POST = withAuth(async function (req, { params }) {
  try {
    const { id: projectId } = await params;
    await dbConnect();
    const { type, items, commonNote } = await req.json();

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ message: "No items provided" }, { status: 400 });
    }

    const results = [];
    
    // Process each item in the bulk request
    for (const item of items) {
      const { materialId, quantity, note } = item;
      
      const material = await Material.findOne({ 
        _id: materialId, 
        project: projectId,
        organization: req.user.organizationId 
      });

      if (material) {
        // Update totals if applicable
        if (type === "Received" || type === "Purchase") {
          material.totalReceived += Number(quantity);
        } else if (type === "Used") {
          material.totalConsumed += Number(quantity);
        }

        // Add log entry
        material.logs.push({
          type,
          quantity: Number(quantity),
          note: note || commonNote || `Bulk ${type}`,
          updatedBy: req.user.id,
          updatedByName: req.user.name,
          date: new Date()
        });

        await material.save();
        results.push(material);
      }
    }

    emitToProject(projectId, 'material:updated');
    return NextResponse.json({
      message: `Bulk ${type} processed successfully`,
      processedCount: results.length,
      materials: results
    });
  } catch (error) {
    console.error("Bulk action error:", error);
    return NextResponse.json({ message: "Error processing bulk action" }, { status: 500 });
  }
});
