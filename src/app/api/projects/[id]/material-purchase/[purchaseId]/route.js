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
    if (!purchase) return NextResponse.json({ message: "Purchase order not found" }, { status: 404 });

    purchase.status = status;
    await purchase.save();
    emitToProject(projectId, "material:updated");
    return NextResponse.json(purchase);
  } catch (error) {
    return NextResponse.json({ message: "Error updating purchase order" }, { status: 500 });
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
