import mongoose from "mongoose";

const CustomerSchema = new mongoose.Schema(
  {
    leadNumber: { type: String, unique: true, index: true },
    leadSource: { 
      type: String, 
      enum: ["Phone Call", "Walk-in", "Referral", "Existing Customer", "Builder Reference", "Architect Reference", "Society Reference", "Social Media", "Other"] 
    },
    name: { type: String, required: [true, "Please provide customer name"], trim: true },
    mobileNumber: { type: String, required: [true, "Please provide mobile number"], trim: true },
    alternateNumber: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    address: { type: String, trim: true },
    city: { type: String, trim: true },
    state: { type: String, trim: true },
    pincode: { type: String, trim: true },
    propertyType: { type: String, enum: ["Flat", "Villa", "Office", "Shop", "Other"] },
    propertyAddress: { type: String, trim: true },
    projectLocation: { type: String, trim: true },
    
    assignedSalesExecutive: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
    designerAssigned: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    
    priority: { type: String, enum: ["Low", "Medium", "High"], default: "Medium" },
    budgetRange: { type: String },
    possessionDate: { type: Date },
    
    status: {
      type: String,
      enum: [
        "New Lead", "Contacted", "Meeting Scheduled", "Measurement Done", 
        "Requirements Gathering", "Requirement Completed", "Design Approved", 
        "Quotation Pending", "Quotation Sent", "Negotiation",
        "Booking Pending", "Won", "Lost"
      ],
      default: "New Lead",
      index: true,
    },
    remarks: { type: String },
    
    // Lost Lead Details
    lostReason: { type: String, enum: ["Budget", "Competitor", "No Response", "Possession Delayed", "Cancelled", "Other"] },
    competitorName: { type: String },
    futureFollowUpDate: { type: Date },
    
    // Site Visit Data (Phase 5)
    siteVisitScheduledDate: { type: Date },
    siteMeasurements: {
      carpetArea: String,
      ceilingHeight: String,
      rooms: String,
      notes: String
    },
    sitePhotos: [{ type: String }], // Array of Base64 strings (or URLs later)
    
    // Requirement & Design Data (Phase 6)
    requirements: [
      {
        roomName: String,
        description: String,
        theme: String
      }
    ],
    designFiles: [
      {
        name: String,
        url: String, // Base64 string for now
        fileType: String,
        uploadedAt: { type: Date, default: Date.now }
      }
    ],

    // Phase 7: Quotations & Estimates
    quotations: [
      {
        version: Number, // 1, 2, 3...
        items: [
          {
            description: String, // e.g., "Modular Kitchen", "Wardrobe"
            quantity: Number,
            unitPrice: Number,
            total: Number,
          }
        ],
        subtotal: Number,
        tax: Number, // Amount of tax
        taxPercentage: Number, // e.g. 18 for 18% GST
        discount: Number,
        grandTotal: Number,
        status: { type: String, enum: ['Draft', 'Sent', 'Accepted', 'Rejected'], default: 'Sent' },
        createdAt: { type: Date, default: Date.now },
        notes: String
      }
    ],

    // Core references
    organization: { type: mongoose.Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    
    // Populated upon Phase 10 Conversion
    linkedProject: { type: mongoose.Schema.Types.ObjectId, ref: "Project" }, 
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

delete mongoose.models.Customer;
export default mongoose.models.Customer || mongoose.model("Customer", CustomerSchema);
