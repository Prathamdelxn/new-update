import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import ChatMessage from "@/models/ChatMessage";
import { withAuth } from "@/lib/middleware";
import mongoose from "mongoose";

export const POST = withAuth(async function (req, { params }) {
  try {
    await dbConnect();
    const { id: projectId } = await params;
    const userIdObj = new mongoose.Types.ObjectId(req.user.id);
    const projectIdObj = new mongoose.Types.ObjectId(projectId);

    await ChatMessage.updateMany(
      {
        project: projectIdObj,
        sender: { $ne: userIdObj },
        readBy: { $ne: userIdObj }
      },
      {
        $addToSet: { readBy: userIdObj }
      }
    );

    console.log(`[read endpoint] user ${req.user.id} marked messages read in project ${projectId}`);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[read endpoint] error:', error);
    return NextResponse.json({ message: "Error marking messages as read" }, { status: 500 });
  }
});
