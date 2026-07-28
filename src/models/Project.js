import mongoose from "mongoose";

const ProjectSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Please provide a project name"],
      trim: true,
    },
    projectCode: {
      type: String,
      
      sparse: true,
    },
    description: {
      type: String,
      trim: true,
    },
    currency: {
      type: String,
      required: true,
      default: "AED",
    },
    area: {
      type: Number,
      default: null,
    },
    areaUnit: {
      type: String,
      enum: ["sqft", "sqm"],
      default: "sqft",
    },
    projectType: {
      type: String,
      enum: ["Construction", "Interior"],
      default: "Construction",
      index: true,
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TemplateCategory",
      index: true,
    },
    clientName: {
      type: String,
      trim: true,
    },
    clientEmail: {
      type: String,
      trim: true,
    },
    clientPhone: {
      type: String,
      trim: true,
    },

    status: {
      type: String,
      enum: ["Initialized", "Planning", "Site Survey", "Ongoing", "Under Snagging", "Snagging Completed", "Completed", "Pending Handover", "Handover Rejected", "Handover Completed", "On Hold", "Cancelled"],
      default: "Initialized",
      index: true,
    },
    priority: {
      type: String,
      enum: ["Low", "Medium", "High", "Urgent"],
      default: "Medium",
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
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    members: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        role: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Role",
        },
      },
    ],
    siteLocation: {
      latitude: Number,
      longitude: Number,
      address: String,
    },
    attendanceRadius: {
      type: Number,
      default: 100, // default 100 meters
    },
    startDate: {
      type: Date,
      index: true,
    },
    endDate: {
      type: Date,
    },
    needSiteSurvey: {
      type: Boolean,
      default: false,
    },
    siteSurveyor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    snaggedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    handoverApprover: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    handoverRejectionReason: {
      type: String,
      trim: true,
    },
    documents: [
      {
        url: String,
        name: String,
        mimeType: String,
        size: Number,
        status: {
          type: String,
          enum: ["Pending", "Approved", "Rejected"],
          default: "Pending",
        },
        uploadedAt: { type: Date, default: Date.now },
        uploadedBy: {
          user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
          name: String,
        },
      },
    ],
    budgetHistory: [
      {
        amount: { type: Number, required: true },
        reason: { type: String, required: true },
        approvalStatus: {
          type: String,
          enum: ["Pending", "Approved", "Rejected"],
          default: "Approved", // Defaulting to approved for now as per user simplified flow
        },
        updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        updatedByName: String,
        timestamp: { type: Date, default: Date.now },
      },
    ],
    auditTrail: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        userName: String,
        userRole: String,
        action: {
          type: String,
          enum: ["Create", "Update", "MemberAdded", "MemberRemoved", "StatusChange", "RiskAdded", "RiskUpdated", "RiskDeleted", "IssueAdded", "IssueUpdated", "IssueDeleted", "SnagAdded", "SnagUpdated", "SnagDeleted"],
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
delete mongoose.models.Project;
export default mongoose.models.Project || mongoose.model("Project", ProjectSchema);
   