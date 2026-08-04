import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { withAuth } from '@/lib/middleware';
import Activity from '@/models/Activity';

export const GET = withAuth(async function(req) {
  try {
    await dbConnect();
    const { searchParams } = new URL(req.url);
    const customerId = searchParams.get('customerId');

    if (!customerId) {
      return NextResponse.json({ success: false, message: 'Customer ID is required' }, { status: 400 });
    }

    const activities = await Activity.find({ 
      customer: customerId, 
      organization: req.user.organizationId 
    })
    .populate('user', 'name')
    .sort({ createdAt: -1 });

    return NextResponse.json(activities);
  } catch (error) {
    console.error('Activity GET Error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
});

export const POST = withAuth(async function(req) {
  try {
    await dbConnect();
    const data = await req.json();

    const activity = await Activity.create({
      ...data,
      user: req.user.id,
      organization: req.user.organizationId,
      completedDate: data.status === 'Completed' ? new Date() : undefined
    });

    await activity.populate('user', 'name');
    return NextResponse.json(activity, { status: 201 });
  } catch (error) {
    console.error('Activity POST Error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
});
// force rebuild
