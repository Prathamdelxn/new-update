import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Project from "@/models/Project";
import Template from "@/models/Template";
import TemplateCategory from "@/models/TemplateCategory";
import User from "@/models/User";
import { withAuth } from "@/lib/middleware"; // trigger rebuild
import { hasPermission, isFullAccessRole } from "@/lib/permissions";

// Creating a project isn't scoped to an existing project, so Create counts
// from the user's global role OR any of their project roles. When it comes
// from a project role, returns that role so the creator can be enrolled on the
// new project with it (otherwise they couldn't see the project they created).
async function resolveCreateAccess(req) {
  if (req.user.role === "Admin") return { allowed: true, grantRole: null };
  const user = await User.findById(req.user.id)
    .populate("role", "name permissions isSystemRole")
    .populate("projects.role", "name permissions isSystemRole")
    .select("role projects");
  if (isFullAccessRole(user?.role) || hasPermission(user?.role?.permissions, "projects:create")) {
    return { allowed: true, grantRole: null };
  }
  const grant = (user?.projects || []).find(
    (p) => p.role && (isFullAccessRole(p.role) || hasPermission(p.role.permissions, "projects:create"))
  );
  return grant ? { allowed: true, grantRole: grant.role._id } : { allowed: false, grantRole: null };
}

export const POST = withAuth(async function (req) {
  try {
    await dbConnect();
    const access = await resolveCreateAccess(req);
    if (!access.allowed) {
      return NextResponse.json({ message: "Forbidden: Insufficient permissions" }, { status: 403 });
    }
    const data = await req.json();

    const {
      name,
      description,
      category,
      startDate,
      endDate,
      needSiteSurvey,
      projectType,
      budget,
      currency,
      areaUnit,
      area,
      documents,
      drawings,
      siteLocation,
      attendanceRadius,
      templateId,
      createdBy,
    } = data;

    if (!name) {
      return NextResponse.json({ message: "Project name is required" }, { status: 400 });
    }

    const numBudget = budget ? Number(budget) : undefined;
    const initialBudgetHistory = numBudget ? [{
      amount: numBudget,
      reason: "Initial Base Budget",
      approvalStatus: "Approved",
      updatedBy: req.user.id || createdBy,
      updatedByName: req.user.name || "System",
      timestamp: new Date()
    }] : [];

    const project = await Project.create({
      name,
      description,
      category,
      templateId,
      startDate,
      endDate,
      needSiteSurvey,
      projectType,
      budget: numBudget,
      budgetHistory: initialBudgetHistory,
      currency,
      areaUnit,
      area,
      documents,
      drawings,
      siteLocation,
      attendanceRadius,
      organization: req.user.organizationId,
      createdBy: req.user.id || createdBy,
      ...(access.grantRole ? { members: [{ user: req.user.id, role: access.grantRole }] } : {}),
    });

    if (access.grantRole) {
      await User.updateOne(
        { _id: req.user.id },
        { $push: { projects: { project: project._id, role: access.grantRole } } }
      );
    }

    return NextResponse.json(project, { status: 201 });

  } catch (error) {
    console.error("Create Project Error:", error);
    return NextResponse.json(
      { message: "Failed to create project", error: error.message },
      { status: 500 }
    );
  }
});

// Projects the user may view: all of them with a global projects:view (or
// Admin); otherwise only those where their project-level role grants view.
async function getViewFilter(req) {
  const filter = { organization: req.user.organizationId };
  if (req.user.role === "Admin") return filter;

  const user = await User.findById(req.user.id)
    .populate("role", "name permissions isSystemRole")
    .populate("projects.role", "name permissions isSystemRole")
    .select("role projects");

  if (isFullAccessRole(user?.role) || hasPermission(user?.role?.permissions, "projects:view")) {
    return filter;
  }

  const viewableIds = (user?.projects || [])
    .filter((p) => p.project && (isFullAccessRole(p.role) || hasPermission(p.role?.permissions, "projects:view")))
    .map((p) => p.project);
  return { ...filter, _id: { $in: viewableIds } };
}

export const GET = withAuth(async function (req) {
  try {
    await dbConnect();

    const projects = await Project.find(await getViewFilter(req))
      .populate('category', 'name')
      .populate({
        path: 'templateId',
        select: 'name category',
        populate: { path: 'category', select: 'name' }
      })
      .populate('customer', 'name email mobileNumber propertyType')
      .populate('assignedTo', 'name')
      // Member role permissions let the web show per-project actions (edit/delete)
      .populate('members.role', 'name permissions isSystemRole')
      .sort({ createdAt: -1 });

    // Decrypt populated customer fields if using encryption
    projects.forEach(proj => {
      if (proj.customer && typeof proj.customer.decryptFieldsSync === 'function') {
        proj.customer.decryptFieldsSync();
      }
      if (proj.assignedTo && Array.isArray(proj.assignedTo)) {
        proj.assignedTo.forEach(user => {
          if (user && typeof user.decryptFieldsSync === 'function') {
            user.decryptFieldsSync();
          }
        });
      }
    });

    return NextResponse.json(projects, { status: 200 });

  } catch (error) {
    console.error("Fetch Projects Error:", error);
    return NextResponse.json(
      { message: "Failed to fetch projects" },
      { status: 500 }
    );
  }
});
