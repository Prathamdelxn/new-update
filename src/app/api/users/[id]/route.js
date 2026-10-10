import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import User from "@/models/User";
import { withAuth, withPermission } from "@/lib/middleware";
import { userHasProjectPermission, payloadAssignsPrivilegedRole, isFullAccessRole } from "@/lib/permissions";
import Role from "@/models/Role";
import Project from "@/models/Project";

/**
 * PATCH: Update team member
 */
export const PATCH = withAuth(async function (req, { params }) {
  try {
    const { id } = await params;
    await dbConnect();

    const body = await req.json();
    const { name, email, phoneNumber, roleId, projectIds, projects, status } = body;

    const user = await User.findOne({ _id: id, organization: req.user.organizationId }).populate("role", "name permissions isSystemRole");
    if (!user) {
      return NextResponse.json({ message: "User not found" }, { status: 404 });
    }

    const isAdmin = req.user.role === "Admin";
    const isSelf = id === req.user.id;
    // Anyone may edit their own name/phone (Profile page) — no permission needed
    const isOwnProfileEdit = isSelf && Object.keys(body).every((k) => ["name", "phoneNumber"].includes(k));
    if (!isAdmin && !isOwnProfileEdit) {
      if (!(await userHasProjectPermission(req, null, "users:update"))) {
        return NextResponse.json({ message: "Forbidden: Insufficient permissions" }, { status: 403 });
      }
      if (isSelf && (roleId !== undefined || projects || projectIds || status)) {
        return NextResponse.json({ message: "Forbidden: You cannot change your own role, projects or status" }, { status: 403 });
      }
      if (isFullAccessRole(user.role)) {
        return NextResponse.json({ message: "Forbidden: Only an Admin can modify an Admin user" }, { status: 403 });
      }
      if (await payloadAssignsPrivilegedRole({ roleId, projects }, req.user.organizationId)) {
        return NextResponse.json({ message: "Forbidden: Only an Admin can assign an Admin-level role" }, { status: 403 });
      }
    }

    // Check for email duplicates if email is being changed
    if (email && email !== user.email) {
      const existingEmail = await User.findOne({ email });
      if (existingEmail) {
        return NextResponse.json({ message: "Email is already assigned to another member" }, { status: 400 });
      }
    }

    // Check for phone duplicates if phoneNumber is being changed
    if (phoneNumber && phoneNumber !== user.phoneNumber) {
      const existingPhone = await User.findOne({ phoneNumber });
      if (existingPhone) {
        return NextResponse.json({ message: "Phone number is already assigned to another member" }, { status: 400 });
      }
    }

    // Update fields if provided
    if (name) user.name = name;
    if (email) user.email = email;
    if (phoneNumber) user.phoneNumber = phoneNumber;
    if (roleId !== undefined) user.role = roleId || undefined;
    if (projects || projectIds) {
      user.projects = projects || (projectIds ? projectIds.map(pid => ({ project: pid })) : []);
    }
    if (status) user.status = status;

    // Add audit entry
    user.auditTrail.push({
      user: req.user.id,
      userName: req.user.name || "Admin",
      userRole: req.user.role || "Admin",
      action: "Update",
      details: "Member details updated by Administrator",
    });

    await user.save();

    const updatedUser = await User.findById(id)
      .populate("role", "name")
      .populate("projects.project", "name")
      .populate("projects.role", "name");

    return NextResponse.json(updatedUser);
  } catch (error) {
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map(err => err.message);
      return NextResponse.json({ message: messages.join(", ") }, { status: 400 });
    }
    return NextResponse.json({ message: "Error updating member" }, { status: 500 });
  }
});

/**
 * DELETE: Remove team member
 */
export const DELETE = withPermission(async function (req, { params }) {
  try {
    const { id } = await params;
    await dbConnect();

    // Security: Prevent self-deletion
    if (id === req.user.id) {
      return NextResponse.json({ message: "Forbidden: You cannot delete your own Administrator account" }, { status: 403 });
    }

    const user = await User.findOne({ _id: id, organization: req.user.organizationId }).populate("role", "name permissions isSystemRole");
    if (!user) {
      return NextResponse.json({ message: "User not found" }, { status: 404 });
    }
    if (req.user.role !== "Admin" && isFullAccessRole(user.role)) {
      return NextResponse.json({ message: "Forbidden: Only an Admin can remove an Admin user" }, { status: 403 });
    }

    // Capture logout/removal event for audit logging if needed
    // Since we are deleting, we could record this in a dedicated AuditLog collection,
    // but for now we'll just proceed with removal.

    await User.findByIdAndDelete(id);

    return NextResponse.json({ message: "Member removed successfully" });
  } catch (error) {
    return NextResponse.json({ message: "Error removing member" }, { status: 500 });
  }
}, "users:delete");
