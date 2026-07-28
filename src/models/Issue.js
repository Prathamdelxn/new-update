import mongoose from "mongoose";

const IssueSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Issue title is required"],
      trim: true,
    },
    description: {
      type: String,
      required: [true, "Issue description is required"],
    },
    status: {
      type: String,
      enum: ["Draft", "Open", "In Progress", "Resolved", "Escalated", "Closed"],
      default: "Open",
      index: true,
    },
    priority: {
      type: String,
      enum: ["Low", "Medium", "High", "Critical"],
      default: "Medium",
      index: true,
    },
    category: {
      type: String,
      enum: ["Technical", "Resource", "Financial", "Site", "Client", "Third Party", "Other"],
      default: "Other",
    },
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true,
      index: true,
    },
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    escalationLevel: {
      type: Number,
      default: 0, // 0 means not escalated
    },
    resolutionDate: {
      type: Date,
    },
    resolutionDetails: {
      type: String,
    },
    resolutionImage: {
      type: String,
    },
    history: [
      {
        updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        action: String,
        details: String,
        timestamp: { type: Date, default: Date.now },
      }
    ],
    images: [{ type: String }],
  },
  {
    timestamps: true,
  }
);

// Clear model cache to prevent recompilation errors in Next.js dev mode

export default mongoose.models.Issue || mongoose.model("Issue", IssueSchema);
