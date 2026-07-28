import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import PlanFolder from "@/models/PlanFolder";
import { withPermission } from "@/lib/middleware";
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

    // Shape response for frontend (keep videoUri consistent)
    const annotations = raw.map((a) => ({
      _id:          a._id,
      clientId:     a.clientId,
      documentId:   a.documentId,
      x:            a.x,
      y:            a.y,
      text:         a.text || "",
      imageUri:     a.imageUri || "",
      videoUri:     a.videoUri || "",
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
// Replaces all annotations for the given documentId atomically
export const PATCH = withPermission(async function (req, { params }) {
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
}, "annotations:update");
