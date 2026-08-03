import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import FFEItem from "@/models/FFEItem";
import { withPermission } from "@/lib/middleware";

// PATCH /api/projects/[id]/ffe/[ffeId]
export const PATCH = withPermission(async function (req, { params }) {
  try {
    await dbConnect();
    const { ffeId } = await params;
    const updates = await req.json();

    const item = await FFEItem.findById(ffeId);
    if (!item) {
      return NextResponse.json({ message: "FFE item not found" }, { status: 404 });
    }

    const allowed = [
      "name", "category", "description", "quantity", "unit", "unitCost",
      "finish", "dimensions", "brand", "modelNo", "supplier",
      "status", "poNumber", "leadTimeDays", "warrantyMonths",
      "orderedDate", "expectedDelivery", "actualDelivery",
      "installedDate", "images", "notes", "room",
    ];
    allowed.forEach(k => { if (updates[k] !== undefined) item[k] = updates[k]; });

    // pre("save") hook fires here and recomputes totalCost
    await item.save();

    return NextResponse.json(item);
  } catch (error) {
    return NextResponse.json({ message: "Error updating FFE item" }, { status: 500 });
  }
}, "ffe:update");

// DELETE /api/projects/[id]/ffe/[ffeId]
export const DELETE = withPermission(async function (req, { params }) {
  try {
    await dbConnect();
    const { ffeId } = await params;

    const item = await FFEItem.findByIdAndDelete(ffeId);
    if (!item) {
      return NextResponse.json({ message: "FFE item not found" }, { status: 404 });
    }

    return NextResponse.json({ message: "FFE item deleted" });
  } catch (error) {
    return NextResponse.json({ message: "Error deleting FFE item" }, { status: 500 });
  }
}, "ffe:delete");
