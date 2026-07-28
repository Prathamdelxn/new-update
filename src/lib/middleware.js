import { NextResponse } from "next/server";
import { verifyAccessToken } from "./auth";
import dbConnect from "./db";
import User from "@/models/User";
import Subscription from "@/models/Subscription";
import Organization from "@/models/Organization";

/**
 * Higher Order Function to protect API routes
 */
export const withAuth = (handler) => {
  return async (req, ...args) => {
    try {
      const authHeader = req.headers.get("authorization");
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return NextResponse.json({ message: "Unauthorized: No token provided" }, { status: 401 });
      }

      const token = authHeader.split(" ")[1];
      const decoded = verifyAccessToken(token);

      if (!decoded) {
        console.log("[withAuth] Token verification failed for header:", authHeader?.substring(0, 20) + "...");
        return NextResponse.json({ message: "Unauthorized: Invalid or expired token" }, { status: 401 });
      }

      // Attach user info to request (optional if you need it in handler)
      req.user = decoded;

      return handler(req, ...args);
    } catch (error) {
      return NextResponse.json({ message: "Authentication error" }, { status: 500 });
    }
  };
};

/**
 * Higher Order Function for Role-based protection
 */
export const withRole = (handler, allowedRoles) => {
  return withAuth(async (req, ...args) => {
    // Admin role bypasses all permission checks
    if (req.user.role === "Admin" || (allowedRoles && allowedRoles.includes(req.user.role))) {
      return handler(req, ...args);
    }

    return NextResponse.json({ message: "Forbidden: You do not have permission" }, { status: 403 });
  });
};

/**
 * Higher Order Function for granular module:action permission checks
 * Admin role always bypasses. Non-admins must have the specific permission or "*".
 */
export const withPermission = (handler, permission) => {
  return withAuth(async (req, ...args) => {
    if (req.user.role === "Admin") return handler(req, ...args);
    try {
      await dbConnect();
      const userWithRole = await User.findById(req.user.id)
        .populate("role")
        .populate("projects.role")
        .select("role projects");
        
      let perms = userWithRole?.role?.permissions || [];
      
      // If global perms don't cover it, check project-specific perms if applicable
      if (!perms.includes("*") && !perms.includes(permission)) {
        const url = req.nextUrl.pathname;
        const projectMatch = url.match(/\/api\/projects\/([^\/]+)/);
        if (projectMatch && projectMatch[1]) {
           const projectId = projectMatch[1];
           const projectAssignment = userWithRole.projects?.find(p => p.project.toString() === projectId);
           if (projectAssignment && projectAssignment.role) {
             const projPerms = projectAssignment.role.permissions || [];
             perms = [...perms, ...projPerms];
             if (projectAssignment.role.name === "Admin" || projectAssignment.role.isSystemRole) {
               perms.push("*");
             }
           }
        }
      }

      if (!perms.includes("*") && !perms.includes(permission)) {
        return NextResponse.json({ message: "Forbidden: Insufficient permissions" }, { status: 403 });
      }
      return handler(req, ...args);
    } catch (error) {
      console.log('Permission Check Error:', error);
      return NextResponse.json({ message: "Permission check error" }, { status: 500 });
    }
  });
};

/**
 * Feature-gate a route by subscription plan.
 * usage: export const POST = withSubscription(handler, "boq_import")
 *
 * Suspended orgs are blocked regardless of feature.
 * Trial orgs get access during the trial window.
 */
export const withSubscription = (handler, feature) => {
  return withAuth(async (req, ...args) => {
    try {
      await dbConnect();
      const org = await Organization.findById(req.user.organizationId).select("subscription");
      const sub = org?.subscription
        ? await Subscription.findById(org.subscription)
        : null;

      // No subscription record yet — allow (grace period for existing orgs)
      if (!sub) return handler(req, ...args);

      // Suspended org — full block
      if (sub.status === "Suspended") {
        return NextResponse.json(
          { message: "Your organization account is suspended. Please contact support.", code: "ORG_SUSPENDED" },
          { status: 403 }
        );
      }

      // Expired trial
      if (sub.status === "Trial" && sub.trialEndsAt && new Date() > sub.trialEndsAt) {
        return NextResponse.json(
          { message: "Your free trial has expired. Please upgrade to continue.", code: "TRIAL_EXPIRED" },
          { status: 403 }
        );
      }

      // Feature check (skip if no specific feature required)
      if (feature && !sub.limits.features.includes(feature)) {
        const planRequired = feature === "arabic" ? "Platinum" : "Gold or Platinum";
        return NextResponse.json(
          {
            message: `This feature requires a ${planRequired} plan. Contact your administrator to upgrade.`,
            code: "PLAN_UPGRADE_REQUIRED",
            requiredFeature: feature,
            currentPlan: sub.plan,
          },
          { status: 403 }
        );
      }

      // Attach subscription to request for limit checks inside handlers
      req.subscription = sub;
      return handler(req, ...args);
    } catch (error) {
      return NextResponse.json({ message: "Subscription check error" }, { status: 500 });
    }
  });
};
