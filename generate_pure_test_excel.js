const XLSX = require("xlsx");
const fs = require("fs");
const path = require("path");

const testCases = [
  {
    "TC ID": "TC_LAB_001",
    "Module": "Labour Management",
    "Test Title": "[Positive] Add New Labourer with valid data",
    "Priority": "High",
    "Pre Condition": "User logged in as Admin/Supervisor. Navigated to Labour Management tab.",
    "Test Steps": "1. Click 'Add Labour'.\n2. Enter 'John Worker' in Full Name.\n3. Select 'Skilled'.\n4. Select 'Daily'.\n5. Enter '200' in Wage Amount.\n6. Click 'Save Labourer'.",
    "Expected Outcome": "Success toast appears. Modal closes. 'John Worker' appears in list with correct details.",
    "Current Output": "",
    "Status": ""
  },
  {
    "TC ID": "TC_LAB_002",
    "Module": "Labour Management",
    "Test Title": "[Negative] Add New Labourer with empty name",
    "Priority": "Medium",
    "Pre Condition": "User is on Add Labour modal.",
    "Test Steps": "1. Leave 'Full Name' blank.\n2. Enter '150' in Wage Amount.\n3. Click 'Save Labourer'.",
    "Expected Outcome": "Error toast 'Please fill name and wage amount' is displayed. Labourer is not saved.",
    "Current Output": "",
    "Status": ""
  },
  {
    "TC ID": "TC_LAB_003",
    "Module": "Labour Management",
    "Test Title": "[Negative] Add New Labourer with empty wage",
    "Priority": "Medium",
    "Pre Condition": "User is on Add Labour modal.",
    "Test Steps": "1. Enter 'Sam Smith' in Full Name.\n2. Leave 'Wage Amount' blank.\n3. Click 'Save Labourer'.",
    "Expected Outcome": "Error toast 'Please fill name and wage amount' is displayed. Labourer is not saved.",
    "Current Output": "",
    "Status": ""
  },
  {
    "TC ID": "TC_LAB_004",
    "Module": "Labour Management",
    "Test Title": "[Positive] Edit existing Labourer details",
    "Priority": "High",
    "Pre Condition": "Labourer 'John Worker' exists in the list.",
    "Test Steps": "1. Click the Pencil (Edit) icon next to 'John Worker'.\n2. Change Wage Amount to '250'.\n3. Click 'Save Changes'.",
    "Expected Outcome": "Success toast appears. List updates immediately to show new wage.",
    "Current Output": "",
    "Status": ""
  },
  {
    "TC ID": "TC_LAB_005",
    "Module": "Labour Management",
    "Test Title": "[Positive] Delete existing Labourer",
    "Priority": "High",
    "Pre Condition": "Labourer 'John Worker' exists in the list.",
    "Test Steps": "1. Click Pencil (Edit) icon next to 'John Worker'.\n2. Click the Trash (Delete) icon.\n3. Confirm deletion if prompted.",
    "Expected Outcome": "Success toast appears. 'John Worker' is permanently removed from the list.",
    "Current Output": "",
    "Status": ""
  },
  {
    "TC ID": "TC_LAB_006",
    "Module": "Bulk Attendance",
    "Test Title": "[Positive] Verify default unsaved attendance state",
    "Priority": "Medium",
    "Pre Condition": "Multiple labourers exist. No attendance saved for selected date.",
    "Test Steps": "1. Select a date with no attendance.\n2. View Labour list.",
    "Expected Outcome": "All labourers are checked (Present) by default with 'Full' day badge.",
    "Current Output": "",
    "Status": ""
  },
  {
    "TC ID": "TC_LAB_007",
    "Module": "Bulk Attendance",
    "Test Title": "[Positive] Mark labourer as Absent",
    "Priority": "High",
    "Pre Condition": "Labour list is displayed.",
    "Test Steps": "1. Uncheck the checkbox for a labourer.",
    "Expected Outcome": "Row turns greyish. 'Full' badge disappears. 'Absent' text appears in red.",
    "Current Output": "",
    "Status": ""
  },
  {
    "TC ID": "TC_LAB_008",
    "Module": "Bulk Attendance",
    "Test Title": "[Positive] Toggle labourer Half Day",
    "Priority": "High",
    "Pre Condition": "Labourer is checked (Present).",
    "Test Steps": "1. Click the 'Full' day badge.",
    "Expected Outcome": "Badge color changes to yellow/orange and text updates to 'Half'.",
    "Current Output": "",
    "Status": ""
  },
  {
    "TC ID": "TC_LAB_009",
    "Module": "Bulk Attendance",
    "Test Title": "[Positive] Save bulk attendance successfully",
    "Priority": "Critical",
    "Pre Condition": "Labour list loaded. Made changes to attendance state.",
    "Test Steps": "1. Mark Labourer A as Absent.\n2. Mark Labourer B as Half Day.\n3. Keep Labourer C as Full Day.\n4. Click 'Save Attendance'.",
    "Expected Outcome": "Success toast appears. Attendance is saved to backend without errors.",
    "Current Output": "",
    "Status": ""
  },
  {
    "TC ID": "TC_LAB_010",
    "Module": "Bulk Attendance",
    "Test Title": "[Positive] Verify reloaded attendance state",
    "Priority": "High",
    "Pre Condition": "Attendance saved successfully in previous test.",
    "Test Steps": "1. Change date to tomorrow, then change back to today to reload data.",
    "Expected Outcome": "List accurately reflects saved states (Absent, Half Day, Full Day).",
    "Current Output": "",
    "Status": ""
  },
  {
    "TC ID": "TC_LAB_011",
    "Module": "Payroll Export",
    "Test Title": "[Positive] Export Payroll Summary for valid dates",
    "Priority": "Critical",
    "Pre Condition": "User logged in as Admin. Attendance exists in date range.",
    "Test Steps": "1. Click Export icon.\n2. Select Start Date and End Date.\n3. Click 'Download Excel'.\n4. Open the downloaded file.",
    "Expected Outcome": "File contains 'Team Attendance' and 'Payroll Summary' sheets. Payroll sheet has data.",
    "Current Output": "",
    "Status": ""
  },
  {
    "TC ID": "TC_LAB_012",
    "Module": "Payroll Export",
    "Test Title": "[Positive] Verify Payroll Math Logic",
    "Priority": "Critical",
    "Pre Condition": "Labourer with 200 AED wage has 2 Full days, 1 Half day, 1 Absent in export range.",
    "Test Steps": "1. Locate labourer in Payroll Summary sheet.\n2. Verify the columns for Days Present, Half Days, Absent, and Total Earned.",
    "Expected Outcome": "Days Present = 2, Half Days = 1, Absent = 1. Total Earned = 500.",
    "Current Output": "",
    "Status": ""
  },
  {
    "TC ID": "TC_LAB_013",
    "Module": "Payroll Export",
    "Test Title": "[Negative] Export with no labour attendance",
    "Priority": "Low",
    "Pre Condition": "Select a date range where no labour attendance was marked.",
    "Test Steps": "1. Export Excel for the empty range.\n2. Open file.",
    "Expected Outcome": "File downloads successfully but does not contain a Payroll Summary sheet (or sheet is empty). No server crash.",
    "Current Output": "",
    "Status": ""
  },
  {
    "TC ID": "TC_LAB_014",
    "Module": "Security",
    "Test Title": "[Negative] Standard user attempts to view labour tab",
    "Priority": "High",
    "Pre Condition": "Logged in as standard non-admin worker.",
    "Test Steps": "1. Navigate to Project Attendance screen.",
    "Expected Outcome": "Labour Management tab is completely hidden. User cannot access labour data.",
    "Current Output": "",
    "Status": ""
  }
];

const worksheet = XLSX.utils.json_to_sheet(testCases);
const workbook = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(workbook, worksheet, "QA Test Cases");

const outPath = "C:\\Users\\indal\\Desktop\\QA_Pure_Test_Cases_Labour.xlsx";
XLSX.writeFile(workbook, outPath);

console.log("Excel file generated at:", outPath);
