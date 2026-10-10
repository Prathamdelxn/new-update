import User from "@/models/User";
import Role from "@/models/Role";

// Shared permission matching for API routes.
//
// The Role editor (web RoleModal) saves keys as `projects:<action>`, but the
// default roles seeded at registration use the older `project:<action>` and
// `team:assign` keys. Treat them as equivalent so both kinds of roles work.
const ALIASES = {
  "projects:view": ["project:view"],
  "projects:create": ["project:create"],
  "projects:update": ["project:update"],
  "projects:delete": ["project:delete"],
  "projects:approve": ["project:approve"],
  "projects:complete": ["project:complete"],
  "projects:assign": ["project:assign", "team:assign"],
  // Site survey: older code/roles used `manage` for assign+approve and
  // `submit` for creating a survey; the Role editor saves the action names.
  "sitesurvey:create": ["sitesurvey:submit"],
  "sitesurvey:approve": ["sitesurvey:manage"],
  "sitesurvey:assign": ["sitesurvey:manage"],
  // Snags & Issues: older code used singular `snag:*`; default roles were
  // seeded with `snags:resolve` / `snags:close` for completing.
  "snags:assign": ["snag:assign"],
  "snags:complete": ["snag:complete", "snags:resolve", "snags:close"],
};

export function hasPermission(perms, permission) {
  if (!Array.isArray(perms)) return false;
  if (perms.includes("*") || perms.includes(permission)) return true;
  return (ALIASES[permission] || []).some((alias) => perms.includes(alias));
}

// True when a project-level role grants everything (mirrors withPermission).
export function isFullAccessRole(role) {
  return !!role && (role.name === "Admin" || role.isSystemRole || (role.permissions || []).includes("*"));
}

// A role that grants everything (Admin / system / "*"). Non-admins with User
// Management permissions must not hand these out — that would let them make
// themselves or others an Admin.
export async function isPrivilegedRoleId(roleId, organizationId) {
  if (!roleId) return false;
  const role = await Role.findOne({ _id: roleId, organization: organizationId }).select("name permissions isSystemRole");
  return isFullAccessRole(role);
}

// True if any global or project role in a user create/update payload is privileged.
export async function payloadAssignsPrivilegedRole({ roleId, projects }, organizationId) {
  if (await isPrivilegedRoleId(roleId, organizationId)) return true;
  for (const p of projects || []) {
    if (await isPrivilegedRoleId(p?.role, organizationId)) return true;
  }
  return false;
}

// Which Snags & Issues permissions a PATCH body needs, given the stored record:
// assigning (new assignee, or sending a Draft for fixing) needs assign, moving
// to Resolved/Closed needs complete, any other change needs update.
const SNAG_COMPLETE_STATUSES = ["Resolved", "Closed"];
export function snagChangePermissions(body, existing) {
  const needed = new Set();
  const { status, assignedTo, ...rest } = body || {};
  const currentAssignee = existing?.assignedTo ? String(existing.assignedTo._id || existing.assignedTo) : "";
  const assigneeChanged = assignedTo !== undefined && String(assignedTo || "") !== currentAssignee;
  const statusChanged = status !== undefined && status !== existing?.status;

  if (statusChanged && SNAG_COMPLETE_STATUSES.includes(status)) {
    needed.add("snags:complete");
  } else if (statusChanged && status === "Escalated") {
    // Escalation hands the issue to the next contact in the matrix
    needed.add("snags:update");
  } else if (statusChanged && existing?.status === "Draft" && status === "In Progress") {
    needed.add("snags:assign");
  } else if (statusChanged) {
    needed.add("snags:update");
  }
  if (assigneeChanged && !(statusChanged && status === "Escalated")) needed.add("snags:assign");

  // Notes, completion proof and escalation level sent with a status change
  // belong to that action; any other field is a details edit (update).
  const ACTION_FIELDS = ["note", "resolutionDetails", "resolutionImage", "resolutionDate", "escalationLevel"];
  const detailKeys = Object.keys(rest).filter((k) => !ACTION_FIELDS.includes(k));
  if (detailKeys.length > 0 || (needed.size === 0 && Object.keys(rest).length > 0)) needed.add("snags:update");
  return [...needed];
}

// Global role OR any of the user's project roles. For org-wide modules
// (Templates, Categories) that aren't tied to a single project, so members
// whose access comes only from a project assignment still get it.
export async function userHasAnyRolePermission(req, permission) {
  if (req.user.role === "Admin") return true;
  const user = await User.findById(req.user.id)
    .populate("role")
    .populate("projects.role")
    .select("role projects");
  if (isFullAccessRole(user?.role) || hasPermission(user?.role?.permissions, permission)) return true;
  return (user?.projects || []).some(
    (p) => p.role && (isFullAccessRole(p.role) || hasPermission(p.role.permissions, permission))
  );
}

// Global role, plus the user's role on this project (mirrors withPermission),
// for routes that need different permissions per action.
export async function userHasProjectPermission(req, projectId, permission) {
  if (req.user.role === "Admin") return true;
  const user = await User.findById(req.user.id)
    .populate("role")
    .populate("projects.role")
    .select("role projects");
  if (hasPermission(user?.role?.permissions, permission)) return true;
  const assignment = user?.projects?.find((p) => p.project?.toString() === String(projectId));
  if (!assignment?.role) return false;
  return isFullAccessRole(assignment.role) || hasPermission(assignment.role.permissions, permission);
}
