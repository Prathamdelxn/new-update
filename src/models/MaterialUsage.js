import mongoose from "mongoose";

const MaterialUsageSchema = new mongoose.Schema(
  {
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
    },
    usedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    usedByName: String,
    
    // Usage Details
    locationOrTask: String,
    
    items: [
      {
        materialId: { type: mongoose.Schema.Types.ObjectId, ref: "Material", required: true },
        quantity: { type: Number, required: true },
        unit: String,
      }
    ],
    commonNote: String,

    // "task" = logged automatically when a milestone task was submitted with
    // materials used. Those logs are owned by the task and cannot be deleted
    // from the Materials > Usage Log screen.
    source: {
      type: String,
      enum: ["manual", "task"],
      default: "manual",
    },
    milestone: { type: mongoose.Schema.Types.ObjectId, ref: "Milestone" },
    taskId: { type: mongoose.Schema.Types.ObjectId },
    
    status: {
      type: String,
      enum: ["Pending Verification", "Verified", "Rejected"],
      default: "Verified",
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

// Dev hot-reload keeps the previously compiled model, which would silently drop
// the newer `source`/`taskId` fields. Recompile if the cached schema is outdated.
if (mongoose.models.MaterialUsage && !mongoose.models.MaterialUsage.schema.path("source")) {
  mongoose.deleteModel("MaterialUsage");
}

export default mongoose.models.MaterialUsage || mongoose.model("MaterialUsage", MaterialUsageSchema);
