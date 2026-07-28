import mongoose from "mongoose";

const PlanRequestSchema = new mongoose.Schema(
  {
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    orgName: { type: String, trim: true },
    currentPlan: { type: String, enum: ["Silver", "Gold", "Platinum"] },
    requestedPlan: {
      type: String,
      enum: ["Silver", "Gold", "Platinum"],
      required: true,
    },
    status: {
      type: String,
      enum: ["Pending", "Approved", "Rejected"],
      default: "Pending",
      index: true,
    },
    requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    requestedByName: { type: String, trim: true },
    note: { type: String, trim: true },       // from org
    reviewNote: { type: String, trim: true }, // from SA
    reviewedBy: { type: String, trim: true },
    reviewedAt: { type: Date },
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


export default mongoose.models.PlanRequest || mongoose.model("PlanRequest", PlanRequestSchema);
