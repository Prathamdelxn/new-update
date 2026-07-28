import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import MaterialReceipt from "@/models/MaterialReceipt";
import Material from "@/models/Material";
import { withAuth } from "@/lib/middleware";
import { emitToProject } from "@/lib/socket-server";

// GET: Fetch all material receipts for a project
export const GET = withAuth(async function (req, { params }) {
  try {
    const { id: projectId } = await params;
    await dbConnect();

    const receipts = await MaterialReceipt.find({
      project: projectId,
      organization: req.user.organizationId,
    })
      .populate("items.materialId", "name unit")
      .sort({ createdAt: -1 });

    return NextResponse.json(receipts);
  } catch (error) {
    console.error("Fetch material receipts error:", error);
    return NextResponse.json({ message: "Error fetching material receipts" }, { status: 500 });
  }
});

// POST: Create a new material receipt
export const POST = withAuth(async function (req, { params }) {
  try {
    const { id: projectId } = await params;
    await dbConnect();
    const { items, commonNote, vendorName, challanNumber, invoiceNumber, invoiceUrl } = await req.json();

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ message: "No items provided" }, { status: 400 });
    }

    // Process items
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
      return NextResponse.json({ message: "No valid materials found for receipt" }, { status: 400 });
    }

    const newReceipt = await MaterialReceipt.create({
      project: projectId,
      organization: req.user.organizationId,
      receivedBy: req.user.id,
      receivedByName: req.user.name,
      vendorName: vendorName || "",
      challanNumber: challanNumber || "",
      invoiceNumber: invoiceNumber || "",
      items: processedItems,
      commonNote: commonNote || "",
      invoiceUrl: invoiceUrl || null,
      status: "Verified"
    });

    // Immediately update actual inventory
    for (const item of processedItems) {
      const material = await Material.findOne({ _id: item.materialId });
      if (material) {
        material.totalReceived += Number(item.quantity);
        
        let noteStr = `Direct Receipt ${newReceipt._id}`;
        if (newReceipt.challanNumber) noteStr += ` | Challan: ${newReceipt.challanNumber}`;
        if (newReceipt.vendorName) noteStr += ` | Vendor: ${newReceipt.vendorName}`;
        if (newReceipt.commonNote) noteStr += ` | Note: ${newReceipt.commonNote}`;

        material.logs.push({
          type: "Received",
          quantity: Number(item.quantity),
          note: noteStr,
          updatedBy: req.user.id,
          updatedByName: req.user.name,
          date: new Date()
        });
        
        await material.save();
      }
    }

    emitToProject(projectId, 'material:updated');
    return NextResponse.json({
      message: "Material receipt created and added to inventory",
      receipt: newReceipt
    }, { status: 201 });
  } catch (error) {
    console.error("Create material receipt error:", error);
    return NextResponse.json({ message: "Error creating material receipt" }, { status: 500 });
  }
});
