import mongoose from "mongoose";

const MilestoneSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Please provide a milestone name"],
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    dueDate: {
      type: Date,
    },
    status: {
      type: String,
      enum: ["Pending", "In Progress", "Completed", "On Hold"],
      default: "Pending",
      index: true,
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
      index: true,
    },
    tasks: [
      {
        title: { type: String, required: true },
        description: { type: String, trim: true },
        isCompleted: { type: Boolean, default: false },
        completedAt: { type: Date },
        startDate: { type: Date },
        endDate: { type: Date },
        assignedTo: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        createdByName: { type: String },
        completedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        completedByName: { type: String },
        proofImage: {
          url: String,
          uploadedAt: Date
        },
        completionNote: { type: String, trim: true },
        sourceSnag: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Snag",
        },
      },
    ],
    auditTrail: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        userName: String,
        userRole: String,
        action: {
          type: String,
          enum: ["Create", "Update", "StatusChange", "TaskAdded", "TaskUpdated", "TaskRemoved"],
        },
        details: String,
        timestamp: { type: Date, default: Date.now },
      },
    ],
    completedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: function (doc, ret) {
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Delete existing model if it exists to prevent OverwriteModelError in Next.js HMR
// delete mongoose.models.Milestone;
export default mongoose.models.Milestone || mongoose.model("Milestone", MilestoneSchema);
