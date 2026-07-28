import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const OtpRegistrationSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    phoneNumber: {
      type: String,
      match: [/^\+?[0-9]{10,15}$/, "Please provide a valid phone number with country code"],
      trim: true,
    },
    password: {
      type: String,
      required: true,
    },
    otp: {
      type: String,
      required: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
      index: { expires: '10m' }, // Auto-delete after 10 minutes
    },
  },
  {
    timestamps: true,
  }
);


export default mongoose.models.OtpRegistration || mongoose.model("OtpRegistration", OtpRegistrationSchema);
