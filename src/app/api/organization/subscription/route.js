import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Organization from "@/models/Organization";
import Subscription from "@/models/Subscription";
import User from "@/models/User";
import Project from "@/models/Project";
import { withAuth } from "@/lib/middleware";

// GET /api/organization/subscription
// Returns the calling user's org subscription + live usage stats
export const GET = withAuth(async function (req) {
  try {
    await dbConnect();

    const org = await Organization.findById(req.user.organizationId).select("subscription name");
    if (!org) {
      return NextResponse.json({ message: "Organization not found" }, { status: 404 });
    }

    const sub = org.subscription
      ? await Subscription.findById(org.subscription).lean()
      : null;

    // Live usage
    const [userCount, projectCount] = await Promise.all([
      User.countDocuments({ organization: org._id }),
      Project.countDocuments({ organization: org._id }),
    ]);

    // Determine if trial has expired
    const isTrialExpired =
      sub?.status === "Trial" && sub?.trialEndsAt && new Date() > new Date(sub.trialEndsAt);

    return NextResponse.json({
      subscription: sub,
      isTrialExpired,
      usage: {
        users:    userCount,
        projects: projectCount,
      },
    });
  } catch (error) {
    return NextResponse.json({ message: "Error fetching subscription" }, { status: 500 });
  }
});
