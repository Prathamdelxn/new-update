import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Annotation from "@/models/Annotation";
import Project from "@/models/Project";
import { withSubscription } from "@/lib/middleware";

async function getHandler(req, { params }) {
  await dbConnect();
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const documentId = searchParams.get("document");

  const filter = { project: id, organization: req.user.organizationId };
  if (documentId) filter.document = documentId;

  const annotations = await Annotation.find(filter).sort({ createdAt: -1 }).lean();
  return NextResponse.json(annotations);
}

async function postHandler(req, { params }) {
  await dbConnect();
  const { id } = await params;

  const project = await Project.findOne({
    _id: id,
    organization: req.user.organizationId,
  }).lean();
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const body = await req.json();
  const { document: documentId, documentName, text, page, position, color, imageUri, videoUri, voiceNoteUri } = body;

  if (!documentId || !text?.trim()) {
    return NextResponse.json({ error: "document and text are required" }, { status: 400 });
  }

  const annotation = await Annotation.create({
    project: id,
    organization: req.user.organizationId,
    document: documentId,
    documentName: documentName || "",
    text: text.trim(),
    page: page || 1,
    position: position || { x: 0, y: 0 },
    color: color || "#FBBF24",
    imageUri: imageUri || undefined,
    videoUri: videoUri || undefined,
    voiceNoteUri: voiceNoteUri || undefined,
    createdBy: req.user.id,
    createdByName: req.user.name || "",
  });

  return NextResponse.json(annotation, { status: 201 });
}

export const GET = withSubscription(getHandler, "plan_annotations");
export const POST = withSubscription(postHandler, "plan_annotations");
