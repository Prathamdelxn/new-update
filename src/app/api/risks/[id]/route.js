import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Risk from "@/models/Risk";
import Project from "@/models/Project";
import { withAuth } from "@/lib/middleware";
import { recordAudit } from "@/lib/auditHelper";

export const PATCH = withAuth(async function (req, { params }) {
  try {
    const { id } =await params;
    const body = await req.json();
    await dbConnect();

    const existingRisk = await Risk.findOne({ _id: id, organization: req.user.organizationId });
    if (!existingRisk) return NextResponse.json({ message: "Risk not found" }, { status: 404 });

    const updateData = { ...body };
    
    // Track history if status or progress changes
    if (body.status || body.mitigationProgress !== undefined || body.note) {
      existingRisk.history.push({
        updatedBy: req.user.id,
        note: body.note || "Standard update",
        oldStatus: existingRisk.status,
        newStatus: body.status || existingRisk.status,
        timestamp: new Date()
      });
      updateData.history = existingRisk.history;
    }

    const updatedRisk = await Risk.findByIdAndUpdate(id, updateData, { new: true });

    // Record internal audit log
    if (body.status) {
      await recordAudit(updatedRisk, req.user, "StatusChange", `Status changed to ${body.status}`);
    } else if (body.mitigationProgress !== undefined) {
      await recordAudit(updatedRisk, req.user, "MitigationUpdate", `Progress updated to ${body.mitigationProgress}%`);
    } else {
      await recordAudit(updatedRisk, req.user, "Update", "Risk details modified");
    }

    // Record audit trail in project
    const project = await Project.findById(updatedRisk.project);
    if (project) {
      const detail = body.status ? `Risk status updated to ${body.status}: ${updatedRisk.title}` : `Risk mitigation updated for: ${updatedRisk.title}`;
      await recordAudit(project, req.user, "RiskUpdated", detail);
    }

    return NextResponse.json(updatedRisk);
  } catch (error) {
    console.error("Update risk error:", error);
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
});

export const DELETE = withAuth(async function (req, { params }) {
  try {
    const { id } =await params;
    await dbConnect();

    const risk = await Risk.findOne({ _id: id, organization: req.user.organizationId });
    if (!risk) return NextResponse.json({ message: "Risk not found" }, { status: 404 });

    // Only Admin, SuperAdmin or Owner can delete
    const isOwner = String(risk.owner) === String(req.user.id);
    const isAdmin = req.user.role === 'Admin' || req.user.role === 'SuperAdmin';

    if (!isAdmin && !isOwner) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    const projectId = risk.project;
    const riskTitle = risk.title;
    await Risk.findByIdAndDelete(id);

    // Record audit trail in project
    const project = await Project.findById(projectId);
    if (project) {
      await recordAudit(project, req.user, "RiskDeleted", `Risk removed: ${riskTitle}`);
    }

    return NextResponse.json({ message: "Risk deleted successfully" });
  } catch (error) {
    console.error("Delete risk error:", error);
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
});
