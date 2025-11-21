import axios from "axios";
import pool from "../config/db.js";  // PostgreSQL pool

export const syncDeviceLogs = async (req, res) => {
  try {
    const today = new Date().toISOString().split("T")[0];

    const IN_API_URL = `http://139.167.179.193:90/api/v2/WebAPI/GetDeviceLogs?APIKey=205511032522&SerialNumber=E03C1CB34D83AA02&FromDate=${today}&ToDate=${today}`;
    const OUT_API_URL = `http://139.167.179.193:90/api/v2/WebAPI/GetDeviceLogs?APIKey=205511032522&SerialNumber=E03C1CB36042AA02&FromDate=${today}&ToDate=${today}`;

    const [inRes, outRes] = await Promise.all([
      axios.get(IN_API_URL),
      axios.get(OUT_API_URL)
    ]);

    const inLogs = inRes.data || [];
    const outLogs = outRes.data || [];

    const allLogs = [...inLogs, ...outLogs];

    // sort latest first
    allLogs.sort((a, b) => new Date(b.LogDate) - new Date(a.LogDate));

    const employeeMap = {};

    allLogs.forEach((log) => {
      const emp = log.EmployeeCode;
      const punch = log.PunchDirection?.toLowerCase();
      const logDate = new Date(log.LogDate);

      // take last punch only because sorted latest first
      if (!employeeMap[emp]) {
        employeeMap[emp] = {
          lastPunch: punch,
          lastDate: logDate,
          serial: log.SerialNumber
        };
      }
    });

    const promises = Object.entries(employeeMap).map(async ([employee_id, info]) => {
      let finalStatus = "inactive";

      const logDay = new Date(info.lastDate).toISOString().split("T")[0];

      // If today
      if (logDay === today) {
        finalStatus = info.lastPunch === "in" ? "active" : "inactive";
      } else {
        // Yesterday or before → always inactive
        finalStatus = "inactive";
      }

      // Update DB
      const query = `
        UPDATE users
        SET status = $1,
            last_punch_time = $2,
            last_punch_device = $3
        WHERE employee_id = $4
      `;

      await pool.query(query, [
        finalStatus,
        info.lastDate,
        info.serial,
        employee_id
      ]);
    });

    await Promise.all(promises);

    res.json({ success: true, message: "Device logs synced & status updated" });
  } catch (error) {
    console.log("SYNC ERROR:", error);
    res.status(500).json({ error: "Device sync failed" });
  }
};
