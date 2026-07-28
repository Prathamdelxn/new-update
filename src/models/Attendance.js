import mongoose from "mongoose";

const AttendanceSchema = new mongoose.Schema(
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
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    attendanceDate: {
      type: String, // YYYY-MM-DD
      required: true,
      index: true,
    },
    checkInTime: {
      type: Date,
      required: true,
    },
    checkOutTime: {
      type: Date,
    },
    checkInLocation: {
      latitude: Number,
      longitude: Number,
      accuracy: Number,
      address: String,
    },
    checkOutLocation: {
      latitude: Number,
      longitude: Number,
      accuracy: Number,
      address: String,
    },
    totalWorkHours: {
      type: Number,
    },
    status: {
      type: String,
      enum: ["Present", "Absent", "Half Day", "Late"],
      default: "Present",
    },
    siteDistanceInMeters: {
      type: Number,
    },
    withinAllowedRadius: {
      type: Boolean,
    },
    checkInPhoto: {
      type: String,
    },
    notes: {
      type: String,
    },
    source: {
      type: String,
      enum: ["Mobile"],
      default: "Mobile",
    },
    deviceInfo: {
      platform: String,
      appVersion: String,
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

// Compound index for fast queries
AttendanceSchema.index({ project: 1, attendanceDate: 1 });
AttendanceSchema.index({ user: 1, attendanceDate: 1 });


export default mongoose.models.Attendance || mongoose.model("Attendance", AttendanceSchema);
