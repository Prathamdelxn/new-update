import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Project from "@/models/Project";
import { withAuth } from "@/lib/middleware";
import { emitToProject } from "@/lib/socket-server";

/**
 * DELETE /api/projects/:id/documents/:docId
 * 
 * Removes a compliance document from the project.
 * Only allowed if the document is not "Approved".
 */
export const DELETE = withAuth(async function (req, { params }) {
  try {
    const { id, docId } = await params;
    await dbConnect();

    const project = await Project.findOne({ 
      _id: id, 
      organization: req.user.organizationId 
    });

    if (!project) {
      return NextResponse.json({ message: "Project not found" }, { status: 404 });
    }

    const document = project.documents.id(docId);
    if (!document) {
      return NextResponse.json({ message: "Document not found" }, { status: 404 });
    }

    // Restriction: Cannot delete approved documents
    if (document.status === "Approved") {
      return NextResponse.json({ message: "Approved documents cannot be deleted" }, { status: 403 });
    }

    // Check permissions
    const isAdmin = req.user.role === "Admin";
    const isUploader = document.uploadedBy?.user?.toString() === req.user.id;
    const canDelete = isAdmin || isUploader || req.user.permissions?.includes("land:delete") || req.user.permissions?.includes("*");

    if (!canDelete) {
      return NextResponse.json({ message: "Forbidden: No deletion permission" }, { status: 403 });
    }

    // Remove the document
    project.documents.pull(docId);

    project.auditTrail.push({
      user: req.user.id,
      userName: req.user.name || "User",
      userRole: req.user.role?.name || "Member",
      action: "Update",
      details: `Deleted compliance document: ${document.name}`,
    });

    await project.save();

    emitToProject(id, 'documents:updated');
    return NextResponse.json({ message: "Document deleted successfully" });
  } catch (error) {
    console.error("Document deletion error:", error);
    return NextResponse.json(
      { message: "Error deleting document" },
      { status: 500 }
    );
  }
});
