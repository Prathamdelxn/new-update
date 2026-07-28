import mongoose from "mongoose";

const FFEItemSchema = new mongoose.Schema(
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
    room: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Room",
      index: true,
    },
    name: {
      type: String,
      required: [true, "Item name is required"],
      trim: true,
    },
    category: {
      type: String,
      enum: ["Furniture", "Fixture", "Equipment", "Appliance", "Lighting", "Decor", "Sanitary", "Other"],
      default: "Other",
    },
    description: { type: String, trim: true },

    // Quantity & cost
    quantity:  { type: Number, default: 1 },
    unit:      { type: String, default: "nos", trim: true },
    unitCost:  { type: Number, default: 0 },
    totalCost: { type: Number, default: 0 },

    // Specifications
    finish:     { type: String, trim: true },   // "Matte Black", "Brushed Gold"
    colorCode:  { type: String, trim: true },   // "#1A2B3C" or "RAL 7016"
    dimensions: { type: String, trim: true },   // "1800 × 900 × 750 mm"
    brand:      { type: String, trim: true },
    modelNo:    { type: String, trim: true },
    supplier:   { type: String, trim: true },

    // Procurement & installation status
    status: {
      type: String,
      enum: ["Planned", "Ordered", "Delivered", "Installed", "Rejected"],
      default: "Planned",
      index: true,
    },
    orderedDate:        { type: Date },
    expectedDelivery:   { type: Date },
    actualDelivery:     { type: Date },
    installedDate:      { type: Date },

    images: [{ type: String }],
    notes:  { type: String, trim: true },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    createdByName: { type: String },
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

// Auto-compute totalCost before save
FFEItemSchema.pre("save", function () {
  this.totalCost = (this.quantity || 0) * (this.unitCost || 0);
});


export default mongoose.models.FFEItem || mongoose.model("FFEItem", FFEItemSchema);
