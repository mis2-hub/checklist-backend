import pool from "../config/db.js";

export const getStaffTasks = async (req, res) => {
  try {
    const {
      dashboardType = "checklist",
      staffFilter = "all",
      page = 1,
      limit = 50,
      monthYear = "" // Add this parameter
    } = req.query;

    const table = dashboardType;
    const offset = (page - 1) * limit;

    let completedCondition = "";

    if (table === "checklist") {
      completedCondition = "status = 'yes'";
    } else {
      completedCondition = "LOWER(status) = 'yes'";
    }

    // Build date filter once
    let dateFilter = "";
    if (monthYear) {
      const [year, month] = monthYear.split('-').map(Number);
      const startDate = `${year}-${month.toString().padStart(2, '0')}-01`;
      const endDate = new Date(year, month, 0).toISOString().split('T')[0];
      dateFilter = `AND task_start_date >= '${startDate}' AND task_start_date <= '${endDate} 23:59:59'`;
    } else {
      dateFilter = `AND task_start_date <= NOW()`;
    }

    // Staff filter clause applied after splitting
    let staffFilterClause = "";
    if (staffFilter !== "all") {
      staffFilterClause = `AND LOWER(TRIM(individual_name)) = LOWER('${staffFilter.replace(/'/g, "''")}')`;
    }

    // STEP 1 — Split comma-separated names into individual rows, then get distinct names
    // This ensures "Ajit Patel, Madhusudan Patel, Vikas Yadav" is treated as 3 separate people
    const staffQuery = `
      SELECT DISTINCT TRIM(individual_name) AS name
      FROM (
        SELECT UNNEST(regexp_split_to_array(name, ',\\s*')) AS individual_name
        FROM ${table}
        WHERE name IS NOT NULL
        AND name != ''
        AND task_start_date IS NOT NULL
        ${dateFilter}
      ) AS split_names
      WHERE TRIM(individual_name) != ''
      ${staffFilterClause}
      ORDER BY name ASC
    `;

    const staffResult = await pool.query(staffQuery);
    const allStaff = staffResult.rows.map(r => r.name);

    const paginatedStaff = allStaff.slice(Number(offset), Number(offset) + Number(limit));

    if (paginatedStaff.length === 0) {
      return res.json([]);
    }

    const finalData = [];

    for (let staffName of paginatedStaff) {
      // Escape single quotes in name for SQL
      const escapedName = staffName.replace(/'/g, "''");

      // Match tasks where this individual name appears in the (possibly comma-separated) name field
      // Handles: exact match OR contained within a comma-separated list
      let taskQuery = `
        SELECT 
          COUNT(*) AS total,
          SUM(
             CASE 
               WHEN submission_date IS NOT NULL 
                 OR (${completedCondition})
               THEN 1 
               ELSE 0 
             END
          ) AS completed,
          SUM(
            CASE 
              WHEN submission_date IS NOT NULL AND submission_date <= task_start_date
              THEN 1 
              WHEN submission_date IS NULL AND ${completedCondition} AND task_start_date <= NOW()
              THEN 1
              ELSE 0 
            END
          ) AS done_on_time,
          AVG(
            CASE 
              WHEN submission_date IS NOT NULL AND submission_date > task_start_date
              THEN EXTRACT(EPOCH FROM (submission_date - task_start_date)) / 86400.0
              ELSE 0
            END
          ) AS avg_delay_days
        FROM ${table}
        WHERE (
          LOWER(TRIM(name)) = LOWER('${escapedName}')
          OR EXISTS (
            SELECT 1
            FROM UNNEST(regexp_split_to_array(name, ',\\s*')) AS individual_name
            WHERE LOWER(TRIM(individual_name)) = LOWER('${escapedName}')
          )
        )
        AND task_start_date IS NOT NULL
      `;

      // Add date filter to task query
      if (monthYear) {
        const [year, month] = monthYear.split('-').map(Number);
        const startDate = `${year}-${month.toString().padStart(2, '0')}-01`;
        const endDate = new Date(year, month, 0).toISOString().split('T')[0];
        taskQuery += ` AND task_start_date >= '${startDate}' AND task_start_date <= '${endDate} 23:59:59'`;
      } else {
        taskQuery += ` AND task_start_date <= NOW()`;
      }

      const taskResult = await pool.query(taskQuery);
      const total = Number(taskResult.rows[0].total);
      const completed = Number(taskResult.rows[0].completed);
      const doneOnTime = Number(taskResult.rows[0].done_on_time) || 0;
      const avgDelayDays = Number(taskResult.rows[0].avg_delay_days) || 0;
      const pending = total - completed;
      
      // Calculate on-time score as negative percentage
      let onTimeScore = 0;
      if (avgDelayDays > 0) {
        onTimeScore = -Math.min(100, Math.round(avgDelayDays * 100));
      } else if (completed > 0 && doneOnTime === completed) {
        onTimeScore = 100;
      }

      finalData.push({
        id: staffName.toLowerCase().replace(/\s+/g, "-"),
        name: staffName,
        email: `${staffName.toLowerCase().replace(/\s+/g, ".")}@example.com`,
        totalTasks: total,
        completedTasks: completed,
        pendingTasks: pending,
        doneOnTime: doneOnTime,
        onTimeScore: onTimeScore
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

    // Also fix count query to split comma-separated names
    let query = `
      SELECT COUNT(DISTINCT TRIM(individual_name)) AS count
      FROM (
        SELECT UNNEST(regexp_split_to_array(name, ',\\s*')) AS individual_name
        FROM ${table}
        WHERE name IS NOT NULL 
        AND name != ''
        AND task_start_date IS NOT NULL
        AND task_start_date::timestamp <= NOW()
      ) AS split_names
      WHERE TRIM(individual_name) != ''
    `;

    if (staffFilter !== "all") {
      query += ` AND LOWER(TRIM(individual_name)) = LOWER('${staffFilter.replace(/'/g, "''")}')`; 
    }

    const result = await pool.query(query);
    const count = Number(result.rows[0].count);

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
