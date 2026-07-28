import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const SuperAdminSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Please provide a name"],
      trim: true,
    },
    email: {
      type: String,
      required: [true, "Please provide an email"],
      unique: true,
      trim: true,
      lowercase: true,
    },
    password: {
      type: String,
      required: [true, "Please provide a password"],
      select: false,
    },
    lastLogin: {
      type: Date,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: function (doc, ret) {
        delete ret.password;
        delete ret.__v;
        return ret;
      },
    },
  }
);

SuperAdminSchema.pre("save", async function () {
  if (!this.isModified("password")) return;
  this.password = await bcrypt.hash(this.password, 10);
});

SuperAdminSchema.methods.comparePassword = async function (entered) {
  return bcrypt.compare(entered, this.password);
};


export default mongoose.models.SuperAdmin || mongoose.model("SuperAdmin", SuperAdminSchema);
