import pool from "../config/db.js";

// Helper function to sanitize enum values (handle "NULL" strings, empty values, etc.)
const sanitizeEnumValue = (value, defaultValue = 'no') => {
  // Handle null, undefined, or falsy values
  if (!value) return defaultValue;
  
  // Convert to string safely
  const strValue = String(value).trim();
  
  // Handle empty string or "NULL" string (case-insensitive)
  if (strValue === '' || strValue.toUpperCase() === 'NULL') {
    return defaultValue;
  }
  
  // Return the value in lowercase for consistency
  return strValue.toLowerCase();
};

// Helper function to sanitize non-text fields (convert "NULL" strings to actual null)
const sanitizeNullValue = (value) => {
  // Handle null, undefined, or falsy values
  if (!value) return null;
  
  // Convert to string safely and check
  const strValue = String(value).trim();
  
  // Handle empty string or "NULL" string (case-insensitive)
  if (strValue === '' || strValue.toUpperCase() === 'NULL') {
    return null;
  }
  
  // Return the original value
  return value;
};

// Bulk import into checklist table
export const bulkImportChecklist = async (req, res) => {
  try {
    const tasks = req.body;

    if (!Array.isArray(tasks) || tasks.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: "Invalid data: Expected array of tasks" 
      });
    }

    // Validate required fields for checklist
    const requiredFields = ['name', 'task_description'];
    const errors = [];
    
    tasks.forEach((task, index) => {
      requiredFields.forEach(field => {
        if (!task[field]) {
          errors.push(`Row ${index + 1}: Missing required field '${field}'`);
        }
      });
    });

    if (errors.length > 0) {
      return res.status(400).json({ 
        success: false, 
        message: "Validation errors", 
        errors 
      });
    }

    // Build dynamic INSERT query
    const values = [];
    const params = [];
    let paramIndex = 1;

    tasks.forEach((task) => {
      const taskParams = [];
      const placeholders = [];

      // Define column mapping (skip task_id and created_at as they're auto-generated)
      const columns = {
        department: task.department || null,
        given_by: task.given_by || null,
        name: task.name,
        task_description: task.task_description,
        // Handle string "NULL", empty strings, and null values for enum fields
        enable_reminder: sanitizeEnumValue(task.enable_reminder, 'no'),
        require_attachment: sanitizeEnumValue(task.require_attachment, 'no'),
        frequency: task.frequency || null,
        remark: task.remark || null,
        status: sanitizeEnumValue(task.status, 'no'),
        image: task.image || null,
        admin_done: task.admin_done || null,
        delay: sanitizeNullValue(task.delay),
        planned_date: sanitizeNullValue(task.planned_date),
        task_start_date: sanitizeNullValue(task.task_start_date),
        submission_date: sanitizeNullValue(task.submission_date)
      };

      Object.values(columns).forEach(value => {
        placeholders.push(`$${paramIndex++}`);
        taskParams.push(value);
      });

      values.push(`(${placeholders.join(', ')})`);
      params.push(...taskParams);
    });

    const columnNames = [
      'department', 'given_by', 'name', 'task_description',
      'enable_reminder', 'require_attachment', 'frequency',
      'remark', 'status', 'image', 'admin_done', 'delay',
      'planned_date', 'task_start_date', 'submission_date'
    ];

    const query = `
      INSERT INTO checklist (${columnNames.join(', ')})
      VALUES ${values.join(', ')}
      RETURNING task_id, created_at
    `;

    const result = await pool.query(query, params);

    res.json({
      success: true,
      message: `Successfully imported ${result.rows.length} tasks`,
      count: result.rows.length,
      insertedIds: result.rows.map(r => r.task_id)
    });

  } catch (error) {
    console.error("Bulk import checklist error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Failed to import tasks", 
      error: error.message 
    });
  }
};

// Bulk import into delegation table
export const bulkImportDelegation = async (req, res) => {
  try {
    const tasks = req.body;

    if (!Array.isArray(tasks) || tasks.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: "Invalid data: Expected array of tasks" 
      });
    }

    // Validate required fields for delegation
    const requiredFields = ['name', 'task_description'];
    const errors = [];
    
    tasks.forEach((task, index) => {
      requiredFields.forEach(field => {
        if (!task[field]) {
          errors.push(`Row ${index + 1}: Missing required field '${field}'`);
        }
      });
    });

    if (errors.length > 0) {
      return res.status(400).json({ 
        success: false, 
        message: "Validation errors", 
        errors 
      });
    }

    // Build dynamic INSERT query
    const values = [];
    const params = [];
    let paramIndex = 1;

    tasks.forEach((task) => {
      const taskParams = [];
      const placeholders = [];

      // Define column mapping (skip task_id and created_at as they're auto-generated)
      const columns = {
        department: task.department || null,
        given_by: task.given_by || null,
        name: task.name,
        task_description: task.task_description,
        // Handle string "NULL", empty strings, and null values for enum fields
        enable_reminder: sanitizeEnumValue(task.enable_reminder, 'no'),
        require_attachment: sanitizeEnumValue(task.require_attachment, 'no'),
        frequency: task.frequency || null,
        remark: task.remark || null,
        status: sanitizeEnumValue(task.status, 'no'),
        image: task.image || null,
        admin_done: task.admin_done || null,
        delay: sanitizeNullValue(task.delay),
        planned_date: sanitizeNullValue(task.planned_date),
        task_start_date: sanitizeNullValue(task.task_start_date),
        submission_date: sanitizeNullValue(task.submission_date)
      };

      Object.values(columns).forEach(value => {
        placeholders.push(`$${paramIndex++}`);
        taskParams.push(value);
      });

      values.push(`(${placeholders.join(', ')})`);
      params.push(...taskParams);
    });

    const columnNames = [
      'department', 'given_by', 'name', 'task_description',
      'enable_reminder', 'require_attachment', 'frequency',
      'remark', 'status', 'image', 'admin_done', 'delay',
      'planned_date', 'task_start_date', 'submission_date'
    ];

    const query = `
      INSERT INTO delegation (${columnNames.join(', ')})
      VALUES ${values.join(', ')}
      RETURNING task_id, created_at
    `;

    const result = await pool.query(query, params);

    res.json({
      success: true,
      message: `Successfully imported ${result.rows.length} tasks`,
      count: result.rows.length,
      insertedIds: result.rows.map(r => r.task_id)
    });

  } catch (error) {
    console.error("Bulk import delegation error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Failed to import tasks", 
      error: error.message 
    });
  }
};
