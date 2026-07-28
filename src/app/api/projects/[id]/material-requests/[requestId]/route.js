import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import MaterialRequest from "@/models/MaterialRequest";
import { withAuth } from "@/lib/middleware";
import { emitToProject } from "@/lib/socket-server";
import RiskEngine from "@/lib/riskEngine";

export const PATCH = withAuth(async function (req, { params }) {
  try {
    const { id: projectId, requestId } = await params;
    await dbConnect();
    const { status } = await req.json();

    const request = await MaterialRequest.findOne({
      _id: requestId,
      project: projectId,
      organization: req.user.organizationId,
    });
    if (!request) return NextResponse.json({ message: "Request not found" }, { status: 404 });

    request.status = status;
    await request.save();

    // Auto-generate Risk if delayed
    if (status === "Delayed") {
      await RiskEngine.evaluateAndCreateRisk({
        projectId: projectId,
        organizationId: req.user.organizationId,
        user: req.user,
        sourceType: 'MaterialRequest',
        sourceId: request._id,
        sourceName: request.materialName || 'Material',
        title: `Supply Chain Risk: ${request.materialName || 'Material'} Delayed`,
        category: 'Logistics',
        description: `Auto-generated risk: Material request for ${request.materialName || 'Material'} has been marked as delayed. Quantity: ${request.quantity} ${request.unit}.`,
        impact: 'High',
        probability: 'High'
      }).catch(err => console.error("Risk auto-gen failed for Material Request:", err));
    }

    emitToProject(projectId, "material:updated");
    return NextResponse.json(request);
  } catch (error) {
    return NextResponse.json({ message: "Error updating request" }, { status: 500 });
  }
});

export const DELETE = withAuth(async function (req, { params }) {
  try {
    const { id: projectId, requestId } = await params;
    await dbConnect();

    const request = await MaterialRequest.findOneAndDelete({
      _id: requestId,
      project: projectId,
      organization: req.user.organizationId,
    });
    if (!request) return NextResponse.json({ message: "Request not found" }, { status: 404 });

    emitToProject(projectId, "material:updated");
    return NextResponse.json({ message: "Request deleted" });
  } catch (error) {
    return NextResponse.json({ message: "Error deleting request" }, { status: 500 });
  }
});
