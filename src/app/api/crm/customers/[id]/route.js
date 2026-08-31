import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Customer from "@/models/Customer";
import Activity from "@/models/Activity";
import { withAuth } from "@/lib/middleware";

/**
 * PATCH: Update a Customer (e.g. Status change)
 */
export const PATCH = withAuth(async function (req, { params }) {
  try {
    await dbConnect();
    const { id } = await params;
    const data = await req.json();

    const existing = await Customer.findOne({ _id: id, organization: req.user.organizationId });
    if (!existing) {
      return NextResponse.json({ message: "Customer not found" }, { status: 404 });
    }

    if (existing.status === "Won" || existing.status === "Converted" || existing.linkedProject) {
      return NextResponse.json({ message: "This lead has been converted to an active project and is locked from modification." }, { status: 400 });
    }

    const customer = await Customer.findOneAndUpdate(
      { _id: id, organization: req.user.organizationId },
      { $set: data },
      { new: true }
    );

    // If status was changed, log an activity automatically
    if (data.status) {
      await Activity.create({
        customer: customer._id,
        user: req.user.id,
        organization: req.user.organizationId,
        type: "Status Change",
        status: "Completed",
        remarks: `Lead moved to stage: ${data.status}`,
        completedDate: new Date()
      });
    }

    return NextResponse.json(customer);
  } catch (error) {
    console.error("Update customer error:", error);
    return NextResponse.json({ message: "Error updating customer" }, { status: 500 });
  }
});
