import mongoose from "mongoose";

const ChatMessageSchema = new mongoose.Schema(
  {
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true,
      index: true,
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    senderName: {
      type: String,
      required: true,
    },
    senderRole: {
      type: String,
    },
    content: {
      type: String,
      trim: true,
    },
    attachments: [
      {
        url: String,
        type: { type: String, enum: ["image", "document", "video"] },
        name: String,
      },
    ],
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    reactions: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        userName: String,
        emoji: String,
      }
    ],
    replyTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ChatMessage",
    },
    isEdited: {
      type: Boolean,
      default: false,
    },
    readBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      }
    ],
  },
  {
    timestamps: true,
  }
);

// Delete existing model if it exists to prevent OverwriteModelError in Next.js HMR

export default mongoose.models.ChatMessage || mongoose.model("ChatMessage", ChatMessageSchema);
