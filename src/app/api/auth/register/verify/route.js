import { NextResponse } from "next/server";
import mongoose from "mongoose";
import dbConnect from "@/lib/db";
import User from "@/models/User";
import Role from "@/models/Role";
import Organization from "@/models/Organization";
import Subscription from "@/models/Subscription";
import OtpRegistration from "@/models/OtpRegistration";

export async function POST(req) {
  try {
    await dbConnect();
    const { email, otp } = await req.json();

    if (!email || !otp) {
      return NextResponse.json({ message: "Email and OTP are required" }, { status: 400 });
    }

    const lowerEmail = email.toLowerCase();

    // Find the OTP record
    const otpRecord = await OtpRegistration.findOne({ email: lowerEmail });

    if (!otpRecord) {
      return NextResponse.json({ message: "Invalid or expired OTP. Please register again." }, { status: 400 });
    }

    if (otpRecord.otp !== otp) {
      return NextResponse.json({ message: "Incorrect OTP" }, { status: 400 });
    }

    // Check if user already exists (double check)
    const userExists = await User.findOne({ email: lowerEmail });
    if (userExists) {
      return NextResponse.json({ message: "User already exists" }, { status: 400 });
    }

    const { name, password, phoneNumber } = otpRecord;

    // 1. Create Organization for this admin (placeholder owner, updated below)
    const org = await Organization.create({
      name: `${name}'s Workspace`,
      owner: new mongoose.Types.ObjectId(),
    });

    // 2. Create Admin Role scoped to this organization
    const adminRole = await Role.create({
      name: "Admin",
      permissions: ["*"],
      isSystemRole: true,
      organization: org._id,
    });

    const defaultRoles = [
      {
        name: "Project Manager",
        permissions: [
          "project:view", "project:create", "project:update",
          "team:view", "team:assign",
          "templates:view",
          "plans:view", "plans:create", "plans:update", "plans:approve", "plans:delete",
          "annotations:view", "annotations:update",
          "documents:view", "documents:create", "documents:update",
          "boq:view", "boq:create", "boq:update", "boq:import", "boq:approve", "boq:reject",
          "budget:view", "budget:request",
          "milestone:view", "milestone:create", "milestone:update", "milestone:assign", "milestone:complete",
          "workprogress:view", "workprogress:create",
          "materials:view", "material-request:view", "material-request:create", "material-request:approve",
          "risks:view", "risks:create", "risks:update","risks:delete", "risks:assign",
          "snags:view", "snags:create", "snags:update", "snags:close",
          "sitesurvey:view",
          "attendance:view", "attendance:report:view",
          "handover:view", "handover:request",
          "ffe:view", "ffe:create", "ffe:update",
          "rooms:view", "rooms:create", "rooms:update",
          "reports:view", "chat:message"
        ],
        isSystemRole: false,
        organization: org._id,
      },
      {
        name: "Finance Manager",
        permissions: [
          "project:view",
          "boq:view",
          "budget:view", "budget:request",
          "transactions:view", "transactions:create", "transactions:update",
          "materials:view",
          "material-purchase:view", "material-purchase:create", "material-purchase:update",
          "material-receipt:view", "material-receipt:create", "material-receipt:update",
          "material-usage:view",
          "reports:view",
          "chat:message"
        ],
        description: "Finance records and audits money. It does not approve the homeowner’s budget decisions by default.",
        isSystemRole: false,
        organization: org._id,
      },
      {
        name: "Homeowner",
        permissions: [
          "project:view",
          "plans:view", "documents:view",
          "boq:view",
          "milestone:view", "workprogress:view",
          "budget:view", "budget:approve", "budget:reject",
          "snags:view", "snags:create", "snags:close",
          "handover:view", "handover:approve", "handover:reject",
          "warranty:view", "warranty:create",
          "ffe:view",
          "reports:view",
          "chat:message"
        ],
        description: "The homeowner can approve/reject only budget requests explicitly sent to them for their assigned project.",
        isSystemRole: false,
        organization: org._id,
      },
      {
        name: "Site Supervisor",
        permissions: [
          "project:view",
          "plans:view", "documents:view",
          "annotations:view", "annotations:update",
          "milestone:view", "milestone:create", "milestone:update", "milestone:assign", "milestone:complete",
          "workprogress:view", "workprogress:create",
          "materials:view", "material-request:view", "material-request:create", "material-request:approve",
          "material-usage:view", "material-usage:create",
          "snags:view", "snags:create", "snags:update", "snags:resolve",
          "risks:view", "risks:create", "risks:update",
          "attendance:checkin", "attendance:checkout",
          "attendance:view", "attendance:manage", "attendance:report:view",
          "rooms:view", "rooms:update",
          "chat:message"
        ],
        description: "Labour-attendance manager: sees worker attendance, resolves late/absent/half-day corrections, assigns work, and manages daily site execution.",
        isSystemRole: false,
        organization: org._id,
      },
      {
        name: "Surveyor",
        permissions: [
          "project:view",
          "plans:view", "documents:view",
          "sitesurvey:view", "sitesurvey:create", "sitesurvey:update", "sitesurvey:submit",
          "budget:request",
          "attendance:checkin", "attendance:checkout",
          "chat:message"
        ],
        description: "Can submit findings and request a budget revision, but cannot approve the survey or the budget.",
        isSystemRole: false,
        organization: org._id,
      },
      {
        name: "Worker",
        permissions: [
          "project:view",
          "plans:view",
          "milestone:view", "milestone:complete",
          "workprogress:create",
          "materials:view", "material-usage:create",
          "snags:view", "snags:create",
          "attendance:checkin", "attendance:checkout",
          "chat:message"
        ],
        isSystemRole: false,
        organization: org._id,
      }
    ];

    await Role.insertMany(defaultRoles);

    // 3. Create user with org and role assigned
    // Password from OtpRegistration is already bcrypt-hashed (hashed at registration time).
    // Assign it directly then call unmarkModified so the User pre('save') hook skips re-hashing.
    const user = new User({
      name,
      email: lowerEmail,
      password,
      phoneNumber,
      role: adminRole._id,
      organization: org._id,
    });
    user.unmarkModified("password"); // Password is pre-hashed — prevent double hashing

    user.auditTrail.push({
      userName: name,
      userRole: "Admin",
      action: "Create",
      details: "Initial account registration via OTP — assigned Admin role",
    });

    await user.save();

    // 4. Update org owner to the real user _id
    org.owner = user._id;

    // 5. Auto-create a 14-day Silver trial subscription for the new org
    const sub = new Subscription({ organization: org._id });
    sub.applyPlanDefaults();
    sub.history.push({ plan: "Silver", status: "Trial", changedBy: "System", reason: "Account registration" });
    await sub.save();
    org.subscription = sub._id;

    await org.save();

    // 6. Delete OTP record
    await OtpRegistration.deleteOne({ email: lowerEmail });

    return NextResponse.json(
      {
        message: "Account created successfully",
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: adminRole.name,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("OTP verification error:", error);
    return NextResponse.json(
      { message: "Error verifying OTP" },
      { status: 500 }
    );
  }
}
