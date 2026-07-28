import mongoose from "mongoose";

const RoomSchema = new mongoose.Schema(
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
    name: {
      type: String,
      required: [true, "Room name is required"],
      trim: true,
    },
    type: {
      type: String,
      enum: [
        "Living Room", "Bedroom", "Master Bedroom", "Kitchen",
        "Bathroom", "Dining", "Office", "Corridor", "Balcony",
        "Terrace", "Store", "Laundry", "Entrance", "Other",
      ],
      default: "Other",
    },
    floor: {
      type: Number,
      default: 1,
    },
    area: {
      type: Number,
    },
    areaUnit: {
      type: String,
      enum: ["sqft", "sqm"],
      default: "sqft",
    },
    status: {
      type: String,
      enum: ["Planned", "In Progress", "Snagging", "Completed"],
      default: "Planned",
      index: true,
    },
    notes: {
      type: String,
      trim: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
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


export default mongoose.models.Room || mongoose.model("Room", RoomSchema);
