import mongoose from "mongoose";

const BookingSchema = new mongoose.Schema(
  {
    bookingNumber: { type: String, required: true, unique: true },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", required: true, index: true },
    quotation: { type: mongoose.Schema.Types.ObjectId, ref: "Quotation", required: true },
    
    bookingDate: { type: Date, required: true, default: Date.now },
    bookingAmount: { type: Number, required: true },
    
    paymentMode: { 
      type: String, 
      enum: ["Cash", "Bank Transfer", "Cheque", "Credit Card", "UPI", "Other"],
      required: true
    },
    transactionNumber: { type: String },
    receivedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    
    status: {
      type: String,
      enum: ["Pending", "Received", "Cancelled"],
      default: "Pending"
    },
    
    remarks: { type: String },
    receiptUrl: { type: String }, // PDF receipt
    
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

delete mongoose.models.Booking;
export default mongoose.models.Booking || mongoose.model("Booking", BookingSchema);
