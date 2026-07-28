import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import LabourAttendance from "@/models/LabourAttendance";
import { withAuth } from "@/lib/middleware";
import User from "@/models/User";
import * as XLSX from "xlsx";

export const GET = withAuth(async function (req) {
  try {
    await dbConnect();
    
    const url = new URL(req.url);
    const projectId = url.searchParams.get("projectId");
    const month = url.searchParams.get("month"); // Format: YYYY-MM
    const startDateParam = url.searchParams.get("startDate");
    const endDateParam = url.searchParams.get("endDate");
    
    if (!projectId) {
      return NextResponse.json({ message: "Missing required query parameter: projectId" }, { status: 400 });
    }

    const userDoc = await User.findById(req.user.id).populate("role");
    const isAdmin = userDoc?.role?.name === "Admin" || req.user.role === "Admin";

    if (!isAdmin) {
      return NextResponse.json({ message: "Unauthorized: Only Admins can download payroll." }, { status: 403 });
    }

    // Default to current month if not provided
    let startDate, endDate;
    if (startDateParam && endDateParam) {
      startDate = startDateParam;
      endDate = endDateParam;
    } else if (month) {
      const [year, monthStr] = month.split("-");
      startDate = new Date(year, parseInt(monthStr) - 1, 1).toISOString().split('T')[0];
      endDate = new Date(year, parseInt(monthStr), 0).toISOString().split('T')[0]; // last day of month
    } else {
      const date = new Date();
      startDate = new Date(date.getFullYear(), date.getMonth(), 1).toISOString().split('T')[0];
      endDate = new Date(date.getFullYear(), date.getMonth() + 1, 0).toISOString().split('T')[0];
    }

    const labourQuery = {
      project: projectId,
      organization: req.user.organizationId,
      attendanceDate: { $gte: startDate, $lte: endDate }
    };

    const labourRecords = await LabourAttendance.find(labourQuery).populate("labour").sort({ attendanceDate: 1 });

    const workbook = XLSX.utils.book_new();

    if (labourRecords.length > 0) {
      const summaryMap = {};

      labourRecords.forEach(rec => {
        if (!rec.labour) return;
        const lId = rec.labour._id.toString();
        if (!summaryMap[lId]) {
          summaryMap[lId] = {
            name: rec.labour.name || "Unknown",
            type: rec.labour.type || "-",
            paymentCycle: rec.labour.paymentCycle || "-",
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
          "Labour Name": s.name,
          Type: s.type,
          "Payment Cycle": s.paymentCycle,
          "Base Wage (AED)": s.wageAmount,
          "Days Present": s.presentCount,
          "Half Days": s.halfDayCount,
          "Days Absent": s.absentCount,
          "Total Earned (AED)": earned
        };
      });

      const labourWorksheet = XLSX.utils.json_to_sheet(labourSummaryData);
      
      // Auto-size columns loosely based on title length
      const colWidths = [
        { wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, 
        { wch: 12 }, { wch: 10 }, { wch: 12 }, { wch: 20 }
      ];
      labourWorksheet['!cols'] = colWidths;
      
      XLSX.utils.book_append_sheet(workbook, labourWorksheet, "Payroll Summary");
    } else {
      // Empty sheet if no records
      const ws = XLSX.utils.json_to_sheet([{ Message: "No labour attendance records found for this period." }]);
      XLSX.utils.book_append_sheet(workbook, ws, "Payroll Summary");
    }

    const buf = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

    const fileSuffix = (startDateParam && endDateParam) ? `${startDateParam}_to_${endDateParam}` : (month ? month : new Date().toISOString().slice(0, 7));
    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Disposition": `attachment; filename="Labour_Payroll_${fileSuffix}.xlsx"`,
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      },
    });

  } catch (error) {
    console.error("GET /api/labour/export error:", error);
    return NextResponse.json({ message: "Error exporting labour payroll" }, { status: 500 });
  }
});
