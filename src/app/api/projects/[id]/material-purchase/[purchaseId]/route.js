import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import MaterialPurchase from "@/models/MaterialPurchase";
import { withAuth } from "@/lib/middleware";
import { emitToProject } from "@/lib/socket-server";

export const PATCH = withAuth(async function (req, { params }) {
  try {
    const { id: projectId, purchaseId } = await params;
    await dbConnect();
    const { status } = await req.json();

    const purchase = await MaterialPurchase.findOne({
      _id: purchaseId,
      project: projectId,
      organization: req.user.organizationId,
    });
    if (!purchase) {
      console.error("PO approve 404 — no match. Query was:", { purchaseId, projectId, organizationId: req.user.organizationId });
      const anyMatch = await MaterialPurchase.findById(purchaseId).select("project organization status");
      console.error("Document actually stored as:", anyMatch ? {
        project: anyMatch.project?.toString(),
        organization: anyMatch.organization?.toString(),
        status: anyMatch.status,
      } : "NO DOCUMENT WITH THIS _id AT ALL");
      return NextResponse.json({ message: "Purchase order not found" }, { status: 404 });
    }

    const oldStatus = purchase.status;
    purchase.status = status;

    // Auto-generate ledger entries on approval — these are locked from direct
    // edit/delete in the Transactions tab (see linkedPurchase check in
    // /api/transactions/[id]) so they can't drift out of sync with the PO.
    if (status === "Approved" && oldStatus !== "Approved") {
      const { default: Transaction } = await import("@/models/Transaction");

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
          date: new Date(),
        });
      }

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
          date: new Date(),
        });
      }

      purchase.paymentStatus = "Paid";
    }

    await purchase.save();
    emitToProject(projectId, "material:updated");
    return NextResponse.json(purchase);
  } catch (error) {
    console.error("Update purchase order error:", error);
    return NextResponse.json({ message: error?.message || "Error updating purchase order" }, { status: 500 });
  }
});

export const DELETE = withAuth(async function (req, { params }) {
  try {
    const { id: projectId, purchaseId } = await params;
    await dbConnect();

    const purchase = await MaterialPurchase.findOneAndDelete({
      _id: purchaseId,
      project: projectId,
      organization: req.user.organizationId,
    });
    if (!purchase) return NextResponse.json({ message: "Purchase order not found" }, { status: 404 });

    emitToProject(projectId, "material:updated");
    return NextResponse.json({ message: "Purchase order deleted" });
  } catch (error) {
    return NextResponse.json({ message: "Error deleting purchase order" }, { status: 500 });
  }
});
