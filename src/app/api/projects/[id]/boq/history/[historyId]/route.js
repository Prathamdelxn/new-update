import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import BOQ from "@/models/BOQ";
import { withAuth } from "@/lib/middleware";

/**
 * GET /api/projects/:id/boq/history/:historyId
 * 
 * Fetches all versions of a specific BOQ item.
 */
export const GET = withAuth(async function (req, { params }) {
  try {
    const { id, historyId } = await params;
    await dbConnect();

    const versions = await BOQ.find({ 
      project: id, 
      $or: [
        { historyId: historyId },
        { _id: historyId }
      ]
    }).sort({ version: -1 });

    return NextResponse.json(versions);
  } catch (error) {
    console.error("Fetch BOQ history error:", error);
    return NextResponse.json({ message: "Error fetching history" }, { status: 500 });
  }
});
