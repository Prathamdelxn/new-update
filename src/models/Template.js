import mongoose from "mongoose";

const TemplateSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Please provide a template name"],
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TemplateCategory",
      required: [true, "Please assign a category to this template"],
      index: true,
    },
    minBudget: {
      type: Number,
      default: 0,
    },
    maxBudget: {
      type: Number,
      default: 0,
    },
    area: {
      type: Number,
      default: 0,
    },
    estimatedDays: {
      type: Number,
      default: 0,
    },
    images: [
      {
        type: String, // Cloudinary URLs
      },
    ],
    files: [
      {
        name: String,
        url: String,
        size: Number,
      },
    ],
    boq: [
      {
        item: String,
        description: String,
        quantity: Number,
        unit: String,
        rate: Number,
        amount: Number,
      },
    ],
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
    status: {
      type: String,
      enum: ["Active", "Archive", "Draft"],
      default: "Active",
      index: true,
    },
    auditTrail: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        userName: String,
        userRole: String,
        action: {
          type: String,
          enum: ["Create", "Update", "Archive"],
        },
        details: String,
        timestamp: { type: Date, default: Date.now },
      },
    ],
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
export default mongoose.models.Template || mongoose.model("Template", TemplateSchema);
