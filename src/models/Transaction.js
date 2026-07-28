import mongoose from "mongoose";

const TransactionSchema = new mongoose.Schema(
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
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    createdByName: String,
    
    type: {
      type: String,
      enum: ["Incoming", "Outgoing", "Debit Note", "Purchase Payment"],
      required: true,
    },
    
    amount: { type: Number, required: true },
    date: { type: Date, default: Date.now, required: true },
    
    paymentMethod: { 
      type: String, 
      enum: ["Cash", "Bank Transfer", "Cheque", "RTGS/NEFT", "UPI", "Adjustment", "Other"],
      default: "Other"
    },
    
    // Who the transaction is involving (Client, Subcontractor, Vendor)
    partyName: { type: String, required: true }, 
    
    referenceNumber: String, // UTR, Cheque No, Debit Note No
    category: String,        // e.g., RA Bill, Material Advance, Delay Penalty
    description: String,
    invoiceUrl: String,
    
    // Optional link for auto-generated transactions
    linkedPurchase: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "MaterialPurchase" 
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

export default mongoose.models.Transaction || mongoose.model("Transaction", TransactionSchema);
