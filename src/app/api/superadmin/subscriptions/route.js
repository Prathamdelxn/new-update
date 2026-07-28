import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Subscription from "@/models/Subscription";
import Organization from "@/models/Organization";
import User from "@/models/User";
import Project from "@/models/Project";
import { withSuperAdmin } from "@/lib/superadminMiddleware";

// GET /api/superadmin/subscriptions
// Returns all org subscriptions with usage stats
export const GET = withSuperAdmin(async function () {
  try {
    await dbConnect();

    const orgs = await Organization.find({}).populate("owner", "name email").lean();

    const results = await Promise.all(
      orgs.map(async (org) => {
        const [sub, userCount, projectCount] = await Promise.all([
          Subscription.findOne({ organization: org._id }).lean(),
          User.countDocuments({ organization: org._id }),
          Project.countDocuments({ organization: org._id }),
        ]);

        return {
          orgId:       org._id,
          orgName:     org.name,
          owner:       org.owner,
          createdAt:   org.createdAt,
          subscription: sub || null,
          usage: {
            users:    userCount,
            projects: projectCount,
          },
        };
      })
    );

    return NextResponse.json(results);
  } catch (error) {
    return NextResponse.json({ message: "Error fetching subscriptions" }, { status: 500 });
  }
});

// POST /api/superadmin/subscriptions
// Create a new subscription for an org (or replace existing)
export const POST = withSuperAdmin(async function (req) {
  try {
    await dbConnect();
    const { orgId, plan, status, trialEndsAt, renewalDate, overrides, reason } = await req.json();

    if (!orgId || !plan) {
      return NextResponse.json({ message: "orgId and plan are required" }, { status: 400 });
    }

    const org = await Organization.findById(orgId);
    if (!org) {
      return NextResponse.json({ message: "Organization not found" }, { status: 404 });
    }

    let sub = await Subscription.findOne({ organization: orgId });

    const historyEntry = {
      plan,
      status: status || "Active",
      changedBy: req.superAdmin?.name || "SuperAdmin",
      reason: reason || "Plan assigned",
    };

    if (sub) {
      // Update existing
      sub.plan        = plan;
      sub.status      = status || sub.status;
      sub.trialEndsAt = trialEndsAt ? new Date(trialEndsAt) : sub.trialEndsAt;
      sub.renewalDate = renewalDate ? new Date(renewalDate) : sub.renewalDate;
      sub.overrides   = overrides || sub.overrides;
      sub.applyPlanDefaults();
      sub.history.push(historyEntry);
      await sub.save();
    } else {
      // Create new
      sub = new Subscription({
        organization: orgId,
        plan,
        status:      status || "Active",
        trialEndsAt: trialEndsAt ? new Date(trialEndsAt) : undefined,
        renewalDate: renewalDate ? new Date(renewalDate) : undefined,
        overrides:   overrides || {},
      });
      sub.applyPlanDefaults();
      sub.history.push(historyEntry);
      await sub.save();

      // Link back to org
      org.subscription = sub._id;
      await org.save();
    }

    return NextResponse.json(sub, { status: 201 });
  } catch (error) {
    return NextResponse.json({ message: "Error saving subscription" }, { status: 500 });
  }
});
