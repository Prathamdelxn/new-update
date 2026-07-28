# Sky Lite Geo-Attendance System: Detailed Specification & User Journey

This document provides a comprehensive blueprint for the Sky Lite Geo-Attendance feature. It combines the required architectural changes with an in-depth explanation of every schema field and a step-by-step practical user journey for the final integrated system.

---

## Part 1: Architectural Changes to Existing System

### 1.1 Backend Changes (`sky-lite-api`)
*   **New Mongoose Model (`Attendance.js`)**: A dedicated collection to store all attendance logs.
*   **Modify `Project.js` Model**:
    *   Add `siteLocation` `{ latitude, longitude, address }` to define the project's physical center.
    *   Add `attendanceRadius` `(Number)` to define the allowed check-in geofence (e.g., 100 meters).
*   **New API Endpoints**:
    *   `POST /api/attendance/check-in`: Handles distance validation, photo upload, and record creation.
    *   `PUT /api/attendance/check-out`: Updates the active record and calculates `totalWorkHours`.
    *   `GET /api/attendance`: Retrieves attendance logs for reporting.

### 1.2 Frontend Changes (`sky-lite-mobile`)
*   **Permissions**: Request GPS (`expo-location`) and Camera (`expo-camera`) access from the OS.
*   **Project Settings UI**: Add inputs in the Project Creation/Edit screens for managers to define the `siteLocation` coordinates and `attendanceRadius`.
*   **Project Dashboard UI**: Add a dedicated "Attendance Widget" inside the project view showing today's status, working hours, and the Check-In / Check-Out buttons.

---

## Part 2: Detailed Schema Breakdown

Below is the exact schema needed for `Attendance.js`, with an explanation of *why* each field exists in this practical, construction-focused workflow.

```javascript
{
  organization: ObjectId, // MANDATORY: Enforces multi-tenancy. Ensures data belongs to the correct company.
  project: ObjectId,      // MANDATORY: Attendance is strictly tied to a physical project site.
  user: ObjectId,         // MANDATORY: The worker who is checking in.

  attendanceDate: String, // format: "YYYY-MM-DD". Crucial for fast daily queries, dashboard counts, and reports.

  checkInTime: Date,      // Timestamp of arrival.
  checkOutTime: Date,     // Timestamp of departure. Used with checkInTime to calculate duration.

  // The core of Geo-Attendance: Validates WHERE the user was during check-in.
  checkInLocation: {
    latitude: Number,
    longitude: Number,
    accuracy: Number,     // Ensures the GPS signal wasn't spoofed or highly inaccurate.
    address: String       // Human-readable fallback.
  },

  // Workers might check out from a different gate or zone within the large site.
  checkOutLocation: {
    latitude: Number,
    longitude: Number,
    accuracy: Number,
    address: String
  },

  totalWorkHours: Number, // Auto-calculated upon checkout (e.g., 9.5). Avoids complex on-the-fly math during reporting.

  status: {
    type: String,
    enum: ["Present", "Absent", "Half Day", "Late"],
    default: "Present"
  }, // Simplified status logic. Avoids heavy HR approval workflows.

  siteDistanceInMeters: Number, // e.g., 42. Shows exactly how far the worker was from the project center during check-in.
  withinAllowedRadius: Boolean, // e.g., true. A simple flag indicating if siteDistanceInMeters <= project.attendanceRadius.

  checkInPhoto: String,   // URL to the selfie. Highly effective in Dubai construction to prevent buddy-punching.

  notes: String,          // Optional context (e.g., "Arrived late due to Sheikh Zayed Rd traffic").

  source: {
    type: String,
    enum: ["Mobile"],
    default: "Mobile"
  }, // Future-proofing in case web or kiosk check-ins are added later.

  deviceInfo: {
    platform: String,     // "ios" or "android"
    appVersion: String    // Useful for debugging if a user claims the app failed to record their location.
  },

  createdAt: Date,
  updatedAt: Date
}
```

---

## Part 3: Practical User Journey (Post-Integration)

This section describes exactly what the users will experience on site once this system is live.

### Scenario A: The Site Worker's Daily Routine

**1. Arriving at the Site**
*   **07:55 AM**: The worker arrives at the Dubai Marina project site.
*   **Action**: Opens the Sky Lite app and taps on the "Dubai Marina" project card.
*   **UI**: At the top of the project dashboard, they see the Attendance Widget. It says `Status: Not Checked In`.
*   **Action**: They tap the large blue **[ Check In ]** button.

**2. The Check-In Process**
*   **GPS Check (Background)**: The app instantly fetches their GPS coordinates and compares it to the project's `siteLocation`. It determines the worker is `30 meters` away (well within the 100m radius).
*   **Photo Capture**: The front-facing camera opens automatically. The worker takes a quick selfie wearing their hardhat.
*   **Confirmation**: The app uploads the data. The widget immediately updates to green: `Today's Status: Present (Checked in at 07:57 AM)`.

**3. Leaving the Site**
*   **05:00 PM**: Shift is over.
*   **Action**: The worker opens the app, goes to the project, and taps **[ Check Out ]**.
*   **GPS Check**: The app records their check-out location (perhaps they are at the North Gate now).
*   **Confirmation**: The backend calculates the time. The widget updates to: `Working Hours: 9h 3m`.

### Scenario B: The "Late" or "Out of Bounds" Worker

*   **08:30 AM**: A worker is running late and is still in traffic 2km away from the site.
*   **Attempt**: They open the app and try to tap **[ Check In ]**.
*   **Result**: The app detects they are `2000 meters` away. A prompt appears: *"You are outside the allowed project radius. You must be on-site to check in."* The check-in is blocked.
*   **08:45 AM**: The worker arrives on site. They check in successfully. The backend notes the time is past the standard start time and flags their `status` as **Late**.

### Scenario C: The Project Manager's View

*   **10:00 AM**: The Project Manager wants to see who is on site.
*   **Action**: Opens the Sky Lite Admin Dashboard.
*   **View**: They navigate to the "Attendance Report" for the Dubai Marina project.
*   **Data Displayed**: They see a clean list:
    *   *Ali (Present)* - Arrived 07:45 AM. Checked in 12 meters from site. [View Selfie]
    *   *Omar (Late)* - Arrived 08:45 AM. Checked in 45 meters from site. [View Selfie]
    *   *Zaid (Absent)* - No check-in record for today.

---

## Conclusion
By implementing this exact flow and schema, Sky Lite achieves a highly secure, location-verified attendance system tailored specifically for site operations, completely bypassing the unnecessary friction of corporate HR software.
