import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Customer from "@/models/Customer";
import { withAuth } from "@/lib/middleware";

/**
 * GET: Fetch all customers/leads
 */
export const GET = withAuth(async function (req) {
  try {
    await dbConnect();
    
    // Optional filters from query params
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    
    const query = { organization: req.user.organizationId };
    if (status) query.status = status;
    
    const customers = await Customer.find(query)
      .populate("assignedSalesExecutive", "-password")
      .populate("designerAssigned", "-password")
      .sort({ createdAt: -1 });

    // Mongoose field encryption doesn't automatically decrypt populated subdocuments
    customers.forEach(customer => {
      if (customer.assignedSalesExecutive && typeof customer.assignedSalesExecutive.decryptFieldsSync === 'function') {
        customer.assignedSalesExecutive.decryptFieldsSync();
      }
      if (customer.designerAssigned && typeof customer.designerAssigned.decryptFieldsSync === 'function') {
        customer.designerAssigned.decryptFieldsSync();
      }
    });

    return NextResponse.json(customers);
  } catch (error) {
    console.error("Fetch customers error:", error);
    return NextResponse.json(
      { message: "Error fetching customers" },
      { status: 500 }
    );
  }
});

/**
 * POST: Create a new Lead/Customer
 */
export const POST = withAuth(async function (req) {
  try {
    await dbConnect();
    const data = await req.json();

    // Auto-generate Lead Number (e.g. LD-1001)
    const count = await Customer.countDocuments({ organization: req.user.organizationId });
    const leadNumber = `LD-${1001 + count}`;

    const newCustomer = new Customer({
      ...data,
      leadNumber,
      organization: req.user.organizationId,
      createdBy: req.user.id,
      status: "New Lead", // Default status
    });

    await newCustomer.save();

    return NextResponse.json(newCustomer, { status: 201 });
  } catch (error) {
    console.error("Create customer error:", error);
    
    // Handle Mongoose Validation Errors
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map(err => err.message);
      return NextResponse.json({ message: messages.join(", ") }, { status: 400 });
    }

    // Handle duplicate key error for unique fields
    if (error.code === 11000) {
      return NextResponse.json({ message: "Duplicate entry found for unique field" }, { status: 400 });
    }

    return NextResponse.json(
      { message: "Error creating customer lead" },
      { status: 500 }
    );
  }
});
