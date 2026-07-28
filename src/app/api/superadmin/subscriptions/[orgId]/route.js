import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Subscription from "@/models/Subscription";
import Organization from "@/models/Organization";
import { withSuperAdmin } from "@/lib/superadminMiddleware";

// GET /api/superadmin/subscriptions/:orgId
export const GET = withSuperAdmin(async function (req, { params }) {
  try {
    await dbConnect();
    const { orgId } = await params;

    const sub = await Subscription.findOne({ organization: orgId }).lean();
    if (!sub) {
      return NextResponse.json({ message: "No subscription found for this organization" }, { status: 404 });
    }

    return NextResponse.json(sub);
  } catch (error) {
    return NextResponse.json({ message: "Error fetching subscription" }, { status: 500 });
  }
});

// PATCH /api/superadmin/subscriptions/:orgId
// Update plan, status, limits, or overrides
export const PATCH = withSuperAdmin(async function (req, { params }) {
  try {
    await dbConnect();
    const { orgId } = await params;
    const updates = await req.json();

    const sub = await Subscription.findOne({ organization: orgId });
    if (!sub) {
      return NextResponse.json({ message: "Subscription not found" }, { status: 404 });
    }

    const historyEntry = {
      plan:      updates.plan || sub.plan,
      status:    updates.status || sub.status,
      changedBy: req.superAdmin?.name || "SuperAdmin",
      reason:    updates.reason || "Plan updated",
    };

    if (updates.plan)        sub.plan        = updates.plan;
    if (updates.status)      sub.status      = updates.status;
    if (updates.trialEndsAt) sub.trialEndsAt = new Date(updates.trialEndsAt);
    if (updates.renewalDate) sub.renewalDate = new Date(updates.renewalDate);
    if (updates.overrides)   sub.overrides   = { ...sub.overrides.toObject?.() ?? sub.overrides, ...updates.overrides };

    sub.applyPlanDefaults();
    sub.history.push(historyEntry);
    await sub.save();

    return NextResponse.json(sub);
  } catch (error) {
    return NextResponse.json({ message: "Error updating subscription" }, { status: 500 });
  }
});
