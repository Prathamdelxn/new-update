import Project from "@/models/Project";
import PlanFolder from "@/models/PlanFolder";
import BOQ from "@/models/BOQ";
import { emitToProject } from "./socket-server";

/**
 * Checks if all Technical Plans and all BOQ items are approved for a project.
 * If true, automatically transitions project status to "Ongoing".
 */
export const checkAndTransitionToOngoing = async (projectId) => {
  try {
    const project = await Project.findById(projectId);
    if (!project) return;

    // Only transition if currently in Planning, Initialized, or Site Survey
    const ALLOWED_STATUSES = ["Initialized", "Planning", "Site Survey"];
    if (!ALLOWED_STATUSES.includes(project.status)) return;

    // 1. Check Plans
    const folders = await PlanFolder.find({ project: projectId });
    
    // Flatten all documents from all folders to check their status
    const allDocuments = folders.flatMap(f => f.documents || []);
    
    // If no folders exist OR no documents have been uploaded yet, planning is incomplete
    if (allDocuments.length === 0) return; 

    const allPlansApproved = allDocuments.every(doc => {
      // We only care about the latest version of each document being approved
      const latestVersion = doc.versions[doc.versions.length - 1];
      return latestVersion && latestVersion.approvalStatus === "Approved";
    });

    if (!allPlansApproved) return;

    // 2. Check BOQ Items
    // All current BOQ items must be approved. If none exist, planning is incomplete.
    const boqItems = await BOQ.find({ project: projectId, isLatest: true });
    if (boqItems.length === 0) return;

    const allBOQApproved = boqItems.every(item => item.status === "Approved");
    if (!allBOQApproved) return;

    // 2.5 Check Milestones
    // The project should only move to Ongoing once the first milestone is created
    const Milestone = (await import("@/models/Milestone")).default;
    const milestoneCount = await Milestone.countDocuments({ project: projectId });
    if (milestoneCount === 0) return;

    // 3. Perform Transition
    const oldStatus = project.status;
    project.status = "Ongoing";
    
    project.auditTrail.push({
      userName: "System",
      userRole: "Automated",
      action: "StatusChange",
      details: `Project status automatically transitioned from '${oldStatus}' to 'Ongoing'. All Technical Plans (${allDocuments.length}) and BOQ items (${boqItems.length}) are approved, and the project timeline has been initialized with the first milestone.`,
      timestamp: new Date()
    });

    await project.save();
    
    // Broadcast updates
    emitToProject(projectId, 'project:updated');
    
  } catch (error) {
    console.error("Error in checkAndTransitionToOngoing helper:", error);
  }
};
