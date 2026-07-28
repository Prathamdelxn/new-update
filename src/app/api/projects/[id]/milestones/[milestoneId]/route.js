import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Milestone from "@/models/Milestone";
import { withPermission } from "@/lib/middleware";
import { emitToProject } from "@/lib/socket-server";
import RiskEngine from "@/lib/riskEngine";

export const PATCH = withPermission(async function (req, { params }) {
  try {
    await dbConnect();
    const { id, milestoneId } = await params;
    const updates = await req.json();

    const milestone = await Milestone.findOne({
      _id: milestoneId,
      project: id,
      organization: req.user.organizationId
    });

    if (!milestone) {
      return NextResponse.json({ message: "Milestone not found" }, { status: 404 });
    }

    // Track status change for audit log
    if (updates.status && updates.status !== milestone.status) {
      milestone.auditTrail.push({
        user: req.user.id,
        userName: req.user.name,
        userRole: req.user.role,
        action: "StatusChange",
        details: `Status changed from ${milestone.status} to ${updates.status}`,
      });
      
      if (updates.status === "Completed") {
        milestone.completedAt = new Date();
      } else {
        milestone.completedAt = null;
      }
    }

    // Track task updates
    if (updates.tasks) {
        milestone.auditTrail.push({
            user: req.user.id,
            userName: req.user.name,
            userRole: req.user.role,
            action: "TaskUpdated",
            details: `Tasks updated`,
        });

        // Auto-generate Risk for any Delayed Tasks
        const delayedTasks = updates.tasks.filter(t => t.status === 'Delayed');
        for (const task of delayedTasks) {
          // Prevent spamming if risk already generated (could be checked in engine, but basic protection here)
          await RiskEngine.evaluateAndCreateRisk({
            projectId: id,
            organizationId: req.user.organizationId,
            user: req.user,
            sourceType: 'Task',
            sourceId: task._id || milestone._id, // task might not have _id if just a subdoc without it
            sourceName: task.title,
            title: `Schedule Risk: ${task.title} Delayed`,
            category: 'Logistics',
            description: `Auto-generated risk due to delayed task in milestone ${milestone.name}.`,
            impact: 'High',
            probability: 'High'
          }).catch(err => console.error("Risk auto-gen failed for task:", err));
        }
        // Map over incoming tasks to preserve or set user fields
        updates.tasks = updates.tasks.map(incomingTask => {
          const existingTask = incomingTask._id ? milestone.tasks.id(incomingTask._id) : null;
          
          let createdBy = existingTask && existingTask.createdBy ? existingTask.createdBy : req.user.id;
          let createdByName = existingTask && existingTask.createdByName ? existingTask.createdByName : req.user.name;
          
          let completedBy = existingTask ? existingTask.completedBy : null;
          let completedByName = existingTask ? existingTask.completedByName : null;

          if (incomingTask.isCompleted && (!existingTask || !existingTask.isCompleted)) {
            completedBy = req.user.id;
            completedByName = req.user.name;
            incomingTask.completedAt = new Date();
          } else if (!incomingTask.isCompleted) {
            completedBy = null;
            completedByName = null;
            incomingTask.completedAt = null;
          }

          return {
            ...incomingTask,
            createdBy,
            createdByName,
            completedBy,
            completedByName
          };
        });
    }

    // Generic update
    Object.assign(milestone, updates);

    await milestone.save();
    emitToProject(id, 'milestone:updated', { milestoneId });

    return NextResponse.json(milestone);
  } catch (error) {
    return NextResponse.json({ message: "Error updating milestone" }, { status: 500 });
  }
}, "tasks:update");

export const DELETE = withPermission(async function (req, { params }) {
  try {
    await dbConnect();
    const { id, milestoneId } = await params;

    const result = await Milestone.deleteOne({
      _id: milestoneId,
      project: id,
      organization: req.user.organizationId
    });

    if (result.deletedCount === 0) {
      return NextResponse.json({ message: "Milestone not found" }, { status: 404 });
    }

    emitToProject(id, 'milestone:deleted', { milestoneId });
    return NextResponse.json({ message: "Milestone deleted successfully" });
  } catch (error) {
    return NextResponse.json({ message: "Error deleting milestone" }, { status: 500 });
  }
}, "tasks:delete");
