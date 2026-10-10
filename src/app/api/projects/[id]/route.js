import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Project from "@/models/Project";
import { withAuth, withPermission } from "@/lib/middleware";
import { emitToProject } from "@/lib/socket-server";
import Role from "@/models/Role";
import User from "@/models/User";
import SiteSurvey from "@/models/SiteSurvey";
import Snag from "@/models/Snag";
import Customer from "@/models/Customer";
import Activity from "@/models/Activity";
import { hasPermission } from "@/lib/permissions";

// Duplicated per-file, matching this codebase's convention (no shared
// permission helpers across API route files).
async function userHasPermission(req, projectId, permission) {
  if (req.user.role === "Admin") return true;
  const userWithRole = await User.findById(req.user.id)
    .populate("role")
    .populate("projects.role")
    .select("role projects");
  let perms = userWithRole?.role?.permissions || [];
  if (!hasPermission(perms, permission)) {
    const projectAssignment = userWithRole.projects?.find((p) => p.project?.toString() === projectId);
    if (projectAssignment?.role) {
      const projPerms = projectAssignment.role.permissions || [];
      perms = [...perms, ...projPerms];
      if (projectAssignment.role.name === "Admin" || projectAssignment.role.isSystemRole) {
        perms.push("*");
      }
    }
  }
  return hasPermission(perms, permission);
}

// GET a single project
export const GET = withPermission(async function (req, { params }) {
  try {
    const { id } = await params;
    await dbConnect();
    const project = await Project.findOne({ _id: id, organization: req.user.organizationId })
      .populate({ path: "createdBy", select: "+__enc_name +__enc_phoneNumber", populate: { path: "role" } })
      .populate({ path: "members.user", select: "+__enc_name +__enc_phoneNumber", populate: { path: "role" } })
      .populate({ path: "members.role" })
      .populate({ path: "siteSurveyor", select: "+__enc_name +__enc_phoneNumber", populate: { path: "role" } })
      .populate({ path: "snaggedBy", select: "+__enc_name +__enc_phoneNumber", populate: { path: "role" } })
      .populate({ path: "handoverApprover", select: "+__enc_name +__enc_phoneNumber", populate: { path: "role" } });

    if (!project) {
      return NextResponse.json({ message: "Project not found" }, { status: 404 });
    }

    const survey = await SiteSurvey.findOne({ project: id }, { status: 1, rejectionReason: 1 });
    const projectObj = project.toObject();
    projectObj.surveyStatus = survey ? survey.status : null;
    projectObj.surveyRejectionReason = survey ? survey.rejectionReason : null;

    return NextResponse.json(projectObj);
  } catch (error) {
    return NextResponse.json({ message: "Error fetching project" }, { status: 500 });
  }
}, "projects:view");

// UPDATE a project (Full)
export const PUT = withPermission(async function (req, { params }) {
  try {
    const { id } = await params;
    await dbConnect();
    const body = await req.json();
    const { name, description, clientName, clientEmail, clientPhone, status, priority, members, startDate, endDate, documents, updatedBy, needSiteSurvey, siteSurveyor, newBudget, budgetReason, area, areaUnit, currency } = body;

    const project = await Project.findOne({ _id: id, organization: req.user.organizationId });
    if (!project) {
      return NextResponse.json({ message: "Project not found" }, { status: 404 });
    }

    // Update fields
    if (name) project.name = name;
    if (description) project.description = description;
    if (clientName) project.clientName = clientName;
    if (clientEmail) project.clientEmail = clientEmail;
    if (clientPhone) project.clientPhone = clientPhone;
    if (status) project.status = status;
    if (priority) project.priority = priority;
    if (members) project.members = members;
    if (startDate) project.startDate = startDate;
    if (endDate) project.endDate = endDate;
    if (documents) project.documents = documents;
    if (updatedBy) project.updatedBy = updatedBy;
    if (needSiteSurvey !== undefined) project.needSiteSurvey = needSiteSurvey;
    if (siteSurveyor !== undefined) project.siteSurveyor = siteSurveyor;
    if (siteSurveyor !== undefined) project.siteSurveyor = siteSurveyor;
    if (area !== undefined) project.area = area ? Number(area) : null;
    if (areaUnit) project.areaUnit = areaUnit;
    if (currency) project.currency = currency;

    // --- BUDGET VERSIONING LOGIC ---
    if (newBudget && budgetReason) {
      project.budgetHistory.push({
        amount: Number(newBudget),
        reason: budgetReason,
        approvalStatus: "Approved",
        updatedBy: req.user.id || updatedBy,
        updatedByName: req.user.name || "Manager",
        timestamp: new Date()
      });

      project.auditTrail.push({
        user: req.user.id || updatedBy,
        userName: req.user.name || "User",
        userRole: req.user.role || "Member",
        action: "Update",
        details: `Budget updated to ${newBudget}. Reason: ${budgetReason}`,
      });
    } else {
      project.auditTrail.push({
        user: req.user.id || updatedBy || project.createdBy,
        userName: req.user.name || "User",
        userRole: req.user.role || "Member",
        action: "Update",
        details: "Project details updated",
      });
    }

    await project.save();
    emitToProject(id, 'project:updated');
    return NextResponse.json(project);
  } catch (error) {
    console.error("Error updating project:", error);
    return NextResponse.json({ message: "Error updating project", error: error.message }, { status: 500 });
  }
}, "projects:update");

// PARTIAL UPDATE a project
const PROJECT_EDIT_FIELDS = [
  "name", "description", "clientName", "clientEmail", "clientPhone",
  "startDate", "endDate", "priority", "currency", "area", "areaUnit",
  "needSiteSurvey", "siteLocation", "attendanceRadius", "projectType", "budget",
];

export const PATCH = withAuth(async function (req, { params }) {
  try {
    const { id } = await params;
    await dbConnect();
    const body = await req.json();
    const { auditAction, auditDetails, ...updateData } = body;

    // This PATCH endpoint is shared by the real "edit project" form and many
    // unrelated workflow status-update calls (handover approval, snag status
    // changes, budget actions, survey assignment), each requiring different
    // permissions — it can't be blanket-gated. Only check "projects:update"
    // when the request actually carries project-edit fields, and separately
    // require "sitesurvey:assign" when it's assigning a site surveyor.
    const isProjectEdit = PROJECT_EDIT_FIELDS.some((f) => Object.prototype.hasOwnProperty.call(updateData, f));
    if (isProjectEdit && !(await userHasPermission(req, id, "projects:update"))) {
      return NextResponse.json({ message: "Forbidden: Insufficient permissions" }, { status: 403 });
    }
    if (
      Object.prototype.hasOwnProperty.call(updateData, "siteSurveyor") &&
      !(await userHasPermission(req, id, "sitesurvey:assign"))
    ) {
      return NextResponse.json({ message: "Forbidden: No site survey assignment permission" }, { status: 403 });
    }
    // Changing who is on the project is the "assign" action
    if (
      ["members", "assignedTo"].some((f) => Object.prototype.hasOwnProperty.call(updateData, f)) &&
      !(await userHasPermission(req, id, "projects:assign"))
    ) {
      return NextResponse.json({ message: "Forbidden: No permission to assign project members" }, { status: 403 });
    }

    const project = await Project.findOne({ _id: id, organization: req.user.organizationId });
    if (!project) {
      return NextResponse.json({ message: "Project not found" }, { status: 404 });
    }

    // Starting the snagging phase by hand: only from Ongoing, needs Project Management > Update
    if (updateData.status === "Under Snagging" && project.status !== "Under Snagging") {
      if (project.status !== "Ongoing") {
        return NextResponse.json({ message: "Snagging can only be started while the project is Ongoing" }, { status: 400 });
      }
      if (!(await userHasPermission(req, id, "projects:update"))) {
        return NextResponse.json({ message: "Forbidden: No permission to start the snagging phase" }, { status: 403 });
      }
    }

    // Handover workflow (Handover Management permissions):
    // requesting a handover = create, choosing its approver = assign,
    // approving/rejecting a pending handover = approve.
    const forbidden = (message) => NextResponse.json({ message: `Forbidden: ${message}` }, { status: 403 });
    // (approving re-sends the current approver, so only a *new* approver counts)
    if (updateData.handoverApprover && String(updateData.handoverApprover) !== String(project.handoverApprover || "")) {
      if (!(await userHasPermission(req, id, "handover:create"))) return forbidden("No permission to request a handover");
      if (!(await userHasPermission(req, id, "handover:assign"))) return forbidden("No permission to assign a handover approver");
    }
    if (project.status === "Pending Handover" && ["Completed", "Handover Rejected"].includes(updateData.status)) {
      if (!(await userHasPermission(req, id, "handover:approve"))) return forbidden("No permission to approve or reject handovers");
    }
    if (project.status === "Handover Rejected" && updateData.status === "Ongoing" && updateData.handoverApprover === null) {
      if (!(await userHasPermission(req, id, "handover:create"))) return forbidden("No permission to restart the handover");
    }

    // Apply partial updates
    Object.keys(updateData).forEach(key => {
      if (updateData[key] !== undefined) {
        if (key === 'budget') {
          const numB = Number(updateData[key]);
          if (!isNaN(numB)) {
            project.budget = numB;
            if (!project.budgetHistory) {
              project.budgetHistory = [];
            }
            const lastHistory = project.budgetHistory.length > 0
              ? project.budgetHistory[project.budgetHistory.length - 1]
              : null;
            if (!lastHistory || lastHistory.amount !== numB) {
              project.budgetHistory.push({
                amount: numB,
                reason: "Budget updated via project details edit",
                approvalStatus: "Approved",
                updatedBy: req.user.id,
                updatedByName: req.user.name || "User",
                timestamp: new Date()
              });
            }
          }
        } else {
          project[key] = updateData[key];
        }
      }
    });

    // Handle Audit Trail if specified
    if (auditAction && auditDetails) {
      project.auditTrail.push({
        user: req.user.id,
        userName: req.user.name || "User",
        userRole: req.user.role || "Member",
        action: auditAction,
        details: auditDetails,
        timestamp: new Date()
      });
    } else {
      project.auditTrail.push({
        user: req.user.id,
        userName: req.user.name || "User",
        userRole: req.user.role || "Member",
        action: "Update",
        details: "Partial project update",
        timestamp: new Date()
      });
    }

    await project.save();
    emitToProject(id, 'project:updated');
    return NextResponse.json(project);
  } catch (error) {
    return NextResponse.json({ message: "Error updating project" }, { status: 500 });
  }
});

// DELETE a project
export const DELETE = withPermission(async function (req, { params }) {
  try {
    const { id } = await params;
    await dbConnect();
    const project = await Project.findOneAndDelete({ _id: id, organization: req.user.organizationId });

    if (!project) {
      return NextResponse.json({ message: "Project not found" }, { status: 404 });
    }

    // Unlock any CRM Lead / Customer linked to this project
    const linkedCustomers = await Customer.find({
      organization: req.user.organizationId,
      linkedProject: id,
    });

    for (const customer of linkedCustomers) {
      customer.linkedProject = undefined;
      // Revert status to pre-conversion
      if (customer.status === 'Won' || customer.status === 'Converted') {
        const hasAcceptedQuote = customer.quotations?.some((q) => q.status === 'Accepted');
        customer.status = hasAcceptedQuote
          ? 'Booking Pending'
          : (customer.quotations && customer.quotations.length > 0
            ? 'Under Quotation'
            : (customer.boqs && customer.boqs.length > 0
              ? 'Under BOQ Creation'
              : (customer.designFiles && customer.designFiles.length > 0
                ? 'Under Drawing'
                : 'Under Requirement')));
      }
      await customer.save();

      // Log Activity
      try {
        await Activity.create({
          organization: req.user.organizationId,
          customer: customer._id,
          user: req.user.id,
          type: 'Status Change',
          status: 'Completed',
          remarks: `Linked Project "${project.name}" was deleted. Lead is now unlocked for editing.`,
        });
      } catch (actErr) {
        console.warn('Failed to log Activity on project delete:', actErr);
      }
    }

    return NextResponse.json({ message: "Project deleted successfully and linked lead unlocked" });
  } catch (error) {
    return NextResponse.json({ message: "Error deleting project" }, { status: 500 });
  }
}, "projects:delete");
