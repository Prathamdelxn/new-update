import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Snag from "@/models/Snag";
import Project from "@/models/Project";
import User from "@/models/User";
import { withAuth } from "@/lib/middleware";
import { recordAudit } from "@/lib/auditHelper";
import { sendEmail } from "@/lib/email";
import { snagAssignedEmail, snagStatusEmail } from "@/lib/emailTemplates";

export const GET = withAuth(async function (req, { params }) {
  try {
    const { id } = await params;
    await dbConnect();

    const snag = await Snag.findOne({ _id: id, organization: req.user.organizationId })
      .populate("createdBy", "name email __enc_name")
      .populate("assignedTo", "name email __enc_name")
      .populate("history.updatedBy", "name __enc_name");

    if (!snag) {
      return NextResponse.json({ message: "Snag not found" }, { status: 404 });
    }

    return NextResponse.json(snag);
  } catch (error) {
    console.error("Fetch snag error:", error);
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
});

export const PATCH = withAuth(async function (req, { params }) {
  try {
    const { id } = await params;
    const body = await req.json();
    await dbConnect();

    const snag = await Snag.findOne({ _id: id, organization: req.user.organizationId });
    if (!snag) {
      return NextResponse.json({ message: "Snag not found" }, { status: 404 });
    }

    // Update snag
    const updatedSnag = await Snag.findByIdAndUpdate(
      id,
      { 
        $set: body,
        $push: {
          history: {
            updatedBy: req.user.id,
            action: body.status ? "StatusUpdated" : "DetailsUpdated",
            details: body.note || `Snag updated: ${JSON.stringify(body)}`,
            timestamp: new Date()
          }
        }
      },
      { new: true }
    );

    // Record audit trail in project
    const project = await Project.findById(snag.project);
    if (project) {
      await recordAudit(project, req.user, "SnagUpdated", `Snag ${snag.title} updated to ${body.status || 'new details'}`);
    }

    // Email new assignee if assignment changed
    const newAssigneeId = body.assignedTo;
    const assigneeChanged = newAssigneeId && newAssigneeId !== snag.assignedTo?.toString();
    // Email sending disabled per user request

    // Email existing assignee on status change
    if (body.status && body.status !== snag.status && snag.assignedTo && !assigneeChanged) {
      // Email sending disabled per user request
    }

    return NextResponse.json(updatedSnag);
  } catch (error) {
    console.error("Update snag error:", error);
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
});

export const DELETE = withAuth(async function (req, { params }) {
  try {
    const { id } = await params;
    await dbConnect();

    const snag = await Snag.findOne({ _id: id, organization: req.user.organizationId });
    if (!snag) {
      return NextResponse.json({ message: "Snag not found" }, { status: 404 });
    }

    await Snag.findByIdAndDelete(id);

    // Record audit trail
    const project = await Project.findById(snag.project);
    if (project) {
      await recordAudit(project, req.user, "SnagDeleted", `Snag removed: ${snag.title}`);
    }

    return NextResponse.json({ message: "Snag deleted successfully" });
  } catch (error) {
    console.error("Delete snag error:", error);
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
});
