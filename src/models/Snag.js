import mongoose from "mongoose";

const SnagSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Snag title is required"],
      trim: true,
    },
    description: {
      type: String,
      required: [true, "Snag description is required"],
    },
    status: {
      type: String,
      enum: ["Draft", "Open", "In Progress", "Resolved", "Closed"],
      default: "Draft",
      index: true,
    },
    priority: {
      type: String,
      enum: ["Low", "Medium", "High", "Critical"],
      default: "Medium",
      index: true,
    },
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true,
      index: true,
    },
    room: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Room",
      default: null,
      index: true,
    },
    interiorCategory: {
      type: String,
      enum: ["Flooring", "Walls", "Ceiling", "Furniture", "Fixtures", "Plumbing", "Electrical", "Other"],
      default: null,
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

export default mongoose.models.Snag || mongoose.model("Snag", SnagSchema);
