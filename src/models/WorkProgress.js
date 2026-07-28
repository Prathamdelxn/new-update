import mongoose from "mongoose";

const WorkProgressSchema = new mongoose.Schema(
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
      index: true,
    },
    milestone: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Milestone",
      default: null,
    },
    milestoneName: { type: String, default: "General" },
    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: [200, "Description cannot exceed 200 characters"],
    },
    progressPercent: {
      type: Number,
      required: true,
      min: [0, "Progress cannot be negative"],
      max: [100, "Progress cannot exceed 100%"],
    },
    photos: [{ type: String }],
    date: { type: String, required: true }, // YYYY-MM-DD
    loggedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    loggedByName: { type: String, default: "" },
  },
  {
    timestamps: true,
    toJSON: {
      transform(doc, ret) {
        delete ret.__v;
        return ret;
      },
    },
  }
);

WorkProgressSchema.index({ project: 1, date: 1 });
WorkProgressSchema.index({ project: 1, milestone: 1, date: 1 });


export default mongoose.models.WorkProgress ||
  mongoose.model("WorkProgress", WorkProgressSchema);
