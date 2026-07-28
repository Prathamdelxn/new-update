import mongoose from "mongoose";

const ApprovalEntrySchema = new mongoose.Schema(
  {
    user:          { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    userName:      { type: String, required: true },
    userRole:      { type: String, default: "" },
    status:        { type: String, enum: ["Pending", "Approved", "Rejected"], default: "Pending" },
    note:          { type: String, default: "" },
    respondedAt:   { type: Date, default: null },
  },
  { _id: true }
);

const AnnotationSchema = new mongoose.Schema(
  {
    // Client-generated stable ID (used for undo/redo keying on the client)
    clientId:     { type: String, required: true },
    documentId:   { type: String, required: true }, // references documents._id (as string)
    // Relative coordinates 0.0–1.0
    x:            { type: Number, required: true },
    y:            { type: Number, required: true },
    text:         { type: String, default: '' },
    imageUri:     { type: String, default: '' },
    videoUri:     { type: String, default: '' },
    audioUri:     { type: String, default: '' },
    createdBy:    { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdByName:{ type: String, default: '' },
    createdAt:    { type: Date, default: Date.now },
  },
  { _id: true }
);

const PlanFolderSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Please provide a folder name"],
      trim: true,
    },
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true,
      index: true,
    },
    documents: [
      {
        name: { type: String, required: true }, // The logical name of the plan
        versions: [
          {
            url:            { type: String, required: true },
            name:           { type: String, required: true }, // Filename of this version
            versionNumber:  { type: Number, required: true },
            mimeType:       { type: String },
            size:           { type: Number },
            uploadedAt:     { type: Date, default: Date.now },
            uploadedBy:     { type: mongoose.Schema.Types.ObjectId, ref: "User" },
            approvalStatus: {
              type: String,
              enum: ["Draft", "Pending", "Approved", "Rejected"],
              default: "Draft",
            },
            approvalNote: { type: String, default: "" },
            approvals:    { type: [ApprovalEntrySchema], default: [] },
          },
        ],
        createdAt: { type: Date, default: Date.now },
      },
    ],
    annotations: { type: [AnnotationSchema], default: [] },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
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

delete mongoose.model.PlanFolder
export default mongoose.models.PlanFolder || mongoose.model("PlanFolder", PlanFolderSchema);
