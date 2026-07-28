import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Labour from "@/models/Labour";
import LabourAttendance from "@/models/LabourAttendance";
import { withAuth } from "@/lib/middleware";

export const PUT = withAuth(async function (req, { params }) {
  try {
    await dbConnect();
    const { id } = params;
    
    if (!id) {
      return NextResponse.json({ message: "Labour ID is required" }, { status: 400 });
    }

    const { name, type, paymentCycle, wageAmount, status } = await req.json();

    const updateData = {};
    if (name) updateData.name = name;
    if (type) updateData.type = type;
    if (paymentCycle) updateData.paymentCycle = paymentCycle;
    if (wageAmount !== undefined) updateData.wageAmount = Number(wageAmount);
    if (status) updateData.status = status;

    const updatedLabour = await Labour.findOneAndUpdate(
      { _id: id, organization: req.user.organizationId },
      { $set: updateData },
      { new: true }
    );

    if (!updatedLabour) {
      return NextResponse.json({ message: "Labourer not found or unauthorized" }, { status: 404 });
    }

    return NextResponse.json(updatedLabour);
  } catch (error) {
    console.error("PUT /api/labour/[id] error:", error);
    return NextResponse.json({ message: "Error updating labourer" }, { status: 500 });
  }
});

export const DELETE = withAuth(async function (req, { params }) {
  try {
    await dbConnect();
    const { id } = params;

    if (!id) {
      return NextResponse.json({ message: "Labour ID is required" }, { status: 400 });
    }

    const labour = await Labour.findOne({ _id: id, organization: req.user.organizationId });
    
    if (!labour) {
      return NextResponse.json({ message: "Labourer not found or unauthorized" }, { status: 404 });
    }

    // Delete the labourer
    await Labour.findByIdAndDelete(id);

    // Also clean up their attendance records
    await LabourAttendance.deleteMany({ labour: id });

    return NextResponse.json({ message: "Labourer deleted successfully" });
  } catch (error) {
    console.error("DELETE /api/labour/[id] error:", error);
    return NextResponse.json({ message: "Error deleting labourer" }, { status: 500 });
  }
});
