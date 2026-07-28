import mongoose from "mongoose";

const AnnotationSchema = new mongoose.Schema(
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
    document: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    documentName: {
      type: String,
      trim: true,
    },
    text: {
      type: String,
      required: [true, "Annotation text is required"],
      trim: true,
    },
    page: {
      type: Number,
      default: 1,
    },
    position: {
      x: { type: Number, default: 0 },
      y: { type: Number, default: 0 },
    },
    color: {
      type: String,
      default: "#FBBF24",
    },
    imageUri: {
      type: String,
      trim: true,
    },
    videoUri: {
      type: String,
      trim: true,
    },
    voiceNoteUri: {
      type: String,
      trim: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    createdByName: {
      type: String,
      trim: true,
    },
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


export default mongoose.models.Annotation || mongoose.model("Annotation", AnnotationSchema);
