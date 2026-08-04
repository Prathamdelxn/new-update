import mongoose from "mongoose";

const RequirementSchema = new mongoose.Schema(
  {
    customer: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", required: true, index: true },
    
    rooms: [{ type: String }], // e.g. ["Hall", "Kitchen", "Master Bedroom"]
    needs: [{ type: String }], // e.g. ["Wardrobe", "False Ceiling", "TV Unit"]
    
    theme: { 
      type: String, 
      enum: ["Modern", "Luxury", "Minimal", "Industrial", "Classic", "Scandinavian", "Contemporary", "Other"]
    },
    
    expectedBudget: { type: Number },
    flexibleBudget: { type: Boolean, default: false },
    
    preferredCompletionDate: { type: Date },
    
    designerAssigned: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    
    remarks: { type: String },
    organization: { type: mongoose.Schema.Types.ObjectId, ref: "Organization", required: true }
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

delete mongoose.models.Requirement;
export default mongoose.models.Requirement || mongoose.model("Requirement", RequirementSchema);
