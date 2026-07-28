import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import SiteSurvey from "@/models/SiteSurvey";
import Project from "@/models/Project";
import User from "@/models/User";
import { withAuth } from "@/lib/middleware";
import { emitToProject } from "@/lib/socket-server";
import { sendEmail } from "@/lib/email";
import { surveySumbittedEmail, surveyDecisionEmail } from "@/lib/emailTemplates";
import Role from "@/models/Role";

export const POST = withAuth(async function (req, { params }) {
  try {
    const { id: projectId } = await params;
    await dbConnect();

    const surveyPayload = await req.json();

    // 1. Verify Project Exists
    const project = await Project.findOne({ _id: projectId, organization: req.user.organizationId });
    if (!project) {
      return NextResponse.json({ message: "Project not found" }, { status: 404 });
    }

    // 2. Create Survey
    const newSurvey = new SiteSurvey({
      ...surveyPayload,
      project: project._id,
      surveyor: req.user.id,
      organization: req.user.organizationId,
      status: "Submitted" // Automatically set to submitted for now
    });

    await newSurvey.save();

    // Note: Project status remains 'Site Survey' until the Admin approves it.
    // Budget history will ONLY be updated when an Admin formally Approves the survey in the PATCH route.

    project.auditTrail.push({
      user: req.user.id,
      userName: req.user.name || "Surveyor",
      userRole: req.user.role || "Member",
      action: "Update",
      details: "Site Survey submitted successfully and is pending approval.",
    });

    await project.save();

    /* 
    // Email all org admins about the new survey submission
    const admins = await User.find({
      organization: req.user.organizationId,
      status: "Active",
    }).populate("role", "permissions").select("name email role __enc_name");

    const adminEmails = admins.filter(u =>
      u.role?.permissions?.includes("*") || u.role?.permissions?.includes("sitesurvey:approve")
    );

    for (const admin of adminEmails) {
      sendEmail({
        to: admin.email,
        subject: `Site Survey Submitted — ${project.name}`,
        html: surveySumbittedEmail({
          adminName: admin.name,
          surveyorName: req.user.name || "Surveyor",
          projectName: project.name,
        }),
      });
    }
    */

    emitToProject(projectId, 'survey:updated');
    return NextResponse.json(newSurvey, { status: 201 });
  } catch (error) {
    console.error("Site survey submission error:", error);
    return NextResponse.json(
      { message: "Error submitting site survey" },
      { status: 500 }
    );
  }
});

// Optional GET to fetch survey data for a project
export const GET = withAuth(async function (req, { params }) {
  try {
    const { id: projectId } = await params;
    await dbConnect();

    const survey = await SiteSurvey.findOne({ project: projectId, organization: req.user.organizationId })
      .populate("surveyor", "name email __enc_name");

    // Return null (not 404) so callers can distinguish "no survey yet" from a real error
    if (!survey) {
      return NextResponse.json(null, { status: 200 });
    }

    return NextResponse.json(survey);
  } catch (error) {
    return NextResponse.json(
      { message: "Error fetching site survey" },
      { status: 500 }
    );
  }
});

// Admin Approval or Rejection
export const PATCH = withAuth(async function (req, { params }) {
  try {
    const { id: projectId } = await params;
    await dbConnect();

    const { action, rejectionReason, ...updatePayload } = await req.json(); // action = "Approve" or "Reject" or "UpdateDetails"
    const survey = await SiteSurvey.findOne({ project: projectId, organization: req.user.organizationId });
    const project = await Project.findOne({ _id: projectId, organization: req.user.organizationId });

    if (!survey || !project) {
      return NextResponse.json({ message: "Survey or Project not found" }, { status: 404 });
    }

    if (action === "Approve") {
      survey.status = "Approved";
      project.status = "Planning"; // Advance project to Planning upon approval
      project.auditTrail.push({
        user: req.user.id,
        userName: req.user.name || "Admin",
        userRole: req.user.role || "Admin",
        action: "Update",
        details: "Site Survey was officially Approved.",
      });
    } else if (action === "Reject") {
      survey.status = "Needs Attention";
      survey.rejectionReason = rejectionReason;
      project.status = "Site Survey"; // Send back to surveyor
      project.auditTrail.push({
        user: req.user.id,
        userName: req.user.name || "Admin",
        userRole: req.user.role || "Admin",
        action: "Update",
        details: `Site Survey Rejected. Reason: ${rejectionReason}`,
      });
    } else if (action === "UpdateDetails") {
      // Validate that the user is the original surveyor
      if (survey.surveyor.toString() !== req.user.id) {
        return NextResponse.json({ message: "Only the original surveyor can update details" }, { status: 403 });
      }

      // Validate that it's not approved yet
      if (survey.status === "Approved") {
        return NextResponse.json({ message: "Approved surveys cannot be modified" }, { status: 400 });
      }

      // Update the survey fields
      Object.assign(survey, updatePayload);

      // If it was "Needs Attention", move it back to "Submitted"
      if (survey.status === "Needs Attention") {
        survey.status = "Submitted";
        // Project status remains 'Site Survey' until approved
      }

      project.auditTrail.push({
        user: req.user.id,
        userName: req.user.name || "Surveyor",
        userRole: req.user.role || "Surveyor",
        action: "Update",
        details: "Site Survey details updated by surveyor.",
      });
    }

    await survey.save();
    await project.save();

    /*
    // Email the surveyor about the admin's decision
    const surveyor = await User.findById(survey.surveyor).select("name email");
    if (surveyor?.email) {
      sendEmail({
        to: surveyor.email,
        subject: `Site Survey ${action === "Approve" ? "Approved" : "Needs Attention"} — ${project.name}`,
        html: surveyDecisionEmail({
          surveyorName: surveyor.name,
          adminName: req.user.name || "Admin",
          projectName: project.name,
          action,
          rejectionReason,
        }),
      });
    }
    */

    emitToProject(projectId, 'survey:updated');
    return NextResponse.json(survey);
  } catch (error) {
    return NextResponse.json({ message: "Error updating survey status" }, { status: 500 });
  }
});
