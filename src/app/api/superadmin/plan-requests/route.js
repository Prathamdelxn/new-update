import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import PlanRequest from "@/models/PlanRequest";
import { withSuperAdmin } from "@/lib/superadminMiddleware";

// GET /api/superadmin/plan-requests
// List all requests, Pending first
export const GET = withSuperAdmin(async function () {
  await dbConnect();

  const requests = await PlanRequest.find({})
    .sort({ status: 1, createdAt: -1 })
    .lean();

  return NextResponse.json(requests);
});
