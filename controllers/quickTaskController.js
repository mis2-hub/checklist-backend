import pool from "../config/db.js";

// ------------------------ FETCH CHECKLIST ------------------------
export const fetchChecklist = async (page = 0, pageSize = 50, nameFilter = '') => {
  try {
    const start = page * pageSize;
    const end = start + pageSize - 1;

    // Step 1: Get unique task_descriptions
    let uniqueQuery = `
      SELECT task_description 
      FROM checklist 
      WHERE submission_date IS NULL
      AND task_description IS NOT NULL
    `;

    if (nameFilter) {
      uniqueQuery += ` AND name = '${nameFilter}' `;
    }

    const uniqueRes = await pool.query(uniqueQuery);

    // Unique descriptions
    const seen = new Set();
    const uniqueDescriptions = uniqueRes.rows
      .map(r => r.task_description)
      .filter(desc => {
        if (!desc || seen.has(desc)) return false;
        seen.add(desc);
        return true;
      });

    const paginated = uniqueDescriptions.slice(start, end + 1);

    if (paginated.length === 0) {
      return { data: [], total: uniqueDescriptions.length };
    }

    // Step 2: fetch real rows
    let dataQuery = `
      SELECT * FROM checklist
      WHERE task_description = ANY($1)
      AND submission_date IS NULL
      ORDER BY task_start_date ASC
    `;

    const dataRes = await pool.query(dataQuery, [paginated]);

    const finalSeen = new Set();
    const finalData = dataRes.rows.filter(row => {
      if (finalSeen.has(row.task_description)) return false;
      finalSeen.add(row.task_description);
      return true;
    });

    return { data: finalData, total: uniqueDescriptions.length };
  } catch (err) {
    console.log(err);
    return { data: [], total: 0 };
  }
};


export const fetchDelegation = async (page = 0, pageSize = 50, nameFilter = '') => {
  try {
    const start = page * pageSize;
    const end = start + pageSize - 1;

    let uniqueQuery = `
      SELECT task_description
      FROM delegation
      WHERE submission_date IS NULL
      AND task_description IS NOT NULL
    `;

    if (nameFilter) {
      uniqueQuery += ` AND name = '${nameFilter}' `;
    }

    const uniqueRes = await pool.query(uniqueQuery);

    const seen = new Set();
    const uniqueDescriptions = uniqueRes.rows
      .map(r => r.task_description)
      .filter(desc => {
        if (!desc || seen.has(desc)) return false;
        seen.add(desc);
        return true;
      });

    const paginated = uniqueDescriptions.slice(start, end + 1);

    if (paginated.length === 0) {
      return { data: [], total: uniqueDescriptions.length };
    }

    let dataQuery = `
      SELECT * FROM delegation
      WHERE task_description = ANY($1)
      AND submission_date IS NULL
      ORDER BY task_id ASC
    `;

    const dataRes = await pool.query(dataQuery, [paginated]);

    const finalSeen = new Set();
    const finalData = dataRes.rows.filter(row => {
      if (finalSeen.has(row.task_description)) return false;
      finalSeen.add(row.task_description);
      return true;
    });

    return { data: finalData, total: uniqueDescriptions.length };
  } catch (err) {
    console.log(err);
    return { data: [], total: 0 };
  }
};


export const deleteChecklistTasks = async (tasks) => {
  for (const t of tasks) {
    await pool.query(
      `
      DELETE FROM checklist
      WHERE name = $1
      AND task_description = $2
      AND submission_date IS NULL
      `,
      [t.name, t.task_description]
    );
  }

  return tasks;
};


export const deleteDelegationTasks = async (taskIds) => {
  await pool.query(
    `
    DELETE FROM delegation
    WHERE task_id = ANY($1)
    AND submission_date IS NULL
    `,
    [taskIds]
  );

  return taskIds;
};


export const updateChecklistTask = async (updatedTask, originalTask) => {
  try {
    const sql = `
      UPDATE checklist
      SET 
        department = $1,
        given_by = $2,
        name = $3,
        task_description = $4,
        enable_reminder = $5,
        require_attachment = $6,
        remark = $7
      WHERE department = $8
      AND name = $9
      AND task_description = $10
      AND submission_date IS NULL
      RETURNING *;
    `;

    const values = [
      updatedTask.department,
      updatedTask.given_by,
      updatedTask.name,
      updatedTask.task_description,
      updatedTask.enable_reminder,
      updatedTask.require_attachment,
      updatedTask.remark,

      originalTask.department,
      originalTask.name,
      originalTask.task_description
    ];

    const res = await pool.query(sql, values);
    return res.rows;
  } catch (err) {
    console.log(err);
    throw err;
  }
};
