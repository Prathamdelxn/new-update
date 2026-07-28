import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Role from "@/models/Role";
import { withAuth, withRole } from "@/lib/middleware";

/**
 * GET: Fetch a single role
 */
export const GET = withAuth(async function (req, { params }) {
  try {
    const { id } = await params;
    await dbConnect();
    const role = await Role.findOne({ _id: id, organization: req.user.organizationId });
    if (!role) {
      return NextResponse.json({ message: "Role not found" }, { status: 404 });
    }
    return NextResponse.json(role);
  } catch (error) {
    return NextResponse.json({ message: "Error fetching role" }, { status: 500 });
  }
});

import User from "@/models/User";

/**
 * PATCH: Update role permissions/details
 */
export const PATCH = withRole(async function (req, { params }) {
  try {
    const { id } = await params;
    await dbConnect();
    
    const { name, permissions, description } = await req.json();

    const role = await Role.findOne({ _id: id, organization: req.user.organizationId });
    if (!role) {
      return NextResponse.json({ message: "Role not found" }, { status: 404 });
    }

    // Protection: Block editing of core system Admin role
    if (role.name === "Admin" || role.isSystemRole) {
       return NextResponse.json({ message: "Forbidden: System roles cannot be modified" }, { status: 403 });
    }

    // Update fields
    let action = "PermissionChange";
    if (name || description) action = "Update";

    if (name) role.name = name;
    if (description) role.description = description;
    if (permissions) role.permissions = permissions;

    // Add audit entry
    role.auditTrail.push({
      user: req.user.id,
      userName: req.user.name || "Admin",
      userRole: req.user.role || "Admin",
      action: action,
      details: `Role ${action} via Role Manager`,
    });

    await role.save();

    return NextResponse.json(role);
  } catch (error) {
    return NextResponse.json({ message: "Error updating role" }, { status: 500 });
  }
}, ["Admin"]);

/**
 * DELETE: Remove role and all associated members (Cascade)
 */
export const DELETE = withRole(async function (req, { params }) {
  try {
    const { id } = await params;
    await dbConnect();

    const role = await Role.findOne({ _id: id, organization: req.user.organizationId });
    if (!role) {
      return NextResponse.json({ message: "Role not found" }, { status: 404 });
    }

    // Security: Never delete the master Admin role
    if (role.name === "Admin" || role.isSystemRole) {
      return NextResponse.json({ message: "Forbidden: Global Administrator roles cannot be deleted" }, { status: 403 });
    }

    // CASCADE DELETE: Remove all users assigned to this role
    const deletedUsers = await User.deleteMany({ role: id, organization: req.user.organizationId });

    // Delete the role itself
    await Role.findByIdAndDelete(id);

    return NextResponse.json({ 
      message: `Role and ${deletedUsers.deletedCount} members removed successfully` 
    });
  } catch (error) {
    return NextResponse.json({ message: "Error removing role" }, { status: 500 });
  }
}, ["Admin"]);
