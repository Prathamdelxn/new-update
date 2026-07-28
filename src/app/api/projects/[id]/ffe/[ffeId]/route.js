import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import FFEItem from "@/models/FFEItem";
import { withSubscription, withPermission } from "@/lib/middleware";

// PATCH /api/projects/[id]/ffe/[ffeId]
export const PATCH = withSubscription(withPermission(async function (req, { params }) {
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
      "finish", "colorCode", "dimensions", "brand", "modelNo", "supplier",
      "status", "orderedDate", "expectedDelivery", "actualDelivery",
      "installedDate", "images", "notes", "room",
    ];
    allowed.forEach(k => { if (updates[k] !== undefined) item[k] = updates[k]; });

    // pre("save") hook fires here and recomputes totalCost
    await item.save();

    return NextResponse.json(item);
  } catch (error) {
    return NextResponse.json({ message: "Error updating FFE item" }, { status: 500 });
  }
}, "interior"), "ffe:update");

// DELETE /api/projects/[id]/ffe/[ffeId]
export const DELETE = withSubscription(withPermission(async function (req, { params }) {
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
}, "interior"), "ffe:delete");
