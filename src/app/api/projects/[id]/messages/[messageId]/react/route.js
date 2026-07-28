import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import ChatMessage from "@/models/ChatMessage";
import { withAuth } from "@/lib/middleware";
import { emitToProject } from "@/lib/socket-server";

export const PATCH = withAuth(async function (req, { params }) {
  try {
    await dbConnect();
    const { id: projectId, messageId } = await params;
    const { emoji } = await req.json();

    if (!emoji) {
      return NextResponse.json({ message: "Emoji is required" }, { status: 400 });
    }

    const message = await ChatMessage.findOne({ 
      _id: messageId, 
      project: projectId,
      organization: req.user.organizationId 
    });

    if (!message) {
      return NextResponse.json({ message: "Message not found" }, { status: 404 });
    }

    // Initialize reactions if undefined
    if (!message.reactions) message.reactions = [];

    // Check if user already reacted with THIS emoji
    const existingIndex = message.reactions.findIndex(
      (r) => r.user.toString() === req.user.id && r.emoji === emoji
    );

    if (existingIndex > -1) {
      // Remove reaction (toggle off)
      message.reactions.splice(existingIndex, 1);
    } else {
      // Add reaction
      message.reactions.push({
        user: req.user.id,
        userName: req.user.name || "User",
        emoji,
      });
    }

    await message.save();

    // Broadcast update via socket
    // We send the whole message object so the client can update its local state
    emitToProject(projectId, 'chat:message:update', message);

    return NextResponse.json(message);
  } catch (error) {
    console.error("Reaction error:", error);
    return NextResponse.json({ message: "Error updating reaction" }, { status: 500 });
  }
});
