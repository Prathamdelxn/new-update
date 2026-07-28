import mongoose from "mongoose";

const LabourSchema = new mongoose.Schema(
  {
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      enum: ["Skilled", "Unskilled"],
      required: true,
    },
    paymentCycle: {
      type: String,
      enum: ["Monthly"],
      default: "Monthly",
    },
    wageAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    status: {
      type: String,
      enum: ["Active", "Inactive"],
      default: "Active",
    },
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

// Compound index for fast queries by project
LabourSchema.index({ project: 1, status: 1 });

delete mongoose.models.Labour;
export default mongoose.models.Labour || mongoose.model("Labour", LabourSchema);
