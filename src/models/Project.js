import mongoose from "mongoose";

const DocumentSchema = new mongoose.Schema(
  {
    url: String,
    name: String,
    mimeType: String,
    size: Number,
    status: { type: String, enum: ["Pending", "Approved", "Rejected"], default: "Pending" },
    uploadedAt: { type: Date, default: Date.now },
    uploadedBy: {
      user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      name: String,
    },
  },
  { _id: true }
);

const BudgetHistorySchema = new mongoose.Schema(
  {
    amount: Number,
    reason: String,
    approvalStatus: { type: String, enum: ["Pending", "Approved", "Rejected"], default: "Pending" },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    updatedByName: String,
    timestamp: { type: Date, default: Date.now },
  },
  { _id: true }
);

const AuditTrailSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    userName: String,
    userRole: String,
    action: String,
    details: String,
    timestamp: { type: Date, default: Date.now },
  },
  { _id: true }
);

const MemberSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    role: { type: mongoose.Schema.Types.ObjectId, ref: "Role" },
  },
  { _id: true }
);

const SiteLocationSchema = new mongoose.Schema(
  {
    address: String,
    latitude: Number,
    longitude: Number,
  },
  { _id: false }
);

const ProjectSchema = new mongoose.Schema(
  {
    // --- General-purpose project fields (dashboard "New Project" flow) ---
    name: { type: String, required: true, trim: true },
    code: { type: String, trim: true },
    description: { type: String },
    category: { type: mongoose.Schema.Types.ObjectId, ref: "TemplateCategory" },
    templateId: { type: mongoose.Schema.Types.ObjectId, ref: "Template" },

    clientName: { type: String },
    clientEmail: { type: String },
    clientPhone: { type: String },

    projectType: { type: String, enum: ["Construction"], default: "Construction" },
    priority: { type: String },

    startDate: { type: Date, default: Date.now },
    endDate: { type: Date },
    expectedCompletionDate: { type: Date },
    actualCompletionDate: { type: Date },

    needSiteSurvey: { type: Boolean, default: false },
    siteSurveyor: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    snaggedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    handoverApprover: { type: mongoose.Schema.Types.ObjectId, ref: "User" },

    siteLocation: { type: SiteLocationSchema, default: () => ({}) },
    attendanceRadius: { type: Number, default: 100 },

    area: { type: Number },
    areaUnit: { type: String },
    currency: { type: String, default: "INR" },
    budget: { type: Number },

    documents: { type: [DocumentSchema], default: [] },
    drawings: { type: [mongoose.Schema.Types.Mixed], default: [] },

    members: { type: [MemberSchema], default: [] },

    // --- CRM lead-conversion snapshot fields (optional, set only when
    // a project originates from a converted CRM quotation) ---
    customer: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", index: true },
    projectName: { type: String },
    totalBudget: { type: Number },
    agreedQuotationVersion: { type: Number },

    // --- Execution tracking ---
    status: {
      type: String,
      enum: [
        // CRM-conversion flow values
        "Planning",
        "Material Procurement",
        "Execution",
        "Handover",
        "Completed",
        "On Hold",
        // General dashboard flow values
        "Initialized",
        "Site Survey",
        "Ongoing",
        "Under Snagging",
        "Snagging Completed",
        "Pending Handover",
        "Handover Rejected",
        "Handover Completed",
        "Cancelled",
      ],
      default: "Initialized",
    },

    // --- Financial tracking ---
    amountPaid: { type: Number, default: 0 },
    amountPending: { type: Number },
    budgetHistory: { type: [BudgetHistorySchema], default: [] },

    // --- Audit ---
    auditTrail: { type: [AuditTrailSchema], default: [] },

    // --- Ownership / assignment ---
    assignedTo: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    organization: { type: mongoose.Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
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

// The CRM lead-conversion flow (crm/customers/[id]/convert) only sets
// `projectName`, not `name` — default it so `name`'s required validator
// doesn't reject conversion-created projects.
ProjectSchema.pre('validate', function () {
  if (!this.name && this.projectName) {
    this.name = this.projectName;
  }
});

// Pre-save hook to calculate pending amount (guarded against undefined budgets,
// since the general-purpose flow doesn't always set totalBudget/budget).
ProjectSchema.pre('save', function () {
  const total = this.totalBudget ?? this.budget;
  if (typeof total === "number") {
    this.amountPending = total - (this.amountPaid || 0);
  }
});

delete mongoose.models.Project;
export default mongoose.models.Project || mongoose.model("Project", ProjectSchema);
