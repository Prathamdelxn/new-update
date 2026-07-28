import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import MaterialPurchase from "@/models/MaterialPurchase";
import { withAuth } from "@/lib/middleware";

// PATCH: Update purchase status
export const PATCH = withAuth(async function (req, { params }) {
  try {
    const { id: purchaseId } = await params;
    await dbConnect();
    const { status } = await req.json();

    if (!["Pending Approval", "Approved", "Rejected"].includes(status)) {
      return NextResponse.json({ message: "Invalid status" }, { status: 400 });
    }

    const purchase = await MaterialPurchase.findOne({ 
      _id: purchaseId,
      organization: req.user.organizationId 
    });

    if (!purchase) {
      return NextResponse.json({ message: "Material purchase not found" }, { status: 404 });
    }

    const oldStatus = purchase.status;
    purchase.status = status;

    // Handle Transaction Logic upon Approval
    if (status === "Approved" && oldStatus !== "Approved") {
      const { default: Transaction } = await import("@/models/Transaction");

      // 1. Create transaction for Advance Payment (This DEDUCTS from balance)
      if (purchase.advancePayment > 0) {
        await Transaction.create({
          project: purchase.project,
          organization: purchase.organization,
          createdBy: req.user.id,
          createdByName: req.user.name,
          type: "Outgoing",
          amount: purchase.advancePayment,
          partyName: purchase.vendorName,
          category: "Material Advance",
          description: `Advance for Material Purchase ${purchase.poNumber || purchase._id}`,
          linkedPurchase: purchase._id,
          paymentMethod: "Other",
          date: new Date()
        });
      }

      // 2. Create transaction for Remaining Balance (This SHOWS but DOES NOT DEDUCT in current dashboard logic)
      if (purchase.remainingBalance > 0) {
        await Transaction.create({
          project: purchase.project,
          organization: purchase.organization,
          createdBy: req.user.id,
          createdByName: req.user.name,
          type: "Purchase Payment",
          amount: purchase.remainingBalance,
          partyName: purchase.vendorName,
          category: "Material Balance (Credit)",
          description: `Balance Amount for Material Purchase ${purchase.poNumber || purchase._id}`,
          linkedPurchase: purchase._id,
          paymentMethod: "Other",
          date: new Date()
        });
      }

      // Finalize status
      purchase.paymentStatus = "Paid";
    }

    await purchase.save();

    const { emitToProject } = await import("@/lib/socket-server");
    emitToProject(purchase.project, 'material:updated');

    return NextResponse.json({
      message: `Purchase marked as ${status} ${status === 'Approved' ? 'and transactions finalized' : ''}`,
      purchase
    });
  } catch (error) {
    console.error("Update material purchase error:", error);
    return NextResponse.json({ message: "Error updating material purchase" }, { status: 500 });
  }
});

// DELETE: Remove material purchase
export const DELETE = withAuth(async function (req, { params }) {
  try {
    const { id: purchaseId } = await params;
    await dbConnect();

    const purchase = await MaterialPurchase.findOneAndDelete({ 
      _id: purchaseId,
      organization: req.user.organizationId 
    });

    if (!purchase) {
      return NextResponse.json({ message: "Material purchase not found" }, { status: 404 });
    }

    return NextResponse.json({ message: "Purchase deleted successfully" });
  } catch (error) {
    console.error("Delete material purchase error:", error);
    return NextResponse.json({ message: "Error deleting material purchase" }, { status: 500 });
  }
});
