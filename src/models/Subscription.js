import mongoose from "mongoose";

// Feature flags granted per plan (baseline — can be overridden per org)
export const PLAN_DEFAULTS = {
  Silver: {
    maxProjects: 10,
    maxUsers: 10,
    storageGB: 5,
    features: ["basic_boq", "milestones", "materials", "issues", "risks", "documents", "custom_roles"],
  },
  Gold: {
    maxProjects: 50,
    maxUsers: 100,
    storageGB: 25,
    features: [
      "basic_boq", "milestones", "materials", "issues", "risks", "documents",
      "boq_import", "interior", "custom_roles", "export_reports",
    ],
  },
  Platinum: {
    maxProjects: null,   // null = unlimited
    maxUsers: null,
    storageGB: 100,
    features: [
      "basic_boq", "milestones", "materials", "issues", "risks", "documents",
      "boq_import", "interior", "custom_roles", "export_reports", "arabic", "api_access",
      "interior_advanced", "plan_annotations",
    ],
  },
};

const SubscriptionSchema = new mongoose.Schema(
  {
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      unique: true,
      index: true,
    },
    plan: {
      type: String,
      enum: ["Silver", "Gold", "Platinum"],
      default: "Silver",
    },
    status: {
      type: String,
      enum: ["Active", "Trial", "Suspended", "Expired"],
      default: "Trial",
    },
    trialEndsAt: {
      type: Date,
      default: () => {
        const d = new Date();
        d.setDate(d.getDate() + 14); // 14-day trial
        return d;
      },
    },
    renewalDate: {
      type: Date,
      default: null,
    },
    // Computed effective limits — baseline from plan + any SA overrides
    limits: {
      maxProjects: { type: Number, default: 10 },
      maxUsers:    { type: Number, default: 10 },
      storageGB:   { type: Number, default: 5 },
      features:    { type: [String], default: () => [...PLAN_DEFAULTS.Silver.features] },
    },
    // Super Admin manual overrides (null means "use plan default")
    overrides: {
      maxProjects: { type: Number, default: null },
      maxUsers:    { type: Number, default: null },
      storageGB:   { type: Number, default: null },
      features:    { type: [String], default: undefined },
    },
    // Record of plan changes
    history: [
      {
        plan:       String,
        status:     String,
        changedBy:  String, // super admin name
        reason:     String,
        timestamp:  { type: Date, default: Date.now },
      },
    ],
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

// Recompute effective limits whenever plan or overrides change
SubscriptionSchema.methods.applyPlanDefaults = function () {
  const base = PLAN_DEFAULTS[this.plan];
  this.limits.maxProjects = this.overrides?.maxProjects ?? base.maxProjects;
  this.limits.maxUsers    = this.overrides?.maxUsers    ?? base.maxUsers;
  this.limits.storageGB   = this.overrides?.storageGB   ?? base.storageGB;
  this.limits.features    = this.overrides?.features?.length ? this.overrides.features : [...base.features];
};

// Safety net: auto-apply defaults if plan or overrides are modified without an explicit applyPlanDefaults() call
SubscriptionSchema.pre("save", function () {
  if (this.isModified("plan") || this.isModified("overrides")) {
    this.applyPlanDefaults();
  }
});


export default mongoose.models.Subscription || mongoose.model("Subscription", SubscriptionSchema);
