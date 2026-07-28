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

export default mongoose.models.MaterialUsage || mongoose.model("MaterialUsage", MaterialUsageSchema);
