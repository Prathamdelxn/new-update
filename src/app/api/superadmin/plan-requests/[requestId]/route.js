import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import PlanRequest from "@/models/PlanRequest";
import Subscription from "@/models/Subscription";
import { withSuperAdmin } from "@/lib/superadminMiddleware";

// PATCH /api/superadmin/plan-requests/:requestId
// Approve or reject a plan request
export const PATCH = withSuperAdmin(async function (req, { params }) {
  await dbConnect();
  const { requestId } = await params;
  const { action, reviewNote } = await req.json(); // action: "Approved" | "Rejected"

  if (!["Approved", "Rejected"].includes(action)) {
    return NextResponse.json({ message: "action must be Approved or Rejected" }, { status: 400 });
  }

  const request = await PlanRequest.findById(requestId);
  if (!request) {
    return NextResponse.json({ message: "Request not found" }, { status: 404 });
  }
  if (request.status !== "Pending") {
    return NextResponse.json({ message: "Request is already reviewed" }, { status: 409 });
  }

  request.status = action;
  request.reviewNote = reviewNote?.trim() || "";
  request.reviewedBy = req.superAdmin?.name || "SuperAdmin";
  request.reviewedAt = new Date();
  await request.save();

  // If approved — update the subscription
  if (action === "Approved") {
    let sub = await Subscription.findOne({ organization: request.organization });
    if (sub) {
      sub.plan = request.requestedPlan;
      sub.status = "Active";
      sub.applyPlanDefaults();
      sub.history.push({
        plan: request.requestedPlan,
        status: "Active",
        changedBy: req.superAdmin?.name || "SuperAdmin",
        reason: `Plan request approved — ${reviewNote || "Approved by Super Admin"}`,
      });
      await sub.save();
    }
  }

  return NextResponse.json(request);
});
