import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import WorkProgress from "@/models/WorkProgress";
import { withPermission } from "@/lib/middleware";
import { emitToProject } from "@/lib/socket-server";

function todayStr() {
  return new Date().toISOString().split("T")[0];
}

// GET /api/projects/[id]/work-progress?period=today|week|month&milestoneId=xxx
export const GET = withPermission(async function (req, { params }) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const period = searchParams.get("period") || "week";
    const milestoneId = searchParams.get("milestoneId");
    await dbConnect();

    const today = todayStr();
    let dateFilter = {};
    if (period === "today") {
      dateFilter = { date: today };
    } else if (period === "week") {
      const weekAgo = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
      dateFilter = { date: { $gte: weekAgo, $lte: today } };
    } else if (period === "month") {
      const monthAgo = new Date(Date.now() - 29 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
      dateFilter = { date: { $gte: monthAgo, $lte: today } };
    } else if (period === "all") {
      // no date filter
    }

    const query = { project: id, organization: req.user.organizationId, ...dateFilter };
    if (milestoneId) query.milestone = milestoneId;

    const logs = await WorkProgress.find(query).sort({ date: -1, createdAt: -1 });
    return NextResponse.json(logs);
  } catch (err) {
    return NextResponse.json({ message: err.message }, { status: 500 });
  }
}, "workprogress:view");

// POST /api/projects/[id]/work-progress
// Progress % is now auto-derived from task completion — only notes + photos logged here
export const POST = withPermission(async function (req, { params }) {
  try {
    const { id } = await params;
    await dbConnect();

    const { milestoneId, milestoneName, description, photos, date } = await req.json();
    const logDate = date || todayStr();

    if (!description?.trim()) {
      return NextResponse.json({ message: "Description is required" }, { status: 400 });
    }
    if (!photos || photos.length === 0) {
      return NextResponse.json({ message: "At least one site photo is required" }, { status: 400 });
    }

    const log = await WorkProgress.create({
      project: id,
      organization: req.user.organizationId,
      milestone: milestoneId || null,
      milestoneName: milestoneName || "General",
      description: description.trim(),
      progressPercent: 0, // kept for schema compat; derived from tasks on frontend
      photos,
      date: logDate,
      loggedBy: req.user.id,
      loggedByName: req.user.name || "User",
    });

    emitToProject(id, 'workprogress:created', { logId: log._id.toString() });
    return NextResponse.json(log, { status: 201 });
  } catch (err) {
    return NextResponse.json({ message: err.message }, { status: 500 });
  }
}, "workprogress:create");

// DELETE /api/projects/[id]/work-progress?logId=xxx  (requires workprogress:delete)
export const DELETE = withPermission(async function (req, { params }) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const logId = searchParams.get("logId");
    if (!logId) return NextResponse.json({ message: "logId required" }, { status: 400 });
    await dbConnect();
    await WorkProgress.findOneAndDelete({ _id: logId, project: id, organization: req.user.organizationId });
    emitToProject(id, 'workprogress:deleted', { logId });
    return NextResponse.json({ message: "Deleted" });
  } catch (err) {
    return NextResponse.json({ message: err.message }, { status: 500 });
  }
}, "workprogress:delete");
