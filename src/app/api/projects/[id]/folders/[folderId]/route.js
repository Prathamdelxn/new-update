import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import PlanFolder from "@/models/PlanFolder";
import Project from "@/models/Project";
import User from "@/models/User";
import { withAuth } from "@/lib/middleware";
import { emitToProject } from "@/lib/socket-server";

// Duplicated per-file, matching this codebase's convention (no shared
// permission helpers across API route files). Replaces the old
// `Role.findOne({ name: req.user.role })` lookup, which only ever sees a
// user's GLOBAL role and completely misses permissions granted via a
// project-specific role assignment (User.projects[].role).
async function userHasPlansPermission(req, projectId, permission) {
  if (req.user.role === "Admin") return true;
  const userWithRole = await User.findById(req.user.id)
    .populate("role")
    .populate("projects.role")
    .select("role projects");
  let perms = userWithRole?.role?.permissions || [];
  if (!perms.includes("*") && !perms.includes(permission)) {
    const projectAssignment = userWithRole.projects?.find((p) => p.project.toString() === projectId);
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

// PUT /api/projects/[id]/folders/[folderId]
// Add a document to a folder
// PUT /api/projects/[id]/folders/[folderId]
// Add a document (new plan or new version) to a folder
export const PUT = withAuth(async function (req, { params }) {
  try {
    const { id, folderId } = await params;
    await dbConnect();

    if (!(await userHasPlansPermission(req, id, "plans:create"))) {
      return NextResponse.json({ message: "Forbidden: No plan upload permission" }, { status: 403 });
    }

    let { url, name, mimeType, size, documentId } = await req.json();

    // Safety: if documentId was passed as an object, extract the ID
    if (documentId && typeof documentId === 'object' && documentId._id) {
      documentId = documentId._id;
    }

    if (!url || !name) {
      return NextResponse.json({ message: "Document URL and name are required" }, { status: 400 });
    }

    const folder = await PlanFolder.findOne({ _id: folderId, project: id });
    if (!folder) {
      return NextResponse.json({ message: "Folder not found in this project" }, { status: 404 });
    }

    let auditDetail = "";
    if (documentId) {
      // Add a new version to an existing logical plan
      const plan = folder.documents.id(documentId);
      if (!plan) return NextResponse.json({ message: "Plan entry not found" }, { status: 404 });

      const nextVersionNumber = (plan.versions.length > 0 ? Math.max(...plan.versions.map(v => v.versionNumber)) : 0) + 1;

      plan.versions.push({
        url,
        name, // The filename of this revision
        versionNumber: nextVersionNumber,
        mimeType,
        size,
        uploadedAt: new Date(),
        uploadedBy: req.user.id,
        approvalStatus: "Draft", // New versions always start as Draft
        approvals: []
      });
      auditDetail = `Uploaded new version (v${nextVersionNumber}) for '${plan.name}' in folder '${folder.name}'`;
    } else {
      // Create a brand new plan entry with version 1
      folder.documents.push({
        name, // The display name of the plan
        versions: [{
          url,
          name,
          versionNumber: 1,
          mimeType,
          size,
          uploadedAt: new Date(),
          uploadedBy: req.user.id,
          approvalStatus: "Draft",
          approvals: []
        }]
      });
      auditDetail = `Uploaded new plan '${name}' to folder '${folder.name}'`;
    }

    await folder.save();

    const project = await Project.findById(id);
    if (project) {
      project.auditTrail.push({
        user: req.user.id,
        userName: req.user.name || "User",
        userRole: req.user.role || "Member",
        action: "Update",
        details: auditDetail,
      });
      await project.save();
    }

    emitToProject(id, 'plans:updated');
    return NextResponse.json(folder);
  } catch (error) {
    return NextResponse.json({ message: "Error updating folder" }, { status: 500 });
  }
});

/**
 * PATCH /api/projects/[id]/folders/[folderId]
 *
 * Actions now target a specific version within a plan entry.
 * Body requires: { action, docId, versionId, ... }
 */
export const PATCH = withAuth(async function (req, { params }) {
  try {
    const { id, folderId } = await params;
    await dbConnect();

    const body = await req.json();
    const { action, docId, versionId, name } = body;

    // ── 0. Folder Rename Logic ────────────────────────────────────
    if (name && !docId && !action) {
      if (!(await userHasPlansPermission(req, id, "plans:update"))) {
        return NextResponse.json({ message: "Forbidden: No permission to rename folders" }, { status: 403 });
      }

      const folder = await PlanFolder.findOne({ _id: folderId, project: id });
      if (!folder) return NextResponse.json({ message: "Folder not found" }, { status: 404 });

      const oldName = folder.name;
      folder.name = name.trim();
      await folder.save();

      const project = await Project.findById(id);
      if (project) {
        project.auditTrail.push({
          user: req.user.id,
          userName: req.user.name || "User",
          userRole: req.user.role || "Member",
          action: "Update",
          details: `Renamed plans folder from '${oldName}' to '${name.trim()}'`,
        });
        await project.save();
      }

      emitToProject(id, 'plans:updated');
      return NextResponse.json(folder);
    }

    if (!docId || !action) {
      return NextResponse.json({ message: "docId and action are required" }, { status: 400 });
    }

    const folder = await PlanFolder.findOne({ _id: folderId, project: id });
    if (!folder) return NextResponse.json({ message: "Folder not found" }, { status: 404 });

    const planEntry = folder.documents.id(docId);
    if (!planEntry) return NextResponse.json({ message: "Plan entry not found" }, { status: 404 });

    // Find the specific version
    let version;
    if (versionId) {
      version = planEntry.versions.id(versionId);
    } else {
      // Fallback to latest version if versionId not provided (for compatibility)
      version = planEntry.versions[planEntry.versions.length - 1];
    }

    if (!version) return NextResponse.json({ message: "Version not found" }, { status: 404 });

    const isAdmin = req.user.role === "Admin";
    const hasDeletePermission = await userHasPlansPermission(req, id, "plans:delete");
    const hasAssignPermission = await userHasPlansPermission(req, id, "plans:assign");

    // ── 1. sendForApproval ──────────────────────────────────────────
    if (action === "sendForApproval") {
      if (!isAdmin && !hasAssignPermission) {
        return NextResponse.json({ message: "You don't have permission to send plans for approval" }, { status: 403 });
      }

      const { approverIds } = body;
      if (!Array.isArray(approverIds) || approverIds.length === 0) {
        return NextResponse.json({ message: "At least one approver must be selected" }, { status: 400 });
      }

      const approvers = await User.find({ _id: { $in: approverIds } })
        .populate("role", "name")
        .select("+__enc_name +__enc_phoneNumber name email role");

      const cleanName = (u) => {
        let n = u.name;
        if (!n || typeof n !== "string" || n.includes(':') || /^[a-f0-9]{24}$/i.test(n.trim())) {
          n = u.email?.split('@')[0] || u.role?.name || "Admin";
        }
        n = n ? n.trim() : "Admin";
        if (n.includes('.')) {
          n = n.split('.').map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
        }
        return n;
      };

      version.approvalStatus = "Pending";
      version.approvalNote = "";
      version.approvals = approvers.map((u) => ({
        user: u._id,
        userName: cleanName(u),
        userRole: u.role?.name || "Member",
        status: "Pending",
        note: "",
        respondedAt: null,
      }));

      await folder.save();

      const project = await Project.findById(id);
      if (project) {
        project.auditTrail.push({
          user: req.user.id,
          userName: req.user.name || "User",
          userRole: req.user.role || "Member",
          action: "Update",
          details: `Plan '${planEntry.name}' (v${version.versionNumber}) sent for approval to ${approvers.map((u) => cleanName(u)).join(", ")}`,
        });
        await project.save();
      }

      emitToProject(id, 'plans:updated');
      return NextResponse.json(folder);
    }

    // ── 2. respond (approve / reject) ──────────────────────────────
    if (action === "respond") {
      const { response, note } = body;
      if (!["Approved", "Rejected"].includes(response)) {
        return NextResponse.json({ message: "response must be Approved or Rejected" }, { status: 400 });
      }

      if (!isAdmin && !(await userHasPlansPermission(req, id, "plans:approve"))) {
        return NextResponse.json({ message: "You don't have permission to approve or reject plans" }, { status: 403 });
      }

      const respondingUser = await User.findById(req.user.id).populate("role", "name").select("+__enc_name +__enc_phoneNumber name email role");
      let responderName = respondingUser?.name || req.user.name;
      if (!responderName || typeof responderName !== "string" || responderName.includes(':') || /^[a-f0-9]{24}$/i.test(responderName.trim())) {
        responderName = respondingUser?.email?.split('@')[0] || req.user.role || "Admin";
      }
      responderName = responderName ? responderName.trim() : "Admin";
      if (responderName.includes('.')) {
        responderName = responderName.split('.').map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
      }

      let entry = version.approvals.find((a) => a.user?.toString() === req.user.id);
      if (!entry && isAdmin) {
        entry = {
          user: req.user.id,
          userName: responderName,
          userRole: req.user.role || "Admin",
          status: response,
          note: note || "",
          respondedAt: new Date()
        };
        version.approvals.push(entry);
      } else if (!entry) {
        return NextResponse.json({ message: "You are not an assigned approver for this version" }, { status: 403 });
      }

      if (entry.status !== "Pending" && !isAdmin) {
        return NextResponse.json({ message: "You have already responded to this version" }, { status: 400 });
      }

      entry.status = response;
      entry.note = note || "";
      entry.respondedAt = new Date();
      entry.userName = responderName;
      entry.userRole = respondingUser?.role?.name || req.user.role || "Admin";

      if (response === "Rejected") {
        version.approvalStatus = "Rejected";
        version.approvalNote = note || "";
        version.rejectedBy = req.user.id;
        version.rejectedByName = responderName;
        version.rejectedAt = new Date();
      } else {
        const allApproved = version.approvals.every((a) => a.status === "Approved");
        if (allApproved) {
          version.approvalStatus = "Approved";
          version.approvedBy = req.user.id;
          version.approvedByName = responderName;
          version.approvedAt = new Date();
        }
      }

      folder.markModified("documents");
      await folder.save();

      const project = await Project.findById(id);
      if (project) {
        project.auditTrail.push({
          user: req.user.id,
          userName: req.user.name || "User",
          userRole: req.user.role || "Member",
          action: "Update",
          details: `Plan '${planEntry.name}' (v${version.versionNumber}) ${response.toLowerCase()} by ${req.user.name}`,
        });
        await project.save();
      }

      emitToProject(id, 'plans:updated');

      // ── 2.1 check status transition ──────────────────────────────
      if (version.approvalStatus === "Approved") {
        const { checkAndTransitionToOngoing } = await import("@/lib/projectStatusHelper");
        await checkAndTransitionToOngoing(id);
      }

      return NextResponse.json(folder);
    }

    // ── 3. revertToDraft ───────────────────────────────────────────
    if (action === "revertToDraft") {
      if (!isAdmin) {
        return NextResponse.json({ message: "Only admins can revert documents to Draft" }, { status: 403 });
      }

      version.approvalStatus = "Draft";
      version.approvalNote = "";
      version.approvals = [];

      await folder.save();

      const project = await Project.findById(id);
      if (project) {
        project.auditTrail.push({
          user: req.user.id,
          userName: req.user.name || "User",
          userRole: req.user.role || "Member",
          action: "Update",
          details: `Plan '${planEntry.name}' (v${version.versionNumber}) reverted to Draft`,
        });
        await project.save();
      }

      emitToProject(id, 'plans:updated');
      return NextResponse.json(folder);
    }

    // ── 4. deletePlanEntry (Delete the whole logical plan) ─────────
    if (action === "deleteDocument") {
      if (!hasDeletePermission) {
        return NextResponse.json({ message: "You don't have permission to delete plans" }, { status: 403 });
      }

      // Check if current targeted version is Approved - Only block if not authorized
      if (version.approvalStatus === "Approved" && !hasDeletePermission) {
        return NextResponse.json({ message: "You don't have permission to delete an approved plan" }, { status: 400 });
      }

      folder.documents.pull({ _id: docId });
      await folder.save();

      const project = await Project.findById(id);
      if (project) {
        project.auditTrail.push({
          user: req.user.id,
          userName: req.user.name || "User",
          userRole: req.user.role || "Member",
          action: "Update",
          details: `Plan '${planEntry.name}' and all its versions deleted`,
        });
        await project.save();
      }

      emitToProject(id, 'plans:updated');
      return NextResponse.json(folder);
    }

    // ── 5. deleteVersion ───────────────────────────────────────────
    if (action === "deleteVersion") {
      if (!hasDeletePermission) {
        return NextResponse.json({ message: "You don't have permission to delete versions" }, { status: 403 });
      }

      if (planEntry.versions.length <= 1) {
        return NextResponse.json({ message: "Cannot delete the only version. Delete the document instead." }, { status: 400 });
      }

      planEntry.versions.pull({ _id: versionId });
      await folder.save();

      const project = await Project.findById(id);
      if (project) {
        project.auditTrail.push({
          user: req.user.id,
          userName: req.user.name || "User",
          userRole: req.user.role || "Member",
          action: "Update",
          details: `Version v${version.versionNumber} of plan '${planEntry.name}' deleted`,
        });
        await project.save();
      }

      emitToProject(id, 'plans:updated');
      return NextResponse.json(folder);
    }

    return NextResponse.json({ message: "Invalid action" }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ message: "Error updating document" }, { status: 500 });
  }
});

// DELETE /api/projects/[id]/folders/[folderId]
export const DELETE = withAuth(async function (req, { params }) {
  try {
    const { id, folderId } = await params;
    await dbConnect();

    if (!(await userHasPlansPermission(req, id, "plans:delete"))) {
      return NextResponse.json({ message: "Forbidden: No permission to delete folders" }, { status: 403 });
    }

    const folder = await PlanFolder.findOneAndDelete({ _id: folderId, project: id });
    if (!folder) {
      return NextResponse.json({ message: "Folder not found" }, { status: 404 });
    }

    emitToProject(id, 'plans:updated');
    return NextResponse.json({ message: "Folder deleted successfully" });
  } catch (error) {
    return NextResponse.json({ message: "Error deleting folder" }, { status: 500 });
  }
});
