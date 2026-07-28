import mongoose from "mongoose";

const EscalationMatrixSchema = new mongoose.Schema(
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
    levels: [
      {
        level: { type: Number, required: true }, // Level 1, 2, 3...
        role: { type: String }, // e.g. "Site Engineer", "Project Manager"
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // Assigned specific user
        responseTime: { type: String }, // e.g. "24 Hours"
        contactInfo: { type: String }, // Specific phone or email if not from user profile
      }
    ],
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    auditTrail: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        userName: String,
        action: String,
        details: String,
        timestamp: { type: Date, default: Date.now },
      }
    ]
  },
  {
    timestamps: true,
  }
);


export default mongoose.models.EscalationMatrix || mongoose.model("EscalationMatrix", EscalationMatrixSchema);
