import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Vendor from "@/models/Vendor";
import { withAuth } from "@/lib/middleware";

export const PUT = withAuth(async function (req, { params }) {
  try {
    await dbConnect();
    const { id } = params;
    const updateData = await req.json();

    const vendor = await Vendor.findOne({ _id: id, organization: req.user.organizationId });

    if (!vendor) {
      return NextResponse.json({ message: "Vendor not found" }, { status: 404 });
    }

    const updatedVendor = await Vendor.findByIdAndUpdate(id, updateData, { new: true, runValidators: true });

    return NextResponse.json(updatedVendor);
  } catch (error) {
    console.error("PUT /api/vendors/[id] error:", error);
    return NextResponse.json({ message: "Error updating vendor" }, { status: 500 });
  }
});

export const DELETE = withAuth(async function (req, { params }) {
  try {
    await dbConnect();
    const { id } = params;

    const vendor = await Vendor.findOne({ _id: id, organization: req.user.organizationId });

    if (!vendor) {
      return NextResponse.json({ message: "Vendor not found" }, { status: 404 });
    }

    await Vendor.findByIdAndDelete(id);

    return NextResponse.json({ message: "Vendor deleted successfully" });
  } catch (error) {
    console.error("DELETE /api/vendors/[id] error:", error);
    return NextResponse.json({ message: "Error deleting vendor" }, { status: 500 });
  }
});
