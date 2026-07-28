import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Milestone from "@/models/Milestone";
import { withAuth } from "@/lib/middleware";
import { emitToProject } from "@/lib/socket-server";
import { parseXER, transformXERToMilestones } from "@/lib/xerParser";

export const POST = withAuth(async function (req, { params }) {
  try {
    await dbConnect();
    const { id: projectId } = await params;
    
    // Check if the request is multipart/form-data or just json with text
    // For simplicity, we'll expect the file content as text in the body or a file field
    // In this case, let's assume the mobile app sends the file content as a string
    const { fileContent } = await req.json();

    if (!fileContent) {
      return NextResponse.json({ message: "No file content provided" }, { status: 400 });
    }

    const tables = parseXER(fileContent);
    const milestoneDrafts = transformXERToMilestones(tables);

    if (milestoneDrafts.length === 0) {
      return NextResponse.json({ message: "No milestones found in XER file" }, { status: 400 });
    }

    const createdMilestones = [];

    for (const draft of milestoneDrafts) {
      const milestoneData = {
        ...draft,
        project: projectId,
        organization: req.user.organizationId,
        createdBy: req.user.id,
      };

      const milestone = new Milestone(milestoneData);
      
      // Add audit entry
      milestone.auditTrail.push({
        user: req.user.id,
        userName: req.user.name || "User",
        userRole: req.user.role || "Member",
        action: "Create",
        details: `Milestone imported from XER file: ${draft.name}`,
      });

      await milestone.save();
      createdMilestones.push(milestone);
    }

    emitToProject(projectId, 'milestone:created', { count: createdMilestones.length });

    // Check if project should transition to Ongoing
    const { checkAndTransitionToOngoing } = await import("@/lib/projectStatusHelper");
    await checkAndTransitionToOngoing(projectId);

    return NextResponse.json({ 
      message: `Successfully imported ${createdMilestones.length} milestones`,
      milestones: createdMilestones 
    }, { status: 201 });

  } catch (error) {
    console.error("XER Import Error:", error);
    return NextResponse.json({ message: "Error importing XER" }, { status: 500 });
  }
});
