import mongoose from "mongoose";

const QuotationSchema = new mongoose.Schema(
  {
    quotationNumber: { type: String, required: true, unique: true },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", required: true, index: true },
    
    version: { type: String, required: true }, // e.g. "V1", "V2"
    preparedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    
    items: [
      {
        description: String,
        quantity: Number,
        unitPrice: Number,
        total: Number
      }
    ],
    
    subTotal: { type: Number, required: true },
    discount: { type: Number, default: 0 },
    tax: { type: Number, default: 0 },
    grandTotal: { type: Number, required: true },
    
    status: {
      type: String,
      enum: ["Draft", "Sent", "Viewed", "Approved", "Rejected", "Expired"],
      default: "Draft"
    },
    
    customerFeedback: { type: String },
    
    // Negotiation Phase tracking
    negotiation: {
      requestedDiscount: { type: Number },
      companyOffer: { type: Number },
      finalOffer: { type: Number },
      managerApprovalRequired: { type: Boolean, default: false },
      managerApproved: { type: Boolean, default: false },
      approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
    },
    
    organization: { type: mongoose.Schema.Types.ObjectId, ref: "Organization", required: true }
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

delete mongoose.models.Quotation;
export default mongoose.models.Quotation || mongoose.model("Quotation", QuotationSchema);
