import mongoose from "mongoose";

const MaterialPurchaseSchema = new mongoose.Schema(
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
    },
    purchasedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    purchasedByName: String,
    
    // Vendor & Financial Details
    vendorName: { type: String, required: true },
    poNumber: String,
    
    items: [
      {
        materialId: { type: mongoose.Schema.Types.ObjectId, ref: "Material", required: true },
        quantity: { type: Number, required: true },
        unit: String,
        unitPrice: { type: Number, default: 0 },
        totalPrice: { type: Number, default: 0 }
      }
    ],
    
    grandTotal: { type: Number, default: 0 },
    advancePayment: { type: Number, default: 0 },
    remainingBalance: { type: Number, default: 0 },
    
    paymentStatus: {
      type: String,
      enum: ["Unpaid", "Partial", "Paid"],
      default: "Unpaid"
    },
    
    commonNote: String,
    invoiceUrl: String,
    billNumber: String,
    
    status: {
      type: String,
      enum: ["Pending Approval", "Approved", "Rejected"],
      default: "Pending Approval",
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



export default mongoose.model("MaterialPurchase", MaterialPurchaseSchema);
