import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import MaterialRequest from "@/models/MaterialRequest";
import { withAuth } from "@/lib/middleware";
import { emitToProject } from "@/lib/socket-server";

export const PATCH = withAuth(async function (req, { params }) {
  try {
    const { id: projectId } = await params;
    await dbConnect();
    const { ids, status } = await req.json();

    if (!ids || !Array.isArray(ids) || ids.length === 0)
      return NextResponse.json({ message: "No IDs provided" }, { status: 400 });

    await MaterialRequest.updateMany(
      { _id: { $in: ids }, project: projectId, organization: req.user.organizationId },
      { $set: { status } }
    );

    emitToProject(projectId, "material:updated");
    return NextResponse.json({ message: `${ids.length} request(s) updated to ${status}` });
  } catch (error) {
    return NextResponse.json({ message: "Error bulk updating requests" }, { status: 500 });
  }
});
