import mongoose from "mongoose";

const SiteSurveySchema = new mongoose.Schema(
  {
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true,
      index: true,
    },
    surveyor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
    },
    accessibility: {
      type: String,
      enum: ["Good", "Fair", "Poor", "Hazardous", "Needs Work"],
      default: "Good",
    },
    powerAvailable: {
      type: Boolean,
      default: false,
    },
    waterAvailable: {
      type: Boolean,
      default: false,
    },
    terrainNotes: {
      type: String,
      trim: true,
    },
    surveyorComments: {
      type: String,
      trim: true,
    },
    attachments: [
      {
        url: String,
        name: String,
        mimeType: String,
        size: Number,
      }
    ],
    affectsBudget: {
      type: Boolean,
      default: false,
    },
    recommendedBudget: {
      type: Number,
    },
    budgetReason: {
      type: String,
    },
    status: {
      type: String,
      enum: ["Draft", "Submitted", "Approved", "Needs Attention"],
      default: "Submitted",
    },
    rejectionReason: {
      type: String,
      trim: true,
    },
    budgetRequestSent: {
      type: Boolean,
      default: false,
    },
    observationImage: {
      type: String,
    },
    // Interior-specific fields
    roomCount: {
      type: Number,
    },
    ceilingHeight: {
      type: String,
      trim: true,
    },
    naturalLighting: {
      type: String,
      enum: ['Excellent', 'Good', 'Limited', 'None'],
    },
    ventilationAvailable: {
      type: Boolean,
      default: false,
    },
    structuralModification: {
      type: Boolean,
      default: false,
    },
    structuralNotes: {
      type: String,
      trim: true,
    },
    clientStylePreference: {
      type: String,
      trim: true,
    },
    additionalPhotos: [{ type: String }],
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


export default mongoose.models.SiteSurvey || mongoose.model("SiteSurvey", SiteSurveySchema);
