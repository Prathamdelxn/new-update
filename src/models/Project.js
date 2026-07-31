import mongoose from "mongoose";

const ProjectSchema = new mongoose.Schema(
  {
    customer: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", required: true, index: true },
    
    // Snapshot of crucial data at the time of conversion
    projectName: { type: String, required: true },
    totalBudget: { type: Number, required: true },
    agreedQuotationVersion: { type: Number, required: true },
    
    // Execution Tracking
    status: {
      type: String,
      enum: ["Planning", "Material Procurement", "Execution", "Handover", "Completed", "On Hold"],
      default: "Planning"
    },
    
    startDate: { type: Date, default: Date.now },
    expectedCompletionDate: { type: Date },
    actualCompletionDate: { type: Date },

    // Financial Tracking (Milestones can be added here later)
    amountPaid: { type: Number, default: 0 },
    amountPending: { type: Number }, // Usually totalBudget - amountPaid
    
    // Operations Team assignment
    assignedTo: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    
    // Organization/Tenant
    organization: { type: mongoose.Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }
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

// Pre-save hook to calculate pending amount
ProjectSchema.pre('save', function(next) {
  this.amountPending = this.totalBudget - this.amountPaid;
  next();
});

delete mongoose.models.Project;
export default mongoose.models.Project || mongoose.model("Project", ProjectSchema);