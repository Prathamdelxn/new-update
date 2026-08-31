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

    const { startDate, remarks, quotationIndex } = body;

    // Determine accepted quotation (use quotationIndex if passed, or find Accepted/Approved, or fallback to latest)
    let acceptedQuotation = null;
    if (typeof quotationIndex === 'number' && customer.quotations?.[quotationIndex]) {
      acceptedQuotation = customer.quotations[quotationIndex];
    } else if (customer.quotations && customer.quotations.length > 0) {
      acceptedQuotation =
        customer.quotations.find((q) => q.status === 'Accepted' || q.status === 'Approved') ||
        customer.quotations[customer.quotations.length - 1];
    }

    let totalBudget = 0;

    const parseNum = (val) => {
      if (typeof val === 'number') return isNaN(val) ? 0 : val;
      if (typeof val === 'string') {
        const cleaned = val.replace(/[^0-9.]/g, '');
        const n = parseFloat(cleaned);
        return isNaN(n) ? 0 : n;
      }
      return 0;
    };

    if (acceptedQuotation) {
      if (parseNum(acceptedQuotation.grandTotal) > 0) {
        totalBudget = parseNum(acceptedQuotation.grandTotal);
      } else if (parseNum(acceptedQuotation.totalAmount) > 0) {
        totalBudget = parseNum(acceptedQuotation.totalAmount);
      } else if (parseNum(acceptedQuotation.subtotal) > 0) {
        totalBudget = parseNum(acceptedQuotation.subtotal);
      } else if (parseNum(acceptedQuotation.total) > 0) {
        totalBudget = parseNum(acceptedQuotation.total);
      } else if (Array.isArray(acceptedQuotation.items) && acceptedQuotation.items.length > 0) {
        totalBudget = acceptedQuotation.items.reduce((sum, it) => sum + (parseNum(it.total) || parseNum(it.amount) || (parseNum(it.quantity || 1) * parseNum(it.unitPrice || it.rate || it.price))), 0);
      }
    }

    if (!totalBudget && customer.quotations && customer.quotations.length > 0) {
      for (const q of customer.quotations) {
        const qBudget = parseNum(q.grandTotal) || parseNum(q.totalAmount) || parseNum(q.subtotal) || parseNum(q.total) ||
          (Array.isArray(q.items) ? q.items.reduce((sum, it) => sum + (parseNum(it.total) || parseNum(it.amount) || (parseNum(it.quantity || 1) * parseNum(it.unitPrice || it.rate || it.price))), 0) : 0);
        if (qBudget > 0) {
          totalBudget = qBudget;
          break;
        }
      }
    }

    if (!totalBudget && customer.boqs && customer.boqs.length > 0) {
      for (let i = customer.boqs.length - 1; i >= 0; i--) {
        const boq = customer.boqs[i];
        if (parseNum(boq?.totalAmount) > 0) {
          totalBudget = parseNum(boq.totalAmount);
          break;
        } else if (Array.isArray(boq?.items) && boq.items.length > 0) {
          const boqSum = boq.items.reduce((sum, it) => sum + (parseNum(it.amount) || (parseNum(it.quantity || 1) * parseNum(it.rate || it.unitPrice))), 0);
          if (boqSum > 0) {
            totalBudget = boqSum;
            break;
          }
        }
      }
    }

    if (!totalBudget && customer.budgetRange) {
      totalBudget = parseNum(customer.budgetRange);
    }

    const version = acceptedQuotation ? (acceptedQuotation.version || 1) : 1;

    // Create the Project
    const newProject = await Project.create({
      customer: customer._id,
      projectName: `${customer.name}'s ${customer.propertyType || 'Construction'} Project`,
      totalBudget: totalBudget,
      budget: totalBudget,
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
      customer.markModified('quotations');
    }

    await customer.save();

    return NextResponse.json({ success: true, project: newProject, message: 'Lead converted to Project successfully' });

  } catch (error) {
    console.error('Convert to Project Error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
});
