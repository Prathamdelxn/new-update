import mongoose from "mongoose";

const LabourAttendanceSchema = new mongoose.Schema(
  {
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true,
      index: true,
    },
    labour: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Labour",
      required: true,
      index: true,
    },
    attendanceDate: {
      type: String, // YYYY-MM-DD
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["Present", "Absent", "Half Day"],
      required: true,
    },
    markedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
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

// Compound index for fast queries by project and date
LabourAttendanceSchema.index({ project: 1, attendanceDate: 1 });
LabourAttendanceSchema.index({ labour: 1, attendanceDate: 1 });

delete mongoose.models.LabourAttendance;
export default mongoose.models.LabourAttendance || mongoose.model("LabourAttendance", LabourAttendanceSchema);
