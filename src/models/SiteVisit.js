import mongoose from "mongoose";

const SiteVisitSchema = new mongoose.Schema(
  {
    customer: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", required: true, index: true },
    executive: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    designer: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    
    visitDate: { type: Date, required: true },
    status: {
      type: String,
      enum: ["Scheduled", "Completed", "Cancelled", "Rescheduled"],
      default: "Scheduled"
    },
    
    gpsLocation: {
      latitude: Number,
      longitude: Number,
      address: String
    },
    
    propertyType: { type: String },
    
    photos: [
      {
        url: String,
        description: String,
        uploadedAt: { type: Date, default: Date.now }
      }
    ],
    
    measurements: {
      type: Map,
      of: String // e.g. "Hall": "18x12", "Kitchen": "10x8"
    },
    
    remarks: { type: String },
    customerSignature: { type: String }, // Base64 or URL
    
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

delete mongoose.models.SiteVisit;
export default mongoose.models.SiteVisit || mongoose.model("SiteVisit", SiteVisitSchema);
