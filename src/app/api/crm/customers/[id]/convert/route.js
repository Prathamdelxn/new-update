import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { withAuth } from '@/lib/middleware';
import Customer from '@/models/Customer';
import Project from '@/models/Project';

export const POST = withAuth(async function(req, { params }) {
  try {
    const { id } = params;
    const { startDate, remarks } = await req.json();

    await dbConnect();

    // Find the customer
    const customer = await Customer.findOne({
      _id: id,
      organization: req.user.organizationId
    });

    if (!customer) {
      return NextResponse.json({ success: false, message: 'Customer not found' }, { status: 404 });
    }

    // Ensure not already won
    if (customer.status === 'Won') {
      return NextResponse.json({ success: false, message: 'Customer is already converted to a Project' }, { status: 400 });
    }

    // Determine accepted quotation (use last one if multiple)
    let acceptedQuotation = null;
    if (customer.quotations && customer.quotations.length > 0) {
      // Find one marked Accepted, or just take the last one
      acceptedQuotation = customer.quotations.find(q => q.status === 'Accepted') || customer.quotations[customer.quotations.length - 1];
    }

    const totalBudget = acceptedQuotation ? (acceptedQuotation.grandTotal || 0) : 0;
    const version = acceptedQuotation ? (acceptedQuotation.version || 1) : 1;

    // Create the Project
    const newProject = await Project.create({
      customer: customer._id,
      projectName: `${customer.name}'s ${customer.propertyType || 'Interior'} Project`,
      totalBudget: totalBudget,
      agreedQuotationVersion: version,
      status: 'Planning',
      startDate: new Date(startDate || Date.now()),
      amountPaid: 0,
      assignedTo: customer.designerAssigned ? [customer.designerAssigned] : (customer.assignedSalesExecutive ? [customer.assignedSalesExecutive] : []),
      organization: req.user.organizationId,
      createdBy: req.user.id
    });

    // Update Customer
    customer.status = 'Won';
    customer.linkedProject = newProject._id;
    if (remarks) {
      customer.remarks = (customer.remarks ? customer.remarks + '\n' : '') + `Conversion Remarks: ${remarks}`;
    }
    
    if (acceptedQuotation) {
      acceptedQuotation.status = 'Accepted';
    }

    await customer.save();

    return NextResponse.json({ success: true, project: newProject, message: 'Lead converted to Project successfully' });

  } catch (error) {
    console.error('Convert to Project Error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
});
