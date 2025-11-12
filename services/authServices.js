import pool from "../config/db.js";

export const findUserByCredentials = async (username, password) => {
  try {
    let query, params;

    if (password && password.trim() !== "") {
      // 🔒 Normal login check (username + password)
      query = `
        SELECT id, username, role, page_access
        FROM public.login
        WHERE username = $1 AND password = $2
        LIMIT 1;
      `;
      params = [username, password];
    } else {
      // 🆔 Only check by username if password empty
      query = `
        SELECT id, username, role, page_access
        FROM public.login
        WHERE username = $1
        LIMIT 1;
      `;
      params = [username];
    }

    const { rows } = await pool.query(query, params);
    return rows.length > 0 ? rows[0] : null;
  } catch (error) {
    console.error("❌ Error in findUserByCredentials:", error);
    throw error;
  }
};
