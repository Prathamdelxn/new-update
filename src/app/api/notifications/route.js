import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Notification from '@/models/Notification';
import { verifyAccessToken } from '@/lib/auth';

export async function GET(req) {
  try {
    await dbConnect();
    const token = req.headers.get('authorization')?.split(' ')[1];
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    
    const decoded = verifyAccessToken(token);
    if (!decoded) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const notifications = await Notification.find({ user: decoded.id })
      .sort({ createdAt: -1 })
      .limit(50)
      .populate('project', 'name');

    return NextResponse.json(notifications || []);
  } catch (error) {
    console.error('Notification GET error:', error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(req) {
  try {
    await dbConnect();
    const token = req.headers.get('authorization')?.split(' ')[1];
    const decoded = verifyAccessToken(token);
    if (!decoded) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await req.json();
    if (id) {
      await Notification.findByIdAndUpdate(id, { isRead: true });
    } else {
      // Mark all as read
      await Notification.updateMany({ user: decoded.id, isRead: false }, { isRead: true });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Notification PATCH error:', error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
