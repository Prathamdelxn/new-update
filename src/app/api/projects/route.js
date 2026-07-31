import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Project from "@/models/Project";
import Customer from "@/models/Customer";
import { withAuth } from "@/lib/middleware"; // trigger rebuild

export const POST = withAuth(async function (req) {
  try {
    await dbConnect();
    const data = await req.json();

    const { customerId, quotationIndex } = data;

    if (!customerId || quotationIndex === undefined) {
      return NextResponse.json({ message: "Customer ID and Quotation Index are required" }, { status: 400 });
    }

    // 1. Find the customer
    const customer = await Customer.findOne({ 
      _id: customerId, 
      organization: req.user.organizationId 
    });

    if (!customer) {
      return NextResponse.json({ message: "Customer not found" }, { status: 404 });
    }

    // 2. Validate Quotation
    const acceptedQuotation = customer.quotations[quotationIndex];
    if (!acceptedQuotation) {
      return NextResponse.json({ message: "Quotation not found" }, { status: 404 });
    }
    if (acceptedQuotation.status !== 'Accepted') {
      return NextResponse.json({ message: "Only accepted quotations can be converted to projects" }, { status: 400 });
    }

    // 3. Create the Project
    const project = await Project.create({
      customer: customer._id,
      projectName: `${customer.name}'s Property`,
      totalBudget: acceptedQuotation.grandTotal,
      agreedQuotationVersion: acceptedQuotation.version,
      organization: req.user.organizationId,
      createdBy: req.user.id
    });

    // 4. Update Customer status to Converted if not already
    if (customer.status !== 'Converted') {
      customer.status = 'Converted';
      await customer.save();
    }

    return NextResponse.json(project, { status: 201 });

  } catch (error) {
    console.error("Create Project Error:", error);
    return NextResponse.json(
      { message: "Failed to create project", error: error.message },
      { status: 500 }
    );
  }
});

export const GET = withAuth(async function (req) {
  try {
    await dbConnect();

    const projects = await Project.find({ organization: req.user.organizationId })
      .populate('customer', 'name email mobileNumber propertyType')
      .populate('assignedTo', 'name')
      .sort({ createdAt: -1 });

    // Decrypt populated customer fields if using encryption
    projects.forEach(proj => {
      if (proj.customer && typeof proj.customer.decryptFieldsSync === 'function') {
        proj.customer.decryptFieldsSync();
      }
      if (proj.assignedTo && Array.isArray(proj.assignedTo)) {
        proj.assignedTo.forEach(user => {
          if (user && typeof user.decryptFieldsSync === 'function') {
            user.decryptFieldsSync();
          }
        });
      }
    });

    return NextResponse.json(projects, { status: 200 });

  } catch (error) {
    console.error("Fetch Projects Error:", error);
    return NextResponse.json(
      { message: "Failed to fetch projects" },
      { status: 500 }
    );
  }
});
