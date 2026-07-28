import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import MaterialUsage from "@/models/MaterialUsage";
import Material from "@/models/Material";
import { withAuth } from "@/lib/middleware";
import { emitToProject } from "@/lib/socket-server";

export const DELETE = withAuth(async function (req, { params }) {
  try {
    const { id: projectId, logId } = await params;
    await dbConnect();

    const log = await MaterialUsage.findOne({
      _id: logId,
      project: projectId,
      organization: req.user.organizationId,
    });
    if (!log) return NextResponse.json({ message: "Usage log not found" }, { status: 404 });

    // Reverse the consumption so stock is restored
    for (const item of log.items) {
      await Material.findOneAndUpdate(
        { _id: item.materialId, project: projectId },
        { $inc: { totalConsumed: -Number(item.quantity) } }
      );
    }

    await log.deleteOne();
    emitToProject(projectId, "material:updated");
    return NextResponse.json({ message: "Usage log deleted and stock restored" });
  } catch (error) {
    return NextResponse.json({ message: "Error deleting usage log" }, { status: 500 });
  }
});
