// =============================================================================
// Language for generated Excel files (attendance / payroll exports).
// The web app sends ?lang=ar when the user has Arabic selected; English is the
// default, so existing callers (mobile, older web builds) are unchanged.
// =============================================================================

const AR = {
  // sheet names
  "Team Attendance": "حضور الفريق",
  "Payroll Summary": "ملخص الرواتب",
  // attendance columns
  Date: "التاريخ",
  Name: "الاسم",
  "Check-In": "الحضور",
  "Check-Out": "الانصراف",
  "Total Hours": "إجمالي الساعات",
  // payroll columns
  "Labour Name": "اسم العامل",
  Type: "النوع",
  "Payment Cycle": "دورة الدفع",
  "Base Wage": "الأجر الأساسي",
  "Days Present": "أيام الحضور",
  "Half Days": "أنصاف الأيام",
  "Days Absent": "أيام الغياب",
  "Total Earned": "إجمالي المستحق",
  Message: "رسالة",
  // values
  Pending: "معلّق",
  Unknown: "غير معروف",
  "No labour attendance records found for this period.": "لا توجد سجلات حضور للعمالة في هذه الفترة.",
  Skilled: "ماهر",
  Unskilled: "غير ماهر",
  Daily: "يومي",
  Weekly: "أسبوعي",
  Monthly: "شهري",
  // project report (emailed PDF)
  "Daily Project Report (Last 7 Days)": "تقرير المشروع اليومي (آخر 7 أيام)",
  "Monthly Project Report (Last 6 Months)": "تقرير المشروع الشهري (آخر 6 أشهر)",
  "Custom Range Project Report": "تقرير المشروع لفترة مخصصة",
  "Generated on:": "تاريخ الإنشاء:",
  "Range:": "الفترة:",
  "Completed Tasks": "المهام المنجزة",
  "No tasks completed in this range.": "لا توجد مهام منجزة في هذه الفترة.",
  "Milestone": "المرحلة",
  "Task Title": "عنوان المهمة",
  "Start Date": "تاريخ البدء",
  "End Date": "تاريخ الانتهاء",
  "Completion Date": "تاريخ الإنجاز",
  "Created By": "أنشأها",
  "Completed By": "أنجزها",
  "N/A": "غير متاح",
  "Reported Issues": "المشكلات المبلغ عنها",
  "No issues reported in this range.": "لا توجد مشكلات مبلغ عنها في هذه الفترة.",
  "Issue Title": "عنوان المشكلة",
  "Category": "الفئة",
  "Priority": "الأولوية",
  "Status": "الحالة",
  "Reported Date": "تاريخ الإبلاغ",
  "Other": "أخرى",
  "Reported Snags": "الملاحظات المبلغ عنها",
  "No snags reported in this range.": "لا توجد ملاحظات مبلغ عنها في هذه الفترة.",
  "Snag Title": "عنوان الملاحظة",
  "Activity Logs": "سجلات النشاط",
  "No activity logs in this range.": "لا توجد سجلات نشاط في هذه الفترة.",
  "User": "المستخدم",
  "Role": "الدور",
  "Action": "الإجراء",
  "Details": "التفاصيل",
  "Timestamp": "الوقت",
  "System": "النظام",
  "Member": "عضو",
  "Project:": "المشروع:",
  "Project Details": "تفاصيل المشروع",
  "Project Report:": "تقرير المشروع:",
  "Your Project Report is Ready!": "تقرير مشروعك جاهز!",
  "Please find attached the latest detailed report for": "تجد مرفقاً أحدث تقرير مفصّل لمشروع",
  "Report Timeline": "الفترة الزمنية للتقرير",
  "The attached PDF includes a comprehensive breakdown of all milestones, recently completed tasks, reported issues, and snag lists.": "يتضمن ملف PDF المرفق تفصيلاً شاملاً لجميع المراحل والمهام المنجزة مؤخراً والمشكلات المبلغ عنها وقوائم الملاحظات.",
  "SkyStruct Lite Project Management. All rights reserved.": "SkyStruct Lite لإدارة المشاريع. جميع الحقوق محفوظة.",
  "Low": "منخفض",
  "Medium": "متوسط",
  "High": "عالٍ",
  "Critical": "حرج",
  "Open": "مفتوح",
  "In Progress": "قيد التنفيذ",
  "Resolved": "محلول",
  "Closed": "مغلق",
  "Draft": "مسودة",
  "Completed": "مكتمل",
  // standard PDF letterhead / footer (emailed project report)
  "Terms & Conditions: This report records site progress as reported on the stated date. Quantities and progress figures are indicative and subject to joint measurement and verification.": "الشروط والأحكام: يسجل هذا التقرير تقدم العمل في الموقع كما تم الإبلاغ عنه في التاريخ المذكور. الكميات وأرقام التقدم إرشادية وتخضع للقياس والتحقق المشترك.",
  "Page": "صفحة",
  "of": "من",
  "Project": "المشروع",
  "Generated on": "تاريخ الإنشاء",
  "Period": "الفترة",
};

/** 'ar' when the request asks for Arabic, otherwise 'en'. */
export function exportLang(url) {
  const v = (url.searchParams.get("lang") || "").toLowerCase();
  return v === "ar" ? "ar" : "en";
}

/** Translate a fixed export label (English passes through). */
export function xt(lang, text) {
  if (lang !== "ar" || typeof text !== "string") return text;
  return AR[text] ?? text;
}

/** Arabic workbooks open right-to-left in Excel. */
export function applySheetDirection(workbook, lang) {
  if (lang !== "ar") return;
  workbook.Workbook = workbook.Workbook || {};
  workbook.Workbook.Views = [{ RTL: true }];
}
