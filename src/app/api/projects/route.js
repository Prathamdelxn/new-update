import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Project from "@/models/Project";
import PlanFolder from "@/models/PlanFolder";
import { withAuth } from "@/lib/middleware";
import User from "@/models/User";
import Role from "@/models/Role";
import TemplateCategory from "@/models/TemplateCategory";
import Organization from "@/models/Organization";
import SiteSurvey from "@/models/SiteSurvey";
import ChatMessage from "@/models/ChatMessage";
import mongoose from "mongoose";

export const GET = withAuth(async function (req) {
  try {
    await dbConnect();
    
    const userDoc = await User.findById(req.user.id).populate("role");
    const isAdmin = userDoc?.role?.name === "Admin" || req.user.role === "Admin";

    let query = { organization: req.user.organizationId };

    if (!isAdmin) {
      const userProjectIds = (userDoc?.projects || []).map(p => p.project);
      query.$or = [
        { _id: { $in: userProjectIds } },
        { "members.user": userDoc._id },
      ];
    }

    const projects = await Project.find(query)
      .sort({ createdAt: -1 })
      .populate({ path: "createdBy", select: "+__enc_name +__enc_phoneNumber" })
      .populate({ path: "members.user", select: "+__enc_name +__enc_phoneNumber" })
      .populate("members.role")
      .populate({ path: "siteSurveyor", select: "+__enc_name +__enc_phoneNumber" })
      .populate("category", "name");

    // Find which projects have at least one Pending plan document
    const projectIds = projects.map((p) => p._id);
    const pendingFolders = await PlanFolder.find(
      {
        project: { $in: projectIds },
        documents: {
          $elemMatch: {
            approvals: {
              $elemMatch: { user: req.user.id, status: "Pending" }
            }
          }
        }
      },
      { project: 1 }
    );
    const pendingSet = new Set(pendingFolders.map((f) => f.project.toString()));

    // Fetch site surveys for these projects to determine survey status
    const surveys = await SiteSurvey.find({ project: { $in: projectIds } }, { project: 1, status: 1, rejectionReason: 1 });
    const surveyStatusMap = {};
    const surveyRejectMap = {};
    surveys.forEach(s => {
      surveyStatusMap[s.project.toString()] = s.status;
      surveyRejectMap[s.project.toString()] = s.rejectionReason;
    });

    // Calculate unread chat messages for each project
    const userIdObj = new mongoose.Types.ObjectId(req.user.id);
    const unreadMessages = await ChatMessage.aggregate([
      { 
        $match: { 
          project: { $in: projectIds },
          sender: { $ne: userIdObj },
          readBy: { $ne: userIdObj }
        }
      },
      {
        $group: {
          _id: "$project",
          count: { $sum: 1 }
        }
      }
    ]);
    const unreadMap = {};
    unreadMessages.forEach(um => {
      unreadMap[um._id.toString()] = um.count;
    });

    const result = projects.map((p) => ({
      ...p.toObject(),
      hasPendingPlans: pendingSet.has(p._id.toString()),
      surveyStatus: surveyStatusMap[p._id.toString()] || null,
      surveyRejectionReason: surveyRejectMap[p._id.toString()] || null,
      unreadMessageCount: unreadMap[p._id.toString()] || 0,
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error("GET /api/projects error:", error);
    return NextResponse.json({ message: "Error fetching projects" }, { status: 500 });
  }
});

export const POST = withAuth(async function (req) {
  try {
    await dbConnect();
    const { name, description, category, projectType, clientName, clientEmail, clientPhone, status, createdBy, members, startDate, endDate, documents, drawings, budget, needSiteSurvey, currency, area, areaUnit, siteLocation, attendanceRadius } = await req.json();

    const count = await Project.countDocuments({ organization: req.user.organizationId });
    const projectCode = `PRJ-${(count + 1).toString().padStart(4, '0')}`;

    const projectData = {
      name,
      projectCode,
      description,
      currency: currency || "AED",
      projectType: projectType || "Construction",
      category,
      clientName,
      clientEmail,
      clientPhone,
      status,
      createdBy,
      members,
      startDate,
      endDate,
      documents: documents?.map(doc => ({
        ...doc,
        status: "Approved",
        uploadedBy: {
          user: req.user.id || createdBy,
          name: req.user.name || "Creator"
        }
      })),
      needSiteSurvey: needSiteSurvey || false,
      area: area ? Number(area) : null,
      areaUnit: areaUnit || "sqft",
      organization: req.user.organizationId,
      siteLocation,
      attendanceRadius: attendanceRadius ? Number(attendanceRadius) : 100,
    };

    // Initialize budget history if budget is provided
    if (budget) {
      projectData.budgetHistory = [{
        amount: Number(budget),
        reason: "Estimated Budget",
        approvalStatus: "Approved",
        updatedBy: req.user.id || createdBy,
        updatedByName: req.user.name || "System Creator",
        timestamp: new Date()
      }];
    }

    const project = new Project(projectData);

    const creatorUserId = req.user.id || createdBy;
    if (creatorUserId && !project.members.some(m => m.user?.toString() === creatorUserId.toString())) {
      project.members.push({ user: creatorUserId });
    }

    // Add audit entry
    project.auditTrail.push({
      user: req.user.id || createdBy,
      userName: req.user.name || "Creator",
      userRole: req.user.role || "Member",
      action: "Create",
      details: `Project ${name} created`,
    });

    await project.save();

    // Automatically add the project to the creator's assigned projects list
    if (creatorUserId) {
      await User.findByIdAndUpdate(creatorUserId, {
        $addToSet: { projects: { project: project._id } }
      });
    }

    // Automatically create Technical Drawing folder if drawings were uploaded
    if (drawings && drawings.length > 0) {
      const technicalDrawingFolder = new PlanFolder({
        name: "Technical Drawing",
        project: project._id,
        documents: drawings.map(d => ({
          name: d.name,
          versions: [{
            url: d.url,
            name: d.name,
            versionNumber: 1,
            mimeType: d.mimeType,
            size: d.size,
            uploadedBy: req.user.id || createdBy,
            approvalStatus: "Approved"
          }]
        })),
        createdBy: req.user.id || createdBy,
      });
      await technicalDrawingFolder.save();
    }

    return NextResponse.json(project, { status: 201 });
  } catch (error) {
    console.error("POST /api/projects error:", error);
    return NextResponse.json({ message: "Error creating project", error: error.message, stack: error.stack }, { status: 500 });
  }
});
