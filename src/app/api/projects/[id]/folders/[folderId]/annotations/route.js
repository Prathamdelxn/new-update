import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import PlanFolder from "@/models/PlanFolder";
import User from "@/models/User";
import { withAuth, withPermission } from "@/lib/middleware";
import { emitToProject } from "@/lib/socket-server";

// GET /api/projects/[id]/folders/[folderId]/annotations?documentId=xxx
export const GET = withPermission(async function (req, { params }) {
  try {
    const { id, folderId } = await params;
    const { searchParams } = new URL(req.url);
    const documentId = searchParams.get("documentId");

    await dbConnect();

    const folder = await PlanFolder.findOne({ _id: folderId, project: id });
    if (!folder) {
      return NextResponse.json({ message: "Folder not found" }, { status: 404 });
    }

    const raw = documentId
      ? folder.annotations.filter((a) => a.documentId === documentId)
      : folder.annotations;

    // Shape response for frontend (keep videoUri/audioUri consistent)
    const annotations = raw.map((a) => ({
      _id:          a._id,
      clientId:     a.clientId,
      documentId:   a.documentId,
      x:            a.x,
      y:            a.y,
      text:         a.text || "",
      imageUri:     a.imageUri || "",
      videoUri:     a.videoUri || "",
      audioUri:     a.audioUri || "",
      createdByName: a.createdByName || "",
      createdAt:    a.createdAt,
    }));

    return NextResponse.json(annotations);
  } catch (error) {
    return NextResponse.json({ message: "Error fetching annotations" }, { status: 500 });
  }
}, "annotations:view");

// PATCH /api/projects/[id]/folders/[folderId]/annotations
// Body: { documentId, annotations: [...] }
// Replaces all annotations for the given documentId atomically.
// This is semantically a create-or-update bulk upsert, so it accepts either
// annotations:create or annotations:update — matching the frontend's
// canAnnotate OR-logic, instead of blanket-requiring annotations:update.
export const PATCH = withAuth(async function (req, { params }) {
  try {
    const { id, folderId } = await params;
    await dbConnect();

    if (req.user.role !== "Admin") {
      const userWithRole = await User.findById(req.user.id).populate("role").populate("projects.role").select("role projects");
      let perms = userWithRole?.role?.permissions || [];
      const has = (perm) => perms.includes("*") || perms.includes(perm);
      if (!has("annotations:create") && !has("annotations:update")) {
        const projectAssignment = userWithRole.projects?.find((p) => p.project.toString() === id);
        if (projectAssignment?.role) {
          const projPerms = projectAssignment.role.permissions || [];
          perms = [...perms, ...projPerms];
          if (projectAssignment.role.name === "Admin" || projectAssignment.role.isSystemRole) perms.push("*");
        }
      }
      if (!has("annotations:create") && !has("annotations:update")) {
        return NextResponse.json({ message: "Forbidden: Insufficient permissions" }, { status: 403 });
      }
    }

    const { documentId, annotations } = await req.json();

    if (!documentId || !Array.isArray(annotations)) {
      return NextResponse.json(
        { message: "documentId and annotations array are required" },
        { status: 400 }
      );
    }

    const folder = await PlanFolder.findOne({ _id: folderId, project: id });
    if (!folder) {
      return NextResponse.json({ message: "Folder not found" }, { status: 404 });
    }

    folder.annotations = [
      ...folder.annotations.filter((a) => a.documentId !== documentId),
      ...annotations.map((a) => ({
        clientId:     a.clientId,
        documentId,
        x:            a.x,
        y:            a.y,
        text:         a.text || "",
        imageUri:     a.imageUri || "",
        videoUri:     a.videoUri || "",
        audioUri:     a.audioUri || "",
        createdBy:    req.user.id,
        createdByName: req.user.name || "User",
        createdAt:    a.createdAt ? new Date(a.createdAt) : new Date(),
      })),
    ];

    await folder.save();

    const saved = folder.annotations
      .filter((a) => a.documentId === documentId)
      .map((a) => ({
        _id:          a._id,
        clientId:     a.clientId,
        documentId:   a.documentId,
        x:            a.x,
        y:            a.y,
        text:         a.text || "",
        imageUri:     a.imageUri || "",
        videoUri:     a.videoUri || "",
        audioUri:     a.audioUri || "",
        createdByName: a.createdByName || "",
        createdAt:    a.createdAt,
      }));

    emitToProject(id, 'annotations:updated', { folderId, documentId });
    return NextResponse.json(saved);
  } catch (error) {
    return NextResponse.json(
      { message: "Error saving annotations" },
      { status: 500 }
    );
  }
});
