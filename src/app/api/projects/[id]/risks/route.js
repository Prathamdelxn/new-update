import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Risk from "@/models/Risk";
import Project from "@/models/Project";
import Notification from "@/models/Notification";
import User from "@/models/User";
import Role from "@/models/Role";
import { withAuth } from "@/lib/middleware";
import { emitToProject, emitToUser } from "@/lib/socket-server";
import { recordAudit } from "@/lib/auditHelper";

export const GET = withAuth(async function (req, { params }) {
  try {
    const { id } = await params;
    await dbConnect();

    const risks = await Risk.find({ project: id })
      .populate('owner', 'name email __enc_name')
      .populate('history.updatedBy', 'name __enc_name')
      .sort({ createdAt: -1 });

    return NextResponse.json(risks);
  } catch (error) {
    console.error("Fetch risks error:", error);
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
});

export const POST = withAuth(async function (req, { params }) {
  try {
    const { id } = await params;
    const body = await req.json();
    await dbConnect();

    const newRisk = await Risk.create({
      ...body,
      project: id,
      organization: req.user.organizationId,
      owner: body.owner || null
    });

    // Record audit trail in Risk document
    const auditDetails = body.sourceType && body.sourceType !== 'Manual' 
      ? `Auto-generated from ${body.sourceType}: ${body.sourceName || body.sourceId}`
      : "Initial risk identification";
      
    await recordAudit(newRisk, req.user, "Create", auditDetails);

    // Record audit trail in project
    const project = await Project.findById(id).populate('members');
    if (project) {
      await recordAudit(project, req.user, "RiskAdded", `Risk identified: ${body.title}`);

      // Generate Notifications for Project Members
      const memberIds = project.members.map(m => m._id.toString());
      
      // Get all Admins/SuperAdmins of the organization too
      const adminRoles = await Role.find({
        organization: req.user.organizationId,
        name: { $in: ['Admin', 'SuperAdmin'] }
      });
      const adminRoleIds = adminRoles.map(r => r._id);

      const admins = await User.find({ 
        organization: req.user.organizationId, 
        role: { $in: adminRoleIds } 
      });
      const adminIds = admins.map(a => a._id.toString());

      // Combine and unique
      const recipients = [...new Set([...memberIds, ...adminIds])].filter(uid => uid !== req.user.id);

      const notifications = recipients.map(uid => ({
        user: uid,
        project: id,
        title: 'New Risk Identified',
        message: `${req.user.name} identified a new risk: ${body.title}`,
        type: 'Risk',
        relatedId: newRisk._id
      }));

      if (notifications.length > 0) {
        await Notification.insertMany(notifications);
        
        // Emit real-time notifications to recipients
        for (const recipientId of recipients) {
          emitToUser(recipientId, 'notification:new', {
            title: 'New Risk Identified',
            message: `${req.user.name} identified a new risk: ${body.title}`
          });
        }
      }
    }

    emitToProject(id, 'risk:updated');
    
    return NextResponse.json(newRisk, { status: 201 });
  } catch (error) {
    console.error("Create risk error:", error);
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
});
