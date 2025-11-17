import pool from "../config/db.js";

export const getStaffTasks = async (req, res) => {
  try {
    const {
      dashboardType = "checklist",
      staffFilter = "all",
      page = 1,
      limit = 50
    } = req.query;

    const table = dashboardType;
    const offset = (page - 1) * limit;

    let completedCondition = "";

    if (table === "checklist") {
      // ENUM so no LOWER()
      completedCondition = "status = 'yes'";
    } else {
      // TEXT so LOWER() allowed
      completedCondition = "LOWER(status) = 'yes'";
    }

    // STEP 1 — Fetch unique names
    let staffQuery = `
      SELECT DISTINCT name 
      FROM ${table}
      WHERE name IS NOT NULL
      AND name != ''
      AND task_start_date IS NOT NULL
      AND task_start_date <= NOW()
    `;

    if (staffFilter !== "all") {
      staffQuery += ` AND LOWER(name) = LOWER('${staffFilter}')`;
    }

    staffQuery += ` ORDER BY name ASC`;

    const staffResult = await pool.query(staffQuery);
    const allStaff = staffResult.rows.map(r => r.name);

    const paginatedStaff = allStaff.slice(offset, offset + limit);

    if (paginatedStaff.length === 0) {
      return res.json([]);
    }

    const finalData = [];

    for (let staffName of paginatedStaff) {

      const taskQuery = `
        SELECT 
          COUNT(*) AS total,
          SUM(
             CASE 
               WHEN submission_date IS NOT NULL 
                 OR (${completedCondition})
               THEN 1 
               ELSE 0 
             END
          ) AS completed
        FROM ${table}
        WHERE LOWER(name)=LOWER('${staffName}')
        AND task_start_date IS NOT NULL
        AND task_start_date <= NOW()
      `;

      const taskResult = await pool.query(taskQuery);
      const total = Number(taskResult.rows[0].total);
      const completed = Number(taskResult.rows[0].completed);
      const pending = total - completed;
      const progress = total ? Math.round((completed / total) * 100) : 0;

      finalData.push({
        id: staffName.toLowerCase().replace(/\s+/g, "-"),
        name: staffName,
        email: `${staffName.toLowerCase().replace(/\s+/g, ".")}@example.com`,
        totalTasks: total,
        completedTasks: completed,
        pendingTasks: pending,
        progress
      });
    }

    return res.json(finalData);

  } catch (err) {
    console.error("🔥 REAL ERROR →", err);
    res.status(500).json({ error: err.message });
  }
};




export const getStaffCount = async (req, res) => {
  try {
    const { dashboardType = "checklist", staffFilter = "all" } = req.query;
    const table = dashboardType;

    let query = `
      SELECT DISTINCT name 
      FROM ${table}
      WHERE name IS NOT NULL 
      AND name != ''
      AND task_start_date::timestamp <= NOW()
    `;

    if (staffFilter !== "all") {
      query += ` AND LOWER(name)=LOWER('${staffFilter}')`;
    }

    const result = await pool.query(query);
    const count = result.rows.length;

    return res.json(count);

  } catch (err) {
    console.error("Error in getStaffCount:", err);
    return res.status(500).json({ error: "Error fetching staff count" });
  }
};




export const getUsersCount = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT COUNT(*) FROM users
      WHERE user_name IS NOT NULL AND user_name != ''
    `);

    res.json(Number(result.rows[0].count));

  } catch (err) {
    console.error("Error in getUsersCount:", err);
    res.status(500).json({ error: "Error fetching total users count" });
  }
};
