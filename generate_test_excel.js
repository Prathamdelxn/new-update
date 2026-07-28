const XLSX = require("xlsx");
const fs = require("fs");
const path = require("path");

const testScenarios = [
  {
    "Scenario ID": "TS1.1",
    "Module": "Labour Management",
    "Test Title": "Add New Labourer (Success)",
    "Pre-conditions": "User is logged in as Admin/Supervisor. Project exists.",
    "Test Steps": "1. Navigate to Project -> Attendance -> Labour Management Tab.\n2. Click 'Add Labour'.\n3. Enter 'John Doe' in Full Name.\n4. Select Type 'Skilled'.\n5. Select Payment Cycle 'Daily'.\n6. Enter '150' in Wage Amount.\n7. Click 'Save Labourer'.",
    "Expected Result": "Success toast appears. Modal closes. 'John Doe' appears in the Labour List with correct subtext.",
    "Status": ""
  },
  {
    "Scenario ID": "TS1.2",
    "Module": "Labour Management",
    "Test Title": "Add New Labourer (Validation Failure)",
    "Pre-conditions": "User is on Labour Management Tab.",
    "Test Steps": "1. Click 'Add Labour'.\n2. Leave 'Full Name' blank. Enter '150' in Wage.\n3. Click 'Save Labourer'.",
    "Expected Result": "Error toast appears stating 'Please fill name and wage amount'. API is not called. Modal remains open.",
    "Status": ""
  },
  {
    "Scenario ID": "TS1.3",
    "Module": "Labour Management",
    "Test Title": "Edit Existing Labourer (Success)",
    "Pre-conditions": "'John Doe' exists as a labourer.",
    "Test Steps": "1. Find 'John Doe' in the list.\n2. Click the Pencil (Edit) icon.\n3. Change Wage Amount from '150' to '200'.\n4. Change Type to 'Unskilled'.\n5. Click 'Save Changes'.",
    "Expected Result": "Success toast appears. The UI refreshes to show the updated Type and Wage.",
    "Status": ""
  },
  {
    "Scenario ID": "TS1.4",
    "Module": "Labour Management",
    "Test Title": "Delete Existing Labourer (Success)",
    "Pre-conditions": "'John Doe' exists as a labourer.",
    "Test Steps": "1. Click the Pencil (Edit) icon next to 'John Doe'.\n2. Click the Red Trash (Delete) icon in the modal header.",
    "Expected Result": "Success toast appears. Modal closes. 'John Doe' is removed from the Labour List.",
    "Status": ""
  },
  {
    "Scenario ID": "TS1.5",
    "Module": "Labour Management",
    "Test Title": "Search Labourer functionality",
    "Pre-conditions": "Three labourers exist: 'Alpha', 'Bravo', 'Charlie'.",
    "Test Steps": "1. Type 'bra' in the search input field.",
    "Expected Result": "Only 'Bravo' is displayed in the list. 'Alpha' and 'Charlie' are hidden.",
    "Status": ""
  },
  {
    "Scenario ID": "TS2.1",
    "Module": "Bulk Attendance",
    "Test Title": "Default Unsaved State Verification",
    "Pre-conditions": "Project has 2 labourers. No attendance has been marked for Today.",
    "Test Steps": "1. Select Today's date on the calendar.\n2. Switch to Labour Management Tab.",
    "Expected Result": "Both labourers appear in the list. Both checkboxes are checked by default. The day type badge shows 'Full' (Present).",
    "Status": ""
  },
  {
    "Scenario ID": "TS2.2",
    "Module": "Bulk Attendance",
    "Test Title": "Mark Labourer as Absent",
    "Pre-conditions": "Continuing from TS2.1.",
    "Test Steps": "1. Uncheck the checkbox for Labourer 1.",
    "Expected Result": "The row turns slightly grey. The Day Type badge disappears and is replaced by red text saying 'Absent'.",
    "Status": ""
  },
  {
    "Scenario ID": "TS2.3",
    "Module": "Bulk Attendance",
    "Test Title": "Toggle Half Day",
    "Pre-conditions": "Continuing from TS2.2.",
    "Test Steps": "1. Click the 'Full' day badge for Labourer 2.\n2. Click the 'Half' day badge again.",
    "Expected Result": "1. The badge turns yellow/orange and the text changes to 'Half'.\n2. The badge turns green and the text reverts to 'Full'.",
    "Status": ""
  },
  {
    "Scenario ID": "TS2.4",
    "Module": "Bulk Attendance",
    "Test Title": "Save Bulk Attendance (Success)",
    "Pre-conditions": "Labourer 1 is marked Absent. Labourer 2 is marked Half Day. Labourer 3 is marked Full Day.",
    "Test Steps": "1. Click the 'Save Attendance' button.",
    "Expected Result": "Success toast 'Attendance saved successfully' appears. Database clears existing records for the date and saves the 3 new statuses.",
    "Status": ""
  },
  {
    "Scenario ID": "TS2.5",
    "Module": "Bulk Attendance",
    "Test Title": "Reload Saved State Verification",
    "Pre-conditions": "Attendance for Today was saved as per TS2.4.",
    "Test Steps": "1. Navigate to Team Attendance tab, then back to Labour Management tab to trigger a fresh data load.",
    "Expected Result": "The UI accurately reflects the saved state: Labourer 1 is Absent, Labourer 2 is Half, Labourer 3 is Full.",
    "Status": ""
  },
  {
    "Scenario ID": "TS3.1",
    "Module": "Excel Export & Payroll",
    "Test Title": "Trigger Export Download",
    "Pre-conditions": "User is logged in as Admin. Attendance data exists for multiple labourers over the last 3 days.",
    "Test Steps": "1. Click the Download (Export) icon in the header.\n2. Select Start Date: 3 days ago. End Date: Today.\n3. Click 'Download Excel'.",
    "Expected Result": "The Excel file is generated and the native device share sheet opens.",
    "Status": ""
  },
  {
    "Scenario ID": "TS3.2",
    "Module": "Excel Export & Payroll",
    "Test Title": "Verify Workbook Structure",
    "Pre-conditions": "Excel file is downloaded from TS3.1.",
    "Test Steps": "1. Open the .xlsx file in Excel or Google Sheets.",
    "Expected Result": "There must be exactly two sheets present: 'Team Attendance' and 'Payroll Summary'.",
    "Status": ""
  },
  {
    "Scenario ID": "TS3.3",
    "Module": "Excel Export & Payroll",
    "Test Title": "Verify Payroll Aggregation Logic",
    "Pre-conditions": "Labourer 'TestWorker': Wage = 200 AED/day. TestWorker's records: 2x Present, 1x Half Day, 1x Absent.",
    "Test Steps": "1. Open the 'Payroll Summary' sheet.\n2. Locate the row for 'TestWorker'.",
    "Expected Result": "Days Present = 2, Half Days = 1, Days Absent = 1, Base Wage = 200, Total Earned = 500.",
    "Status": ""
  },
  {
    "Scenario ID": "TS4.1",
    "Module": "Security",
    "Test Title": "Standard User Access Denial",
    "Pre-conditions": "Login as a standard user / Worker.",
    "Test Steps": "1. Open Project Attendance screen.",
    "Expected Result": "The tabs for 'Team Attendance' and 'Labour Management' are NOT visible. User can only see 'Your Attendance'.",
    "Status": ""
  }
];

const worksheet = XLSX.utils.json_to_sheet(testScenarios);
const workbook = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(workbook, worksheet, "Test Scenarios");

const outPath = "C:\\Users\\indal\\Desktop\\QA_Test_Scenarios_Labour_Attendance.xlsx";
XLSX.writeFile(workbook, outPath);

console.log("Excel file generated at:", outPath);
