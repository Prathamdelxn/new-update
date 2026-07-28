/**
 * Helper to standardise audit trail entries
 */
export const createAuditEntry = (actor, action, details = "") => {
  if (!actor) {
    return {
      userName: "System",
      userRole: "Automated",
      action,
      details,
      timestamp: new Date(),
    };
  }

  return {
    user: actor._id || actor.id,
    userName: actor.name,
    userRole: actor.role?.name || actor.roleName || "User",
    action,
    details,
    timestamp: new Date(),
  };
};

/**
 * Utility to push audit entry to a document
 * Works with Mongoose documents
 */
export const recordAudit = async (doc, actor, action, details = "") => {
  const entry = createAuditEntry(actor, action, details);
  if (!doc.auditTrail) doc.auditTrail = [];
  doc.auditTrail.push(entry);
  return doc.save();
};
