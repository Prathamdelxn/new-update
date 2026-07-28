import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Role from "@/models/Role";
import User from "@/models/User";
import { withAuth, withRole } from "@/lib/middleware";

export const GET = withAuth(async function (req) {
  try {
    await dbConnect();

    // Fetch roles and user counts in parallel for performance
    const [roles, users] = await Promise.all([
      Role.find({ organization: req.user.organizationId }),
      User.find({ organization: req.user.organizationId }, "role"),
    ]);

    // Calculate counts
    const roleStats = roles.map(role => {
      const userCount = users.filter(u => u.role?.toString() === role._id.toString()).length;
      return {
        ...role.toObject(),
        userCount
      };
    });

    return NextResponse.json(roleStats);
  } catch (error) {
    return NextResponse.json({ message: "Error fetching roles" }, { status: 500 });
  }
});

export const POST = withRole(async function (req) {
  try {
    await dbConnect();
    const { name, permissions, description } = await req.json();

    const role = new Role({
      name,
      permissions,
      description,
      organization: req.user.organizationId,
    });

    // Add audit entry using the auth user info
    role.auditTrail.push({
      user: req.user.id,
      userName: req.user.name || "Admin",
      userRole: req.user.role || "Admin",
      action: "Create",
      details: `Role ${name} created`,
    });

    await role.save();

    return NextResponse.json(role, { status: 201 });
  } catch (error) {
    return NextResponse.json({ message: "Error creating role" }, { status: 500 });
  }
}, ["Admin"]);

