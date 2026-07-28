import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Material from "@/models/Material";
import { withAuth } from "@/lib/middleware";

export const DELETE = withAuth(async function (req, { params }) {
  try {
    const { id: projectId, materialId } = await params;
    await dbConnect();

    const material = await Material.findOneAndDelete({
      _id: materialId,
      project: projectId,
      organization: req.user.organizationId,
    });
    if (!material) return NextResponse.json({ message: "Material not found" }, { status: 404 });

    return NextResponse.json({ message: "Material deleted" });
  } catch (error) {
    return NextResponse.json({ message: "Error deleting material" }, { status: 500 });
  }
});
