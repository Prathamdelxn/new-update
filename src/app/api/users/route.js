import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import User from "@/models/User";
import { withAuth, withRole } from "@/lib/middleware";
import { sendEmail } from "@/lib/email";
import { welcomeEmail } from "@/lib/emailTemplates";
import Role from "@/models/Role";
import Project from "@/models/Project";
/**
 * GET: Fetch all users (for member registry)
 */
export const GET = withAuth(async function (req) {
  try {
    await dbConnect();
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");
    const permission = searchParams.get("permission");

    const query = { organization: req.user.organizationId };
    
    let users = await User.find(query)
      .populate("role", "name permissions")
      .populate("projects.project", "name")
      .populate("projects.role", "name permissions")
      .select("-password");
  
    // Filter logic: Include if (in project) OR (is Admin with '*' perm)
    if (projectId) {
      users = users.filter(u => 
        (u.projects && u.projects.some(p => p.project && p.project._id.toString() === projectId)) ||
        (u.role && u.role.permissions.includes("*"))
      );
    }
 
    // Secondary filter by specific permission if requested
    if (permission) {
      users = users.filter(u => {
        // Global admin check
        if (u.role && (u.role.permissions.includes("*") || u.role.permissions.some(p => p.startsWith(`${permission}:`)) || u.role.permissions.includes(permission))) {
          return true;
        }
        // Project role check
        if (projectId && u.projects) {
          const userProject = u.projects.find(p => p.project && p.project._id.toString() === projectId);
          if (userProject && userProject.role) {
             const projRole = userProject.role;
             const hasPerm = projRole.permissions && (projRole.permissions.includes("*") || projRole.permissions.some(p => p.startsWith(`${permission}:`)) || projRole.permissions.includes(permission));
             console.log(`Checking project role permissions for user ${u.email}:`, projRole.permissions, `hasPerm:`, hasPerm);
             if (hasPerm) {
                 return true;
             }
          }
        }
        return false;
      });
    }
     

    return NextResponse.json(users);
  } catch (error) {
    console.error("Fetch users error:", error);
    return NextResponse.json(
      { message: "Error fetching team members" },
      { status: 500 }
    );
  }
});

/**
 * POST: Onboard a new team member
 */
export const POST = withRole(async function (req) {
  try {
    await dbConnect();
    const { name, email, phoneNumber, roleId, projectIds, projects, password } = await req.json();

    // Check if user already exists with email
    const existingEmail = await User.findOne({ email });
    if (existingEmail) {
      return NextResponse.json({ message: "User already exists with this email" }, { status: 400 });
    }

    // Check if phone number is already taken
    if (phoneNumber) {
      const existingPhone = await User.findOne({ phoneNumber });
      if (existingPhone) {
        return NextResponse.json({ message: "Phone number is already assigned to another member" }, { status: 400 });
      }
    }

    // Create new user — use provided password or fall back to default
    const newUser = new User({
      name,
      email,
      phoneNumber,
      role: roleId || undefined,
      projects: projects || (projectIds ? projectIds.map(id => ({ project: id })) : []),
      password: password || "welcome123",
      status: "Active",
      organization: req.user.organizationId,
    });

    // Add audit entry
    newUser.auditTrail.push({
      user: req.user.id,
      userName: req.user.name || "Admin",
      userRole: req.user.role || "Admin",
      action: "Create",
      details: `New member ${name} onboarded by ${req.user.name}`,
    });

    await newUser.save();

    // Return the created user (without password)
    const result = await User.findById(newUser._id)
      .populate("role", "name")
      .populate("projects", "name");

    // Send welcome email with credentials (fire-and-forget)
    const plainPassword = password || "welcome123";
    sendEmail({
      to: email,
      subject: "Welcome to Skystruct — Your Login Credentials",
      html: welcomeEmail({
        name,
        email,
        password: plainPassword,
        role: result.role?.name || "Team Member",
        projects: (result.projects || []).map(p => p.project?.name).filter(Boolean),
      }),
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error("Onboarding error:", error);
    
    // Check if it's a Mongoose validation error
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map(err => err.message);
      return NextResponse.json(
        { message: messages.join(", ") },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { message: "Error onboarding new member" },
      { status: 500 }
    );
  }
}, ["Admin"]);
