import mongoose from "mongoose";

const ActivitySchema = new mongoose.Schema(
  {
    customer: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", required: true, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    
    type: { 
      type: String, 
      enum: ["Phone Call", "WhatsApp", "Meeting", "Office Visit", "Site Visit", "Email", "Status Change", "System Update", "Requirement Gathering", "Design Shared"],
      required: true
    },
    
    status: {
      type: String,
      enum: ["Completed", "Pending", "Missed"],
      default: "Completed"
    },
    
    scheduledDate: { type: Date },
    completedDate: { type: Date },
    
    remarks: { type: String },
    customerResponse: { type: String },
    
    nextFollowUpDate: { type: Date },
    reminderSet: { type: Boolean, default: false },
    priority: { type: String, enum: ["Low", "Medium", "High"], default: "Medium" },
    
    attachments: [
      {
        url: String,
        name: String,
        mimeType: String
      }
    ],
    
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

delete mongoose.models.Activity;
export default mongoose.models.Activity || mongoose.model("Activity", ActivitySchema);
