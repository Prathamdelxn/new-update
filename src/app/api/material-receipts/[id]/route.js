import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import MaterialReceipt from "@/models/MaterialReceipt";
import Material from "@/models/Material";
import { withAuth } from "@/lib/middleware";

// PATCH: Verify or Reject receipt
export const PATCH = withAuth(async function (req, { params }) {
  try {
    const { id: receiptId } = await params;
    await dbConnect();
    const { status } = await req.json();

    if (!["Pending Verification", "Verified", "Rejected"].includes(status)) {
      return NextResponse.json({ message: "Invalid status" }, { status: 400 });
    }

    const receipt = await MaterialReceipt.findOne({ 
      _id: receiptId,
      organization: req.user.organizationId 
    });

    if (!receipt) {
      return NextResponse.json({ message: "Material receipt not found" }, { status: 404 });
    }

    const previousStatus = receipt.status;
    receipt.status = status;

    // If moving to Verified from Pending, update the actual materials inventory
    if (status === "Verified" && previousStatus === "Pending Verification") {
      for (const item of receipt.items) {
        const material = await Material.findOne({ _id: item.materialId });
        if (material) {
          material.totalReceived += Number(item.quantity);
          
          let noteStr = `Verified Receipt ${receipt._id}`;
          if (receipt.challanNumber) noteStr += ` | Challan: ${receipt.challanNumber}`;
          if (receipt.vendorName) noteStr += ` | Vendor: ${receipt.vendorName}`;
          if (receipt.commonNote) noteStr += ` | Note: ${receipt.commonNote}`;

          // Log it in the material history
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
    }

    await receipt.save();

    return NextResponse.json({
      message: `Receipt marked as ${status}`,
      receipt
    });
  } catch (error) {
    console.error("Update material receipt error:", error);
    return NextResponse.json({ message: "Error updating material receipt" }, { status: 500 });
  }
});

// DELETE: Remove material receipt
export const DELETE = withAuth(async function (req, { params }) {
  try {
    const { id: receiptId } = await params;
    await dbConnect();

    const receipt = await MaterialReceipt.findOneAndDelete({ 
      _id: receiptId,
      organization: req.user.organizationId 
    });

    if (!receipt) {
      return NextResponse.json({ message: "Material receipt not found" }, { status: 404 });
    }

    return NextResponse.json({ message: "Receipt deleted successfully" });
  } catch (error) {
    console.error("Delete material receipt error:", error);
    return NextResponse.json({ message: "Error deleting material receipt" }, { status: 500 });
  }
});
