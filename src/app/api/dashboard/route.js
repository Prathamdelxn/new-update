import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Project from "@/models/Project";
import Milestone from "@/models/Milestone";
import Risk from "@/models/Risk";
import { withAuth } from "@/lib/middleware";
import User from "@/models/User";

export const GET = withAuth(async function (req) {
  try {
    await dbConnect();

    const orgId = req.user.organizationId;
    const userDoc = await User.findById(req.user.id).populate("role");
    const isAdmin = userDoc?.role?.name === "Admin" || req.user.role === "Admin";

    let projectQuery = { organization: orgId };
    if (!isAdmin) {
      const userProjectIds = (userDoc?.projects || []).map(p => p.project);
      projectQuery.$or = [
        { _id: { $in: userProjectIds } },
        { "members.user": userDoc._id },
      ];
    }

    const projects = await Project.find(projectQuery, "name status priority startDate endDate").lean();
    const projectIds = projects.map((p) => p._id);

    // --- Project stats ---
    const statusCounts = {};
    projects.forEach((p) => {
      statusCounts[p.status] = (statusCounts[p.status] || 0) + 1;
    });

    // --- Milestone / Task stats ---
    const milestones = await Milestone.find(
      { project: { $in: projectIds }, organization: orgId },
      "tasks dueDate status"
    ).lean();

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    let totalTasks = 0, completedTasks = 0, overdueTasks = 0, dueTodayTasks = 0;
    const dueTodayList = [];

    milestones.forEach((m) => {
      (m.tasks || []).forEach((t) => {
        totalTasks++;
        if (t.isCompleted) {
          completedTasks++;
        } else {
          const end = t.endDate ? new Date(t.endDate) : null;
          if (end) {
            if (end < today) overdueTasks++;
            else if (end >= today && end < tomorrow) {
              dueTodayTasks++;
              dueTodayList.push({
                title: t.title,
                milestoneId: m._id,
                projectId: m.project,
                endDate: t.endDate,
              });
            }
          }
        }
      });
    });

    // --- Risk stats ---
    const risks = await Risk.find(
      { project: { $in: projectIds }, organization: orgId },
      "title status impact project"
    ).lean();

    const riskStatusCounts = { Critical: 0, Active: 0, Monitored: 0, Resolved: 0 };
    risks.forEach((r) => {
      if (riskStatusCounts[r.status] !== undefined) riskStatusCounts[r.status]++;
    });

    const criticalRisks = risks
      .filter((r) => r.status === "Critical" || r.impact === "Very High")
      .slice(0, 5)
      .map((r) => ({ title: r.title, status: r.status, impact: r.impact, projectId: r.project }));

    // --- Recent projects ---
    const recentProjects = projects.slice(-5).reverse().map((p) => ({
      _id: p._id,
      name: p.name,
      status: p.status,
      priority: p.priority,
      startDate: p.startDate,
      endDate: p.endDate,
    }));

    return NextResponse.json({
      projectStats: {
        total: projects.length,
        statusCounts,
      },
      taskStats: {
        total: totalTasks,
        completed: completedTasks,
        overdue: overdueTasks,
        dueToday: dueTodayTasks,
        dueTodayList: dueTodayList.slice(0, 5),
      },
      riskStats: {
        total: risks.length,
        statusCounts: riskStatusCounts,
        criticalRisks,
      },
      recentProjects,
    });
  } catch (error) {
    console.error("GET /api/dashboard error:", error);
    return NextResponse.json({ message: "Error fetching dashboard data" }, { status: 500 });
  }
});
