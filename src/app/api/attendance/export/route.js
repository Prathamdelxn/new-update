import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Attendance from "@/models/Attendance";
import LabourAttendance from "@/models/LabourAttendance";
import { withAuth } from "@/lib/middleware";
import User from "@/models/User";
import * as XLSX from "xlsx";
import Project from "@/models/Project";
import { exportLang, xt, applySheetDirection } from "@/lib/exportI18n";

export const GET = withAuth(async function (req) {
  try {
    await dbConnect();
    
    const url = new URL(req.url);
    const projectId = url.searchParams.get("projectId");
    const startDate = url.searchParams.get("startDate"); // YYYY-MM-DD
    const endDate = url.searchParams.get("endDate"); // YYYY-MM-DD
    const exportUserId = url.searchParams.get("userId");
    const lang = exportLang(url); // ?lang=ar → Arabic headers + right-to-left sheet
    
    if (!projectId || !startDate || !endDate) {
      return NextResponse.json({ message: "Missing required query parameters: projectId, startDate, endDate" }, { status: 400 });
    }

    const userDoc = await User.findById(req.user.id).populate("role");
    const isAdmin = userDoc?.role?.name === "Admin" || req.user.role === "Admin";

    const query = {
      project: projectId,
      organization: req.user.organizationId,
      attendanceDate: { $gte: startDate, $lte: endDate }
    };

    if (!isAdmin) {
      query.user = req.user.id;
    } else if (exportUserId) {
      query.user = exportUserId;
    }

    const records = await Attendance.find(query).populate("user").sort({ attendanceDate: 1 });

    // Format data for Excel
    const excelData = records.map(rec => ({
      [xt(lang, "Date")]: rec.attendanceDate,
      [xt(lang, "Name")]: rec.user?.name || rec.user?.email || xt(lang, "Unknown"),
      [xt(lang, "Check-In")]: new Date(rec.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      [xt(lang, "Check-Out")]: rec.checkOutTime ? new Date(rec.checkOutTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : xt(lang, "Pending"),
      [xt(lang, "Total Hours")]: rec.totalWorkHours || "-"
    }));

    // Create workbook
    const worksheet = XLSX.utils.json_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, xt(lang, "Team Attendance"));

    if (isAdmin) {
      const labourQuery = {
        project: projectId,
        organization: req.user.organizationId,
        attendanceDate: { $gte: startDate, $lte: endDate }
      };

      const labourRecords = await LabourAttendance.find(labourQuery).populate("labour").sort({ attendanceDate: 1 });

      if (labourRecords.length > 0) {
        const projectDoc = await Project.findById(projectId).select("currency").lean();
        const currency = projectDoc?.currency || "AED"; // project currency (was hard-coded)
        const summaryMap = {};

        labourRecords.forEach(rec => {
          if (!rec.labour) return;
          const lId = rec.labour._id.toString();
          if (!summaryMap[lId]) {
            summaryMap[lId] = {
              name: rec.labour.name || xt(lang, "Unknown"),
              type: xt(lang, rec.labour.type) || "-",
              paymentCycle: xt(lang, rec.labour.paymentCycle) || "-",
              wageAmount: rec.labour.wageAmount || 0,
              presentCount: 0,
              halfDayCount: 0,
              absentCount: 0
            };
          }
          if (rec.status === 'Present') summaryMap[lId].presentCount++;
          else if (rec.status === 'Half Day') summaryMap[lId].halfDayCount++;
          else if (rec.status === 'Absent') summaryMap[lId].absentCount++;
        });

        const labourSummaryData = Object.values(summaryMap).map(s => {
          const earned = (s.presentCount * s.wageAmount) + (s.halfDayCount * (s.wageAmount / 2));
          return {
            [xt(lang, "Labour Name")]: s.name,
            [xt(lang, "Type")]: s.type,
            [xt(lang, "Payment Cycle")]: s.paymentCycle,
            [`${xt(lang, "Base Wage")} (${currency})`]: s.wageAmount,
            [xt(lang, "Days Present")]: s.presentCount,
            [xt(lang, "Half Days")]: s.halfDayCount,
            [xt(lang, "Days Absent")]: s.absentCount,
            [`${xt(lang, "Total Earned")} (${currency})`]: earned
          };
        });

        const labourWorksheet = XLSX.utils.json_to_sheet(labourSummaryData);
        XLSX.utils.book_append_sheet(workbook, labourWorksheet, xt(lang, "Payroll Summary"));
      }
    }

    applySheetDirection(workbook, lang);

    // Write to buffer
    const buf = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Disposition": `attachment; filename="Attendance_Export_${startDate}_to_${endDate}.xlsx"`,
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      },
    });

  } catch (error) {
    console.error("GET /api/attendance/export error:", error);
    return NextResponse.json({ message: "Error exporting attendance" }, { status: 500 });
  }
});
