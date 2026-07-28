import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Project from "@/models/Project";
import User from "@/models/User";
import { withAuth } from "@/lib/middleware";
import { emitToProject } from "@/lib/socket-server";
import { sendEmail } from "@/lib/email";
import { documentUploadedEmail } from "@/lib/emailTemplates";

/**
 * POST /api/projects/:id/documents
 * 
 * Adds a new document to the project's compliance documents array.
 */
export const POST = withAuth(async function (req, { params }) {
  try {
    const { id } = await params;
    await dbConnect();

    const { url, name, mimeType, size } = await req.json();

    if (!url || !name) {
      return NextResponse.json({ message: "URL and name are required" }, { status: 400 });
    }

    const project = await Project.findOne({
      _id: id,
      organization: req.user.organizationId
    });

    if (!project) {
      return NextResponse.json({ message: "Project not found" }, { status: 404 });
    }

    project.documents.push({
      url,
      name,
      mimeType,
      size,
      status: "Pending",
      uploadedAt: new Date(),
      uploadedBy: {
        user: req.user.id,
        name: req.user.name || "User"
      }
    });

    project.auditTrail.push({
      user: req.user.id,
      userName: req.user.name || "User",
      userRole: req.user.role || "Member",
      action: "Update",
      details: `Uploaded compliance document: ${name}`,
    });

    await project.save();

    // Email all users who can approve documents
    const approvers = await User.find({ organization: req.user.organizationId, status: "Active" })
      .populate("role", "permissions").select("name email role");

    const canApprove = approvers.filter(u =>
      u._id.toString() !== req.user.id &&
      (u.role?.permissions?.includes("*") || u.role?.permissions?.includes("land:approve"))
    );

    for (const approver of canApprove) {
      sendEmail({
        to: approver.email,
        subject: `Document Awaiting Approval — ${project.name}`,
        html: documentUploadedEmail({
          approverName: approver.name,
          uploaderName: req.user.name || "Team Member",
          projectName: project.name,
          documentName: name,
        }),
      });
    }

    emitToProject(id, 'documents:updated');
    return NextResponse.json(project.documents[project.documents.length - 1]);
  } catch (error) {
    console.error("Project document upload error:", error);
    return NextResponse.json(
      { message: "Error uploading document" },
      { status: 500 }
    );
  }
});
