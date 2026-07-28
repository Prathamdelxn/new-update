import mongoose from "mongoose";

const BOQItemSchema = new mongoose.Schema({
  project: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Project",
    required: true,
    index: true,
  },
  groupName: { type: String, required: true },
  itemNumber: { type: String },
  itemDescription: { type: String, required: true },
  unit: { type: String },
  quantity: { type: Number, default: 0 },
  unitCost: { type: Number, default: 0 },
  totalCost: { type: Number, default: 0 },
  room: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Room",
    default: null,
    index: true,
  },
  remark: { type: String },
  version: { type: Number, default: 1 },
  isLatest: { type: Boolean, default: true },
  historyId: { type: mongoose.Schema.Types.ObjectId, index: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  createdByName: { type: String },
  status: { 
    type: String, 
    enum: ["Draft", "Pending", "Approved", "Rejected"], 
    default: "Draft" 
  },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  approvedByName: { type: String },
  approvedAt: { type: Date },
  rejectionReason: { type: String },
  requestedApprover: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  requestedApproverName: { type: String },
  createdAt: { type: Date, default: Date.now },
});



const BOQ = mongoose.models.BOQ || mongoose.model("BOQ", BOQItemSchema);

export default BOQ;
