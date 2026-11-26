// One definition of construction project progress, used by the project list, the project page
// and the dashboard (they used to show fixed numbers per status, e.g. every "Ongoing" = 50%).
//
//   • Completed / handed over            → 100%
//   • Has milestones / tasks             → share of that planned work actually done
//                                           (a milestone without tasks counts as one item)
//   • No planned work yet                → stage of the project lifecycle (fallback)
import Milestone from "@/models/Milestone";

export const STAGE_PROGRESS = {
  Initialized: 5, Planning: 15, "Site Survey": 25, Ongoing: 50,
  "Under Snagging": 75, "Snagging Completed": 90, Completed: 100,
  "Pending Handover": 95, "Handover Rejected": 90, "Handover Completed": 100,
  "On Hold": 40, Cancelled: 0,
};
const DONE_STATUSES = new Set(["Completed", "Handover Completed"]);

/** Map of projectId → { total, completed } work items, in one aggregation for all projects. */
export async function workCountsByProject(projectIds) {
  if (!projectIds?.length) return new Map();
  const rows = await Milestone.aggregate([
    { $match: { project: { $in: projectIds } } },
    {
      $project: {
        project: 1,
        taskCount: { $size: { $ifNull: ["$tasks", []] } },
        tasksDone: {
          $size: { $filter: { input: { $ifNull: ["$tasks", []] }, cond: { $eq: ["$$this.isCompleted", true] } } },
        },
        milestoneDone: { $cond: [{ $eq: ["$status", "Completed"] }, 1, 0] },
      },
    },
    {
      $group: {
        _id: "$project",
        total: { $sum: { $cond: [{ $gt: ["$taskCount", 0] }, "$taskCount", 1] } },
        completed: { $sum: { $cond: [{ $gt: ["$taskCount", 0] }, "$tasksDone", "$milestoneDone"] } },
      },
    },
  ]);
  return new Map(rows.map((r) => [String(r._id), { total: r.total, completed: r.completed }]));
}

/** Progress % for one project, given its status and its work counts (or undefined). */
export function progressOf(status, counts) {
  if (DONE_STATUSES.has(status)) return 100;
  if (counts && counts.total > 0) return Math.min(100, Math.round((counts.completed / counts.total) * 100));
  return STAGE_PROGRESS[status] ?? 10;
}
