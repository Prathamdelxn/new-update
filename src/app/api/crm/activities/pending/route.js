import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { withAuth } from '@/lib/middleware';
import Activity from '@/models/Activity';

export const GET = withAuth(async function(req) {
  try {
    await dbConnect();
    const pendingActivities = await Activity.find({
      organization: req.user.organizationId,
      status: "Pending"
    })
    .populate({
      path: 'customer',
      select: 'name mobileNumber status assignedSalesExecutive',
      populate: { path: 'assignedSalesExecutive', select: '-password' }
    })
    .populate('user', 'name')
    .sort({ scheduledDate: 1 });

    // Decrypt names for assigned users if field encryption is used
    pendingActivities.forEach(act => {
      if (act.customer && act.customer.assignedSalesExecutive && typeof act.customer.assignedSalesExecutive.decryptFieldsSync === 'function') {
        act.customer.assignedSalesExecutive.decryptFieldsSync();
      }
    });

    return NextResponse.json(pendingActivities);
  } catch (error) {
    console.error('Pending Follow-ups Error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
});
