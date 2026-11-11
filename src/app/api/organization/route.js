import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Organization from "@/models/Organization";
import { withAuth } from "@/lib/middleware";

export const GET = withAuth(async function (req) {
  try {
    await dbConnect();
    const org = await Organization.findById(req.user.organizationId).populate("owner", "name email");
    if (!org) {
      return NextResponse.json({ message: "Organization not found" }, { status: 404 });
    }
    return NextResponse.json({ organization: org });
  } catch (error) {
    return NextResponse.json({ message: "Error fetching organization" }, { status: 500 });
  }
});

export const PATCH = withAuth(async function (req) {
  try {
    await dbConnect();
    if (req.user.role !== "Admin") {
      return NextResponse.json({ message: "Forbidden: Only an Admin can update organization settings" }, { status: 403 });
    }
    const { name } = await req.json();
    if (!name || !name.trim()) {
      return NextResponse.json({ message: "Organization name is required" }, { status: 400 });
    }
    const org = await Organization.findByIdAndUpdate(
      req.user.organizationId,
      { name: name.trim() },
      { new: true }
    );
    return NextResponse.json({ message: "Organization updated successfully", organization: org });
  } catch (error) {
    return NextResponse.json({ message: "Error updating organization" }, { status: 500 });
  }
});

