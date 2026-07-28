import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Annotation from "@/models/Annotation";
import { withSubscription } from "@/lib/middleware";

async function patchHandler(req, { params }) {
  await dbConnect();
  const { id, annotationId } = await params;

  const annotation = await Annotation.findOne({
    _id: annotationId,
    project: id,
    organization: req.user.organizationId,
  });
  if (!annotation) return NextResponse.json({ error: "Annotation not found" }, { status: 404 });

  const body = await req.json();
  const allowed = ["text", "page", "position", "color"];
  for (const key of allowed) {
    if (body[key] !== undefined) annotation[key] = body[key];
  }

  await annotation.save();
  return NextResponse.json(annotation);
}

async function deleteHandler(req, { params }) {
  await dbConnect();
  const { id, annotationId } = await params;

  const annotation = await Annotation.findOneAndDelete({
    _id: annotationId,
    project: id,
    organization: req.user.organizationId,
    createdBy: req.user.id,
  });
  if (!annotation) return NextResponse.json({ error: "Annotation not found" }, { status: 404 });

  return NextResponse.json({ success: true });
}

export const PATCH = withSubscription(patchHandler, "plan_annotations");
export const DELETE = withSubscription(deleteHandler, "plan_annotations");
