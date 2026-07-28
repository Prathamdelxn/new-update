import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import PlanRequest from "@/models/PlanRequest";
import Subscription from "@/models/Subscription";
import Organization from "@/models/Organization";
import { withAuth } from "@/lib/middleware";

// GET /api/organization/plan-request
// Returns current org's latest plan request
export const GET = withAuth(async function (req) {
  await dbConnect();

  const request = await PlanRequest.findOne({
    organization: req.user.organizationId,
  })
    .sort({ createdAt: -1 })
    .lean();

  return NextResponse.json(request || null);
});

// POST /api/organization/plan-request
// Submit a new plan request (only one Pending allowed at a time)
export const POST = withAuth(async function (req) {
  await dbConnect();

  const { requestedPlan, note } = await req.json();

  if (!["Silver", "Gold", "Platinum"].includes(requestedPlan)) {
    return NextResponse.json({ message: "Invalid plan" }, { status: 400 });
  }

  // Block if there's already a pending request
  const existing = await PlanRequest.findOne({
    organization: req.user.organizationId,
    status: "Pending",
  });
  if (existing) {
    return NextResponse.json(
      { message: "You already have a pending plan request.", existing },
      { status: 409 }
    );
  }

  const org = await Organization.findById(req.user.organizationId).lean();
  const sub = await Subscription.findOne({ organization: req.user.organizationId }).lean();

  const request = await PlanRequest.create({
    organization: req.user.organizationId,
    orgName: org?.name || "",
    currentPlan: sub?.plan || "Silver",
    requestedPlan,
    note: note?.trim() || "",
    requestedBy: req.user.id,
    requestedByName: req.user.name || "",
  });

  return NextResponse.json(request, { status: 201 });
});

// DELETE /api/organization/plan-request
// Cancel a pending request
export const DELETE = withAuth(async function (req) {
  await dbConnect();

  const deleted = await PlanRequest.findOneAndDelete({
    organization: req.user.organizationId,
    status: "Pending",
  });

  if (!deleted) {
    return NextResponse.json({ message: "No pending request found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
});
