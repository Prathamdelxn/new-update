import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Project from "@/models/Project";
import User from "@/models/User";
import { withAuth } from "@/lib/middleware";
import { emitToProject } from "@/lib/socket-server";

// Duplicated per-file, matching this codebase's convention (no shared
// permission helpers across API route files). req.user (the JWT payload)
// only ever carries {id, role, organizationId, name} — there is no
// `permissions` array on it, so `req.user.permissions` is always undefined.
// Any check against it silently fails for everyone except literal Admins,
// which is why a "land:delete" holder still got 403'd. This looks the
// permission up properly, including project-specific role overrides.
async function userHasLandPermission(req, projectId, permission) {
  if (req.user.role === "Admin") return true;
  const userWithRole = await User.findById(req.user.id)
    .populate("role")
    .populate("projects.role")
    .select("role projects");
  let perms = userWithRole?.role?.permissions || [];
  if (!perms.includes("*") && !perms.includes(permission)) {
    const projectAssignment = userWithRole.projects?.find((p) => p.project?.toString() === projectId);
    if (projectAssignment?.role) {
      const projPerms = projectAssignment.role.permissions || [];
      perms = [...perms, ...projPerms];
      if (projectAssignment.role.name === "Admin" || projectAssignment.role.isSystemRole) {
        perms.push("*");
      }
    }
  }
  return perms.includes("*") || perms.includes(permission);
}

/**
 * PATCH /api/projects/:id/documents/:docId
 *
 * Edits a compliance document (needs land:update). Body: { name?, url?, mimeType?, size? }
 * - Renaming keeps the approval status.
 * - Replacing the file resets it to "Pending" so it is approved again, and
 *   the editor becomes the uploader (so they can't approve their own file).
 */
export const PATCH = withAuth(async function (req, { params }) {
  try {
    const { id, docId } = await params;
    await dbConnect();

    if (!(await userHasLandPermission(req, id, "land:update"))) {
      return NextResponse.json({ message: "Forbidden: No permission to edit documents" }, { status: 403 });
    }

    const { name, url, mimeType, size } = await req.json();
    const newName = typeof name === "string" ? name.trim() : undefined;
    if (newName === "") {
      return NextResponse.json({ message: "Document name cannot be empty" }, { status: 400 });
    }
    if (!newName && !url) {
      return NextResponse.json({ message: "Nothing to update" }, { status: 400 });
    }

    const project = await Project.findOne({ _id: id, organization: req.user.organizationId });
    if (!project) {
      return NextResponse.json({ message: "Project not found" }, { status: 404 });
    }
    const document = project.documents.id(docId);
    if (!document) {
      return NextResponse.json({ message: "Document not found" }, { status: 404 });
    }

    const changes = [];
    if (newName && newName !== document.name) {
      changes.push(`renamed "${document.name}" to "${newName}"`);
      document.name = newName;
    }
    if (url && url !== document.url) {
      document.url = url;
      if (mimeType !== undefined) document.mimeType = mimeType;
      if (size !== undefined) document.size = size;
      document.status = "Pending";
      document.uploadedAt = new Date();
      document.uploadedBy = { user: req.user.id, name: req.user.name || "User" };
      changes.push(`replaced the file of "${document.name}" (sent for approval again)`);
    }

    if (changes.length === 0) {
      return NextResponse.json(document);
    }

    project.auditTrail.push({
      user: req.user.id,
      userName: req.user.name || "User",
      userRole: req.user.role || "Member",
      action: "Update",
      details: `Compliance document ${changes.join("; ")}`,
    });

    await project.save();

    emitToProject(id, "documents:updated");
    return NextResponse.json(document);
  } catch (error) {
    console.error("Document update error:", error);
    return NextResponse.json({ message: "Error updating document" }, { status: 500 });
  }
});

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
    const isUploader = document.uploadedBy?.user?.toString() === req.user.id;
    const canDelete = isUploader || (await userHasLandPermission(req, id, "land:delete"));

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
