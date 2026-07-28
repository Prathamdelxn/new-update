import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Vendor from "@/models/Vendor";
import { withAuth } from "@/lib/middleware";

export const GET = withAuth(async function (req) {
  try {
    await dbConnect();
    
    // Fetch vendors for the user's organization
    const vendors = await Vendor.find({ organization: req.user.organizationId }).sort({ createdAt: -1 });

    return NextResponse.json(vendors);
  } catch (error) {
    console.error("GET /api/vendors error:", error);
    return NextResponse.json({ message: "Error fetching vendors" }, { status: 500 });
  }
});

export const POST = withAuth(async function (req) {
  try {
    await dbConnect();
    const { name, contactPerson, email, phoneNumber, status } = await req.json();

    if (!name) {
      return NextResponse.json({ message: "Vendor name is required" }, { status: 400 });
    }

    const vendor = new Vendor({
      name,
      contactPerson,
      email,
      phoneNumber,
      status: status || "Active",
      organization: req.user.organizationId,
    });

    await vendor.save();

    return NextResponse.json(vendor, { status: 201 });
  } catch (error) {
    console.error("POST /api/vendors error:", error);
    return NextResponse.json({ message: "Error creating vendor" }, { status: 500 });
  }
});
