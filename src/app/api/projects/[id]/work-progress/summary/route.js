import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import WorkProgress from "@/models/WorkProgress";
import { withPermission } from "@/lib/middleware";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function dateStr(d) {
  return d.toISOString().split("T")[0];
}

function addDays(d, n) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

// GET /api/projects/[id]/work-progress/summary
// Returns daily capacity, 7-day chart data, and 4-week monthly chart data
export const GET = withPermission(async function (req, { params }) {
  try {
    const { id } = await params;
    await dbConnect();

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = dateStr(today);

    const monthAgoStr = dateStr(new Date(Date.now() - 29 * 24 * 60 * 60 * 1000));

    // Fetch last 30 days of logs in one query
    const allLogs = await WorkProgress.find({
      project: id,
      organization: req.user.organizationId,
      date: { $gte: monthAgoStr, $lte: todayStr },
    }).sort({ date: 1 });

    // ── Daily (today) ──────────────────────────────────────────────────────
    const todayLogs = allLogs.filter((l) => l.date === todayStr);
    const todayUsed = todayLogs.reduce((s, l) => s + l.progressPercent, 0);

    // ── Weekly (last 7 days, one bar per day) ─────────────────────────────
    const weeklyData = [];
    for (let i = 6; i >= 0; i--) {
      const d = addDays(today, -i);
      const ds = dateStr(d);
      const dayLogs = allLogs.filter((l) => l.date === ds);
      const total = dayLogs.reduce((s, l) => s + l.progressPercent, 0);
      weeklyData.push({
        date: ds,
        label: i === 0 ? "Today" : DAY_LABELS[d.getDay()],
        value: total,
        count: dayLogs.length,
      });
    }

    // ── Monthly (last 4 weeks, one bar per week) ───────────────────────────
    const monthlyData = [];
    for (let w = 3; w >= 0; w--) {
      const weekStart = addDays(today, -(w * 7 + 6));
      const weekEnd   = addDays(today, -(w * 7));
      const wsStr = dateStr(weekStart);
      const weStr = dateStr(weekEnd);
      const weekLogs = allLogs.filter((l) => l.date >= wsStr && l.date <= weStr);
      const total = weekLogs.reduce((s, l) => s + l.progressPercent, 0);
      const weekNum = 4 - w;
      monthlyData.push({
        weekStart: wsStr,
        weekEnd: weStr,
        label: `Wk ${weekNum}`,
        value: total,
        count: weekLogs.length,
      });
    }

    // ── Per-milestone breakdown (overall) ─────────────────────────────────
    const milestoneMap = {};
    allLogs.forEach((l) => {
      const key = l.milestoneName || "General";
      if (!milestoneMap[key]) milestoneMap[key] = { name: key, total: 0, days: new Set() };
      milestoneMap[key].total += l.progressPercent;
      milestoneMap[key].days.add(l.date);
    });
    const milestoneBreakdown = Object.values(milestoneMap).map((m) => ({
      name: m.name,
      total: m.total,
      activeDays: m.days.size,
    }));

    return NextResponse.json({
      todayUsed,
      todayRemaining: Math.max(0, 100 - todayUsed),
      todayCount: todayLogs.length,
      totalLogs: allLogs.length,
      weeklyData,
      monthlyData,
      milestoneBreakdown,
    });
  } catch (err) {
    return NextResponse.json({ message: err.message }, { status: 500 });
  }
}, "workprogress:view");
