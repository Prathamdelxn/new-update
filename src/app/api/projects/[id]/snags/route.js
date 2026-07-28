import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Snag from "@/models/Snag";
import Project from "@/models/Project";
import User from "@/models/User";
import { withAuth } from "@/lib/middleware";
import { recordAudit } from "@/lib/auditHelper";
import { sendEmail } from "@/lib/email";
import { snagAssignedEmail } from "@/lib/emailTemplates";
import { emitToProject } from "@/lib/socket-server";
import RiskEngine from "@/lib/riskEngine";

export const GET = withAuth(async function (req, { params }) {
  try {
    const { id } = await params;
    await dbConnect();

    const snags = await Snag.find({ project: id })
      .populate('createdBy', 'name email __enc_name')
      .populate('assignedTo', 'name email __enc_name')
      .sort({ createdAt: -1 });

    return NextResponse.json(snags);
  } catch (error) {
    console.error("Fetch snags error:", error);
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
});

export const POST = withAuth(async function (req, { params }) {
  try {
    const { id } = await params;
    const body = await req.json();
    
    await dbConnect();

    const newSnag = await Snag.create({
      ...body,
      project: id,
      organization: req.user.organizationId,
      createdBy: req.user.id,
      status: body.status || "Draft"
    });

    // Record audit trail in project
    const project = await Project.findById(id);
    if (project) {
      await recordAudit(project, req.user, "SnagAdded", `Snag reported: ${body.title}`);
    }

    // Auto-generate Risk if High/Critical
    if (body.priority === 'High' || body.priority === 'Critical') {
      await RiskEngine.evaluateAndCreateRisk({
        projectId: id,
        organizationId: req.user.organizationId,
        user: req.user,
        sourceType: 'Snag',
        sourceId: newSnag._id,
        sourceName: body.title,
        title: `Snag Risk: ${body.title}`,
        category: 'Technical',
        description: `Auto-generated risk from a ${body.priority} priority snag: ${body.description || body.title}`,
        impact: body.priority === 'Critical' ? 'Very High' : 'High',
        probability: 'High'
      }).catch(err => console.error("Risk auto-gen failed for snag:", err));
    }

    // Email the assigned user (if any)
    if (body.assignedTo) {
      // Email sending disabled per user request
    }

    emitToProject(id, 'snag:created', { snagId: newSnag._id.toString() });
    return NextResponse.json(newSnag, { status: 201 });
  } catch (error) {
    console.error("Create snag error:", error);
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
});
