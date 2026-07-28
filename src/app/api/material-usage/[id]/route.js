import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import MaterialUsage from "@/models/MaterialUsage";
import { withAuth } from "@/lib/middleware";

// DELETE: Remove material usage
export const DELETE = withAuth(async function (req, { params }) {
  try {
    const { id: usageId } = await params;
    await dbConnect();

    const usage = await MaterialUsage.findOneAndDelete({ 
      _id: usageId,
      organization: req.user.organizationId 
    });

    if (!usage) {
      return NextResponse.json({ message: "Material usage not found" }, { status: 404 });
    }

    return NextResponse.json({ message: "Usage deleted successfully" });
  } catch (error) {
    console.error("Delete material usage error:", error);
    return NextResponse.json({ message: "Error deleting material usage" }, { status: 500 });
  }
});
