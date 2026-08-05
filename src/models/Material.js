import mongoose from "mongoose";

const MaterialSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Please provide a material name"],
      trim: true,
    },
    unit: {
      type: String,
      required: [true, "Please provide a unit (e.g., Bags, kg, Tons)"],
      trim: true,
    },
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
    supplier:  { type: String, trim: true },
    totalReceived: {
      type: Number,
      default: 0,
    },
    totalConsumed: {
      type: Number,
      default: 0,
    },
    logs: [
      {
        type: {
          type: String,
          enum: ["Request", "Received", "Used", "Purchase", "In", "Out"],
          required: true,
        },
        quantity: {
          type: Number,
          required: true,
        },
        date: {
          type: Date,
          default: Date.now,
        },
        note: String,
        updatedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        updatedByName: String,
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

// Virtual for current balance
MaterialSchema.virtual("balance").get(function () {
  return this.totalReceived - this.totalConsumed;
});

// Set virtuals to true for toJSON and toObject
MaterialSchema.set("toJSON", { virtuals: true });
MaterialSchema.set("toObject", { virtuals: true });

export default mongoose.models.Material || mongoose.model("Material", MaterialSchema);
