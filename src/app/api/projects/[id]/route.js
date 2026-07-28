import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Project from "@/models/Project";
import { withAuth } from "@/lib/middleware";
import { emitToProject } from "@/lib/socket-server";
import Role from "@/models/Role";
import User from "@/models/User";
import SiteSurvey from "@/models/SiteSurvey";
import Snag from "@/models/Snag";
// GET a single project
export const GET = withAuth(async function (req, { params }) {
  try {
    const { id } = await params;
    await dbConnect();
    console.log("id", id)
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

    return NextResponse.json(project);
  } catch (error) {
    return NextResponse.json({ message: "Error fetching project" }, { status: 500 });
  }
});

// UPDATE a project (Full)
export const PUT = withAuth(async function (req, { params }) {
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
});

// PARTIAL UPDATE a project
export const PATCH = withAuth(async function (req, { params }) {
  try {
    const { id } = await params;
    await dbConnect();
    const body = await req.json();
    const { auditAction, auditDetails, ...updateData } = body;

    const project = await Project.findOne({ _id: id, organization: req.user.organizationId });
    if (!project) {
      return NextResponse.json({ message: "Project not found" }, { status: 404 });
    }

    // Apply partial updates
    Object.keys(updateData).forEach(key => {
      if (updateData[key] !== undefined) {
        project[key] = updateData[key];
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
export const DELETE = withAuth(async function (req, { params }) {
  try {
    const { id } = await params;
    await dbConnect();
    const project = await Project.findOneAndDelete({ _id: id, organization: req.user.organizationId });

    if (!project) {
      return NextResponse.json({ message: "Project not found" }, { status: 404 });
    }

    return NextResponse.json({ message: "Project deleted successfully" });
  } catch (error) {
    return NextResponse.json({ message: "Error deleting project" }, { status: 500 });
  }
});
