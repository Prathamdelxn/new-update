import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import PlanFolder from "@/models/PlanFolder";
import User from "@/models/User";
import { withAuth, withPermission } from "@/lib/middleware";
import { userHasProjectPermission } from "@/lib/permissions";
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
// Replaces all annotations for the given documentId atomically. Because the
// client sends the whole list, compare it with what's stored and require the
// matching permission for each kind of change: new pins need
// annotations:create, edited pins annotations:update, removed pins
// annotations:delete.
const ANNOTATION_CONTENT_FIELDS = ["x", "y", "text", "imageUri", "videoUri", "audioUri"];

export const PATCH = withAuth(async function (req, { params }) {
  try {
    const { id, folderId } = await params;
    await dbConnect();

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

    const keyOf = (a) => String(a.clientId || a._id);
    const existingByKey = new Map(
      folder.annotations.filter((a) => a.documentId === documentId).map((a) => [keyOf(a), a])
    );
    const incomingKeys = new Set(annotations.map((a) => String(a.clientId)));
    const isChanged = (prev, next) =>
      ANNOTATION_CONTENT_FIELDS.some((f) => String(prev[f] ?? "") !== String(next[f] ?? ""));

    const hasAdds = annotations.some((a) => !existingByKey.has(String(a.clientId)));
    const hasUpdates = annotations.some((a) => {
      const prev = existingByKey.get(String(a.clientId));
      return prev && isChanged(prev, a);
    });
    const hasRemovals = [...existingByKey.keys()].some((k) => !incomingKeys.has(k));

    if (req.user.role !== "Admin") {
      const checks = [
        [hasAdds, "annotations:create", "add annotations"],
        [hasUpdates, "annotations:update", "edit annotations"],
        [hasRemovals, "annotations:delete", "delete annotations"],
      ];
      for (const [needed, permission, label] of checks) {
        if (needed && !(await userHasProjectPermission(req, id, permission))) {
          return NextResponse.json({ message: `Forbidden: You don't have permission to ${label}` }, { status: 403 });
        }
      }
    }

    folder.annotations = [
      ...folder.annotations.filter((a) => a.documentId !== documentId),
      ...annotations.map((a) => {
        // Existing pins keep their original author; only new pins get the current user
        const prev = existingByKey.get(String(a.clientId));
        return {
          clientId:     a.clientId,
          documentId,
          x:            a.x,
          y:            a.y,
          text:         a.text || "",
          imageUri:     a.imageUri || "",
          videoUri:     a.videoUri || "",
          audioUri:     a.audioUri || "",
          createdBy:    prev?.createdBy || req.user.id,
          createdByName: prev?.createdByName || req.user.name || "User",
          createdAt:    prev?.createdAt || (a.createdAt ? new Date(a.createdAt) : new Date()),
        };
      }),
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
