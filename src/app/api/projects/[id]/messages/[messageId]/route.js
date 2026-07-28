import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import ChatMessage from "@/models/ChatMessage";
import { withAuth } from "@/lib/middleware";
import { emitToProject } from "@/lib/socket-server";

// Edit message
export const PATCH = withAuth(async function (req, { params }) {
  try {
    await dbConnect();
    const { id: projectId, messageId } = await params;
    const { content } = await req.json();

    const message = await ChatMessage.findOne({
      _id: messageId,
      project: projectId,
      sender: req.user.id, // Only sender can edit
      organization: req.user.organizationId
    });

    if (!message) {
      return NextResponse.json({ message: "Message not found or unauthorized" }, { status: 404 });
    }

    message.content = content;
    message.isEdited = true;
    await message.save();

    // Broadcast update
    emitToProject(projectId, 'chat:message:update', message);

    return NextResponse.json(message);
  } catch (error) {
    return NextResponse.json({ message: "Error updating message" }, { status: 500 });
  }
});

// Delete message
export const DELETE = withAuth(async function (req, { params }) {
  try {
    await dbConnect();
    const { id: projectId, messageId } = await params;

    const message = await ChatMessage.findOne({
      _id: messageId,
      project: projectId,
      organization: req.user.organizationId
    });

    if (!message) {
      return NextResponse.json({ message: "Message not found" }, { status: 404 });
    }

    // Check if sender or admin
    const isAdmin = req.user.role === 'Admin' || req.user.role === 'SuperAdmin';
    if (message.sender.toString() !== req.user.id && !isAdmin) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
    }

    await ChatMessage.deleteOne({ _id: messageId });

    // Broadcast deletion
    emitToProject(projectId, 'chat:message:delete', { messageId });

    return NextResponse.json({ message: "Message deleted" });
  } catch (error) {
    return NextResponse.json({ message: "Error deleting message" }, { status: 500 });
  }
});
