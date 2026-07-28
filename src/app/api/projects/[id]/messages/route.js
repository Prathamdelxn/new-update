import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import ChatMessage from "@/models/ChatMessage";
import { withAuth } from "@/lib/middleware";
import { emitToProject, emitToUser } from "@/lib/socket-server";
import Project from "@/models/Project";
import User from "@/models/User";
export const GET = withAuth(async function (req, { params }) {
  try {
    await dbConnect();
    const { id: projectId } = await params;
    
    const messages = await ChatMessage.find({ 
      project: projectId,
      organization: req.user.organizationId 
    })
    .sort({ createdAt: 1 })
    .populate('replyTo')
    .limit(100); 

    return NextResponse.json(messages);
  } catch (error) {
    return NextResponse.json({ message: "Error fetching messages" }, { status: 500 });
  }
});

export const POST = withAuth(async function (req, { params }) {
  try {
    await dbConnect();
    const { id: projectId } = await params;
    const { content, attachments, replyTo } = await req.json();

    if (!content && (!attachments || attachments.length === 0)) {
      return NextResponse.json({ message: "Message content or attachment required" }, { status: 400 });
    }

    const messageData = {
      project: projectId,
      sender: req.user.id,
      senderName: req.user.name || "User",
      senderRole: req.user.role || "Member",
      content,
      attachments: attachments || [],
      organization: req.user.organizationId,
      replyTo: replyTo || null,
    };

    let message = await ChatMessage.create(messageData);
    
    // Populate replyTo for the socket emission
    if (replyTo) {
      message = await ChatMessage.findById(message._id).populate('replyTo');
    }

    // Broadcast message via socket
    emitToProject(projectId, 'chat:message', message);

    // Also emit to all project members so their dashboards can update
    const proj = await Project.findById(projectId).select("name members createdBy");
    if (proj) {
      const allMembers = new Set([
        ...(proj.members || []).map(m => m.toString()),
        proj.createdBy?.toString()
      ]);
      allMembers.forEach(memberId => {
        if (memberId) {
          emitToUser(memberId, 'chat:message', message);
        }
      });

      // Fetch user objects to get push tokens
      const users = await User.find({ 
        _id: { $in: Array.from(allMembers) },
        _id: { $ne: req.user.id }
      }).select("pushTokens");

      const pushMessages = [];
      users.forEach(u => {
        if (u.pushTokens && u.pushTokens.length > 0) {
          u.pushTokens.forEach(token => {
            pushMessages.push({
              to: token,
              sound: 'default',
              title: `${proj.name || 'Project'} - New Message`,
              body: `${req.user.name || "User"}: ${content || "Sent an attachment"}`,
              data: { projectId, screen: 'Chat' },
              categoryId: 'chat_message',
            });
          });
        }
      });

      if (pushMessages.length > 0) {
        try {
          fetch('https://exp.host/--/api/v2/push/send', {
            method: 'POST',
            headers: {
              'Accept': 'application/json',
              'Accept-encoding': 'gzip, deflate',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(pushMessages),
          }).catch(err => console.error("Expo Push fetch error:", err));
        } catch (pushErr) {
          console.error("Failed to send push notifications:", pushErr);
        }
      }
    }

    return NextResponse.json(message, { status: 201 });
  } catch (error) {
    return NextResponse.json({ message: "Error sending message" }, { status: 500 });
  }
});
