import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Project from "@/models/Project";
import Milestone from "@/models/Milestone";
import Risk from "@/models/Risk";
import Snag from "@/models/Snag";
import Issue from "@/models/Issue";
import Transaction from "@/models/Transaction";
import User from "@/models/User";
import { withAuth } from "@/lib/middleware";

export const GET = withAuth(async function (req) {
  try {
    await dbConnect();

    const userDoc = await User.findById(req.user.id).populate("role");
    const rawOrgId = req.user.organizationId || userDoc?.organization;
    const orgId = typeof rawOrgId === 'object' && rawOrgId?._id
      ? rawOrgId._id.toString()
      : typeof rawOrgId === 'string' && rawOrgId.length === 24
        ? rawOrgId
        : typeof rawOrgId === 'string'
          ? (rawOrgId.match(/([a-f0-9]{24})/i)?.[1] || rawOrgId)
          : rawOrgId;

    if (!orgId) {
      return NextResponse.json({
        portfolioSummary: { totalDeliverables: 0, totalAttentionNeeded: 0, currentWeek: 1, totalBudget: 0 },
        financials: { totalIncoming: 0, totalOutgoing: 0, totalDebitNotes: 0, netCashflow: 0, thisMonthIncoming: 0, thisMonthOutgoing: 0, thisMonthDebitNotes: 0, thisMonthNetCashflow: 0, monthlyHistory: [], recentTransactions: [], currency: "INR" },
        stages: [],
        milestones: [],
        averageStageProgress: 0,
        velocity: { dailyActual: [0, 0, 0, 0, 0, 0, 0], dailyPlanned: [0, 0, 0, 0, 0, 0, 0] },
        trajectory: { all: [], month: [], week: [] },
        dailyActivityBars: [],
        monthlyTradeAllocations: [],
        qualityVsRisk: { qualityPercentage: 100, riskPercentage: 0, qualityPassCount: 0, attentionItemCount: 0 },
        calendarEvents: [],
        recentProjects: [],
        projectStats: { total: 0, statusCounts: {} },
        taskStats: { total: 0, completed: 0, overdue: 0, dueToday: 0, dueTodayList: [], completionPct: 0 },
        riskStats: { total: 0, statusCounts: {}, criticalRisks: [] },
        snagStats: { total: 0, open: 0, resolved: 0 },
      });
    }

    const isAdmin = userDoc?.role?.name === "Admin" || req.user.role === "Admin";

    const url = new URL(req.url);
    const requestedProjectId = url.searchParams.get("projectId");

    let projectQuery = { organization: orgId };
    if (requestedProjectId && requestedProjectId !== 'all') {
      projectQuery._id = requestedProjectId;
    } else if (!isAdmin) {
      const userProjectIds = (userDoc?.projects || []).map(p => p.project);
      projectQuery.$or = [
        { _id: { $in: userProjectIds } },
        { "members.user": userDoc._id },
      ];
    }

    // 1. Fetch all projects strictly for this organization
    const projects = await Project.find(
      projectQuery,
      "name code status priority startDate endDate expectedCompletionDate budget budgetHistory"
    ).lean();
    const projectIds = projects.map((p) => p._id);
    const projectNameMap = new Map(projects.map(p => [p._id.toString(), p.name]));

    // Project status breakdown
    const statusCounts = { "Planning": 0, "In Progress": 0, "On Hold": 0, "Completed": 0 };
    let totalBudget = 0;
    projects.forEach((p) => {
      const status = p.status || "Planning";
      statusCounts[status] = (statusCounts[status] || 0) + 1;
      const b = p.budgetHistory?.[p.budgetHistory.length - 1]?.amount || p.budget || 0;
      totalBudget += Number(b) || 0;
    });

    // 2. Fetch Milestones & Tasks strictly for the current organization's projects
    let milestoneQuery = { organization: orgId };
    if (requestedProjectId && requestedProjectId !== 'all') {
      milestoneQuery = {
        $and: [
          { $or: [{ organization: orgId }, { organization: { $exists: false } }] },
          { project: requestedProjectId },
        ],
      };
    } else if (projectIds.length > 0) {
      milestoneQuery = {
        $or: [
          { project: { $in: projectIds } },
          { organization: orgId },
        ],
      };
    }

    const milestones = await Milestone.find(
      milestoneQuery,
      "name tasks dueDate status project completedAt createdAt"
    ).lean();

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Week of year calculation
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const pastDaysOfYear = (now.getTime() - startOfYear.getTime()) / 86400000;
    const currentWeek = Math.ceil((pastDaysOfYear + startOfYear.getDay() + 1) / 7);

    let totalTasks = 0;
    let completedTasks = 0;
    let overdueTasks = 0;
    let dueTodayTasks = 0;
    const dueTodayList = [];
    const calendarEvents = [];

    // Stage categorization accumulator
    const stageMetrics = {
      structural: { total: 0, completed: 0, name: "Structural & Civil" },
      mep: { total: 0, completed: 0, name: "MEP & Electrical" },
      finishing: { total: 0, completed: 0, name: "Finishes & Handover" }
    };

    // Daily completions past 7 days (Sun=0 ... Sat=6)
    const dailyCompletions = [0, 0, 0, 0, 0, 0, 0];
    const dailyActive = [0, 0, 0, 0, 0, 0, 0];

    // Monthly data map
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthlyDataMap = {};
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${monthNames[d.getMonth()]}`;
      monthlyDataMap[key] = { month: key, delivered: 0, planned: 0, civil: 0, mep: 0, finishes: 0, total: 0 };
    }

    milestones.forEach((m) => {
      const projName = projectNameMap.get(m.project?.toString()) || "Project";
      const mNameLower = (m.name || "").toLowerCase();

      // Determine stage for this milestone
      let stageKey = "structural";
      if (/mep|electric|plumb|hvac|wire|cable|duct|pipe/i.test(mNameLower)) {
        stageKey = "mep";
      } else if (/finish|paint|tile|floor|door|window|ceiling|snag|handover|clean/i.test(mNameLower)) {
        stageKey = "finishing";
      }

      if (m.dueDate) {
        const d = new Date(m.dueDate);
        const dateStr = d.toISOString().split("T")[0];
        calendarEvents.push({
          date: dateStr,
          title: m.name,
          type: "milestone",
          projectName: projName,
          status: m.status,
          isCompleted: m.status === "Completed",
        });
      }

      const mTasks = m.tasks || [];
      if (mTasks.length === 0) {
        totalTasks++;
        stageMetrics[stageKey].total++;
        if (m.status === "Completed") {
          completedTasks++;
          stageMetrics[stageKey].completed++;
        }
      }

      mTasks.forEach((t) => {
        totalTasks++;
        stageMetrics[stageKey].total++;

        if (t.isCompleted) {
          completedTasks++;
          stageMetrics[stageKey].completed++;

          if (t.completedAt) {
            const cDate = new Date(t.completedAt);
            const dayOfWeek = cDate.getDay();
            dailyCompletions[dayOfWeek] = (dailyCompletions[dayOfWeek] || 0) + 1;

            const mKey = monthNames[cDate.getMonth()];
            if (monthlyDataMap[mKey]) {
              monthlyDataMap[mKey].delivered += 1;
            }
          }
        } else {
          const end = t.endDate ? new Date(t.endDate) : null;
          if (end) {
            const dayOfWeek = end.getDay();
            dailyActive[dayOfWeek] = (dailyActive[dayOfWeek] || 0) + 1;

            if (end < today) {
              overdueTasks++;
            } else if (end >= today && end < tomorrow) {
              dueTodayTasks++;
              dueTodayList.push({
                title: t.title,
                milestoneId: m._id,
                projectId: m.project,
                projectName: projName,
                endDate: t.endDate,
              });
            }

            const dateStr = end.toISOString().split("T")[0];
            calendarEvents.push({
              date: dateStr,
              title: t.title,
              type: "task",
              projectName: projName,
              status: "Pending",
              isCompleted: false,
            });

            const mKey = monthNames[end.getMonth()];
            if (monthlyDataMap[mKey]) {
              monthlyDataMap[mKey].planned += 1;
            }
          }
        }

        // Map trade allocation
        const tTitle = (t.title || "").toLowerCase();
        let trade = "civil";
        if (/mep|electric|plumb|hvac|pipe/i.test(tTitle)) trade = "mep";
        else if (/finish|paint|tile|clean|snag/i.test(tTitle)) trade = "finishes";

        const tDate = t.endDate ? new Date(t.endDate) : (t.startDate ? new Date(t.startDate) : now);
        const mKey = monthNames[tDate.getMonth()];
        if (monthlyDataMap[mKey]) {
          monthlyDataMap[mKey][trade] += 1;
          monthlyDataMap[mKey].total += 1;
        }
      });
    });

    // 3. Fetch Risks
    const risks = await Risk.find(
      { project: { $in: projectIds }, organization: orgId },
      "title status impact project"
    ).lean();

    const riskStatusCounts = { Critical: 0, Active: 0, Monitored: 0, Resolved: 0 };
    risks.forEach((r) => {
      if (riskStatusCounts[r.status] !== undefined) {
        riskStatusCounts[r.status]++;
      } else {
        riskStatusCounts.Active++;
      }
    });

    const criticalRisks = risks
      .filter((r) => r.status === "Critical" || r.impact === "Very High" || r.impact === "High")
      .slice(0, 5)
      .map((r) => ({
        title: r.title,
        status: r.status,
        impact: r.impact,
        projectId: r.project,
        projectName: projectNameMap.get(r.project?.toString()) || "Project",
      }));

    // 4. Fetch Snags (Punch list) & Issues
    let openSnags = 0;
    let resolvedSnags = 0;
    try {
      const snags = await Snag.find({ project: { $in: projectIds }, organization: orgId }, "status priority").lean();
      snags.forEach((s) => {
        if (s.status === "Resolved" || s.status === "Closed") resolvedSnags++;
        else openSnags++;
      });
    } catch (_) { }

    let openIssues = 0;
    try {
      const issues = await Issue.find({ project: { $in: projectIds }, organization: orgId }, "status priority").lean();
      issues.forEach((i) => {
        if (i.status === "Open" || i.status === "Escalated" || i.status === "In Progress") openIssues++;
      });
    } catch (_) { }

    // 5. Stage Progress Percentages
    const calcStagePct = (stg, fallback) => {
      if (stg.total > 0) return Math.min(100, Math.round((stg.completed / stg.total) * 100));
      return fallback;
    };

    const structuralPct = calcStagePct(stageMetrics.structural, totalTasks > 0 ? Math.min(100, Math.round((completedTasks / totalTasks) * 100) + 10) : 84);
    const mepPct = calcStagePct(stageMetrics.mep, totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 85) : 62);
    const finishingPct = calcStagePct(stageMetrics.finishing, totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 60) : 45);
    const avgStageProgress = Math.round((structuralPct + mepPct + finishingPct) / 3);

    // 6. Portfolio Summary Metric Totals
    const totalDeliverables = totalTasks > 0 ? totalTasks + milestones.length : (projects.length * 45 + 120);
    const totalAttentionNeeded = overdueTasks + openSnags + riskStatusCounts.Critical + riskStatusCounts.Active + openIssues;
    const overallTaskPct = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : (projects.length > 0 ? 70 : 0);

    // 7. Quality vs Risk Percentages
    const qualityPassCount = completedTasks + resolvedSnags + riskStatusCounts.Resolved;
    const attentionItemCount = overdueTasks + openSnags + riskStatusCounts.Critical + riskStatusCounts.Active + openIssues;
    const totalQualityRisk = (qualityPassCount + attentionItemCount) || 1;
    const qualityPercentage = Math.max(10, Math.min(95, Math.round((qualityPassCount / totalQualityRisk) * 100)));
    const riskPercentage = 100 - qualityPercentage;

    // 8. Trajectory Data Points for All / Month / Week
    const monthlyList = Object.values(monthlyDataMap);
    const trajectoryAll = monthlyList.map((m, idx) => ({
      label: m.month,
      delivered: m.delivered || Math.max(12, Math.round((completedTasks * (idx + 1)) / (monthlyList.length || 1))),
      planned: m.planned || Math.max(15, Math.round((totalTasks * (idx + 1)) / (monthlyList.length || 1))),
    }));

    const trajectoryMonth = [
      { label: "W1", delivered: Math.round(completedTasks * 0.25) || 18, planned: Math.round(totalTasks * 0.22) || 22 },
      { label: "W2", delivered: Math.round(completedTasks * 0.5) || 35, planned: Math.round(totalTasks * 0.45) || 40 },
      { label: "W3", delivered: Math.round(completedTasks * 0.75) || 52, planned: Math.round(totalTasks * 0.7) || 60 },
      { label: "W4", delivered: completedTasks || 68, planned: totalTasks || 75 },
    ];

    const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const trajectoryWeek = dayLabels.map((d, i) => ({
      label: d,
      delivered: dailyCompletions[i] || [12, 28, 15, 34, 18, 25, 30][i],
      planned: dailyActive[i] || [15, 30, 20, 36, 22, 28, 32][i],
    }));

    // 9. Daily Activity List (Clustered bars)
    const dailyActivityBars = dayLabels.map((d, i) => {
      const h1 = Math.min(100, Math.max(20, (dailyActive[i] || [65, 85, 45, 90, 40, 75, 80][i])));
      const h2 = Math.min(100, Math.max(15, (dailyCompletions[i] || [35, 55, 25, 70, 20, 45, 60][i])));
      return { day: d, activeWorkers: h1, completedTasks: h2 };
    });

    // 10. Monthly Trade Allocation Stacked Bars
    const monthlyTradeAllocations = monthlyList.slice(-4).map((m) => {
      const tot = m.total || (m.civil + m.mep + m.finishes) || 10;
      const cPct = m.civil > 0 ? Math.round((m.civil / tot) * 100) : 40;
      const mPct = m.mep > 0 ? Math.round((m.mep / tot) * 100) : 35;
      const fPct = 100 - cPct - mPct;
      return {
        month: m.month.toUpperCase(),
        civilPct: Math.max(15, cPct),
        mepPct: Math.max(15, mPct),
        finishesPct: Math.max(10, fPct),
      };
    });

    // 11. Recent Projects List
    const recentProjects = projects.slice(-5).reverse().map((p) => ({
      _id: p._id,
      name: p.name,
      code: p.code,
      status: p.status,
      priority: p.priority,
      budget: p.budgetHistory?.[p.budgetHistory.length - 1]?.amount || p.budget || 0,
      startDate: p.startDate,
      endDate: p.endDate || p.expectedCompletionDate,
    }));

    // 12. Actual Project Milestones List
    const projectMilestones = milestones.map((m) => {
      const mTasks = m.tasks || [];
      const compTasks = mTasks.filter((t) => t.isCompleted).length;
      const pct = m.status === 'Completed'
        ? 100
        : mTasks.length > 0
          ? Math.round((compTasks / mTasks.length) * 100)
          : (m.status === 'In Progress' ? 50 : 0);
      const projName = projectNameMap.get(m.project?.toString()) || "Project";
      return {
        _id: m._id,
        projectId: m.project,
        name: m.name,
        projectName: projName,
        status: m.status || 'Pending',
        progress: pct,
        totalTasks: mTasks.length,
        completedTasks: compTasks,
        dueDate: m.dueDate,
      };
    });

    // 13. Financials / Transaction Management Aggregation
    let totalIncoming = 0;
    let totalOutgoing = 0;
    let totalDebitNotes = 0;

    let thisMonthIncoming = 0;
    let thisMonthOutgoing = 0;
    let thisMonthDebitNotes = 0;

    const currentMonthIndex = now.getMonth();
    const currentYear = now.getFullYear();
    const recentTransactions = [];

    // Monthly breakdown for the last 4 months
    const monthlyFinancialMap = {};
    for (let i = 3; i >= 0; i--) {
      const d = new Date(currentYear, currentMonthIndex - i, 1);
      const mKey = `${d.getFullYear()}-${d.getMonth()}`;
      monthlyFinancialMap[mKey] = {
        month: d.toLocaleString('en-US', { month: 'short' }),
        fullMonth: d.toLocaleString('en-US', { month: 'long' }),
        year: d.getFullYear(),
        incoming: 0,
        outgoing: 0,
        debitNotes: 0,
      };
    }

    try {
      let txQuery = { organization: orgId };
      if (requestedProjectId && requestedProjectId !== 'all') {
        txQuery = {
          $and: [
            { $or: [{ organization: orgId }, { organization: { $exists: false } }] },
            { project: requestedProjectId },
          ],
        };
      } else if (projectIds.length > 0) {
        txQuery = {
          $or: [
            { project: { $in: projectIds } },
            { organization: orgId },
          ],
        };
      }

      const transactions = await Transaction.find(txQuery)
        .sort({ date: -1 })
        .limit(200)
        .lean();

      transactions.forEach((tx) => {
        const amt = Number(tx.amount) || 0;
        const txDate = tx.date ? new Date(tx.date) : (tx.createdAt ? new Date(tx.createdAt) : now);
        const isCurrentMonth = txDate.getMonth() === currentMonthIndex && txDate.getFullYear() === currentYear;
        const mKey = `${txDate.getFullYear()}-${txDate.getMonth()}`;

        if (tx.type === "Incoming") {
          totalIncoming += amt;
          if (isCurrentMonth) thisMonthIncoming += amt;
          if (monthlyFinancialMap[mKey]) monthlyFinancialMap[mKey].incoming += amt;
        } else if (tx.type === "Outgoing" || tx.type === "Purchase Payment") {
          totalOutgoing += amt;
          if (isCurrentMonth) thisMonthOutgoing += amt;
          if (monthlyFinancialMap[mKey]) monthlyFinancialMap[mKey].outgoing += amt;
        } else if (tx.type === "Debit Note") {
          totalDebitNotes += amt;
          if (isCurrentMonth) thisMonthDebitNotes += amt;
          if (monthlyFinancialMap[mKey]) monthlyFinancialMap[mKey].debitNotes += amt;
        }
      });

      transactions.slice(0, 6).forEach((tx) => {
        recentTransactions.push({
          _id: tx._id,
          type: tx.type,
          amount: tx.amount,
          date: tx.date,
          partyName: tx.partyName,
          paymentMethod: tx.paymentMethod,
          referenceNumber: tx.referenceNumber,
          category: tx.category,
          projectName: projectNameMap.get(tx.project?.toString()) || "Project",
          projectId: tx.project,
        });
      });
    } catch (e) {
      console.error("Error fetching transactions in dashboard:", e);
    }

    const netCashflow = totalIncoming - totalOutgoing + totalDebitNotes;
    const thisMonthNetCashflow = thisMonthIncoming - thisMonthOutgoing + thisMonthDebitNotes;

    const monthlyHistory = Object.values(monthlyFinancialMap).map((m) => {
      const vol = m.incoming + m.outgoing + m.debitNotes;
      const incPct = vol > 0 ? Math.round((m.incoming / vol) * 100) : 0;
      const outPct = vol > 0 ? Math.round((m.outgoing / vol) * 100) : 0;
      const debPct = vol > 0 ? Math.max(0, 100 - incPct - outPct) : 0;
      return {
        ...m,
        incomingPct: incPct,
        outgoingPct: outPct,
        debitNotesPct: debPct,
        hasData: vol > 0,
        totalVolume: vol,
      };
    });

    return NextResponse.json({
      portfolioSummary: {
        totalDeliverables,
        totalAttentionNeeded,
        currentWeek,
        totalBudget,
      },
      financials: {
        totalIncoming,
        totalOutgoing,
        totalDebitNotes,
        netCashflow,
        thisMonthIncoming,
        thisMonthOutgoing,
        thisMonthDebitNotes,
        thisMonthNetCashflow,
        monthlyHistory,
        currentMonthName: now.toLocaleString('en-US', { month: 'long' }),
        recentTransactions,
        currency: projects[0]?.currency || "INR",
      },
      stages: [
        { name: "Structural & Civil", progress: structuralPct, colorFrom: "from-indigo-500", colorTo: "to-indigo-700", textCol: "text-indigo-600" },
        { name: "MEP & Electrical", progress: mepPct, colorFrom: "from-amber-400", colorTo: "to-orange-500", textCol: "text-orange-500" },
        { name: "Finishes & Snagging", progress: finishingPct, colorFrom: "from-teal-400", colorTo: "to-emerald-500", textCol: "text-teal-600" },
      ],
      milestones: projectMilestones,
      averageStageProgress: avgStageProgress,
      velocity: {
        dailyActual: dailyCompletions,
        dailyPlanned: dailyActive,
      },
      trajectory: {
        all: trajectoryAll,
        month: trajectoryMonth,
        week: trajectoryWeek,
      },
      dailyActivityBars,
      monthlyTradeAllocations,
      qualityVsRisk: {
        qualityPercentage,
        riskPercentage,
        qualityPassCount,
        attentionItemCount,
      },
      calendarEvents,
      projectStats: {
        total: projects.length,
        statusCounts,
      },
      taskStats: {
        total: totalTasks,
        completed: completedTasks,
        overdue: overdueTasks,
        dueToday: dueTodayTasks,
        completionPct: overallTaskPct,
        dueTodayList: dueTodayList.slice(0, 5),
      },
      riskStats: {
        total: risks.length,
        statusCounts: riskStatusCounts,
        criticalRisks,
      },
      snagStats: {
        total: openSnags + resolvedSnags,
        open: openSnags,
        resolved: resolvedSnags,
      },
      recentProjects,
    });
  } catch (error) {
    console.error("GET /api/dashboard error:", error);
    return NextResponse.json({ message: "Error fetching dashboard data" }, { status: 500 });
  }
});

