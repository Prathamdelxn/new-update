import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Milestone from "@/models/Milestone";
import { withPermission } from "@/lib/middleware";
import { emitToProject } from "@/lib/socket-server";

export const GET = withPermission(async function (req, { params }) {
  try {
    await dbConnect();
    const { id } = await params;
    
    const milestones = await Milestone.find({ 
      project: id,
      organization: req.user.organizationId 
    }).sort({ dueDate: 1 });

    return NextResponse.json(milestones);
  } catch (error) {
    return NextResponse.json({ message: "Error fetching milestones" }, { status: 500 });
  }
}, "tasks:view");

export const POST = withPermission(async function (req, { params }) {
  try {
    await dbConnect();
    const { id } = await params;
    const { name, description, dueDate, status, tasks } = await req.json();

    const milestoneData = {
      name,
      description,
      dueDate,
      status: status || "Pending",
      project: id,
      organization: req.user.organizationId,
      createdBy: req.user.id,
      tasks: (tasks || []).map(t => ({
        ...t,
        createdBy: req.user.id,
        createdByName: req.user.name,
      })),
    };

    const milestone = new Milestone(milestoneData);

    // Add initial audit entry
    milestone.auditTrail.push({
      user: req.user.id,
      userName: req.user.name || "User",
      userRole: req.user.role || "Member",
      action: "Create",
      details: `Milestone "${name}" created`,
    });

    await milestone.save();
    emitToProject(id, 'milestone:created', { milestoneId: milestone._id.toString() });

    // Check if project should transition to Ongoing
    const { checkAndTransitionToOngoing } = await import("@/lib/projectStatusHelper");
    await checkAndTransitionToOngoing(id);

    return NextResponse.json(milestone, { status: 201 });
  } catch (error) {
    return NextResponse.json({ message: "Error creating milestone" }, { status: 500 });
  }
}, "tasks:create");
