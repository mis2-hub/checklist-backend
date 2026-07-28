/**
 * Helper to format date object to 'YYYY-MM-DD' in local timezone.
 */
const getLocalDateString = (date) => {
    const offset = date.getTimezoneOffset();
    const localDate = new Date(date.getTime() - (offset * 60 * 1000));
    return localDate.toISOString().split("T")[0];
};
/**
 * Resolves date shortcut strings (today, yesterday, etc.) to start and end date strings.
 * Week starts on Monday and ends on Sunday.
 */
const resolveShortcutRange = (shortcut) => {
    const now = new Date();
    switch (shortcut) {
        case "today": {
            const d = getLocalDateString(now);
            return { start: d, end: d };
        }
        case "yesterday": {
            const prev = new Date();
            prev.setDate(now.getDate() - 1);
            const d = getLocalDateString(prev);
            return { start: d, end: d };
        }
        case "this week": {
            const currentDay = now.getDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
            const distanceToMonday = currentDay === 0 ? -6 : 1 - currentDay;
            const monday = new Date(now);
            monday.setDate(now.getDate() + distanceToMonday);
            const sunday = new Date(monday);
            sunday.setDate(monday.getDate() + 6);
            return {
                start: getLocalDateString(monday),
                end: getLocalDateString(sunday),
            };
        }
        case "last week": {
            const currentDay = now.getDay();
            const distanceToMonday = currentDay === 0 ? -6 : 1 - currentDay;
            const mondayThisWeek = new Date(now);
            mondayThisWeek.setDate(now.getDate() + distanceToMonday);
            const mondayLastWeek = new Date(mondayThisWeek);
            mondayLastWeek.setDate(mondayThisWeek.getDate() - 7);
            const sundayLastWeek = new Date(mondayLastWeek);
            sundayLastWeek.setDate(mondayLastWeek.getDate() + 6);
            return {
                start: getLocalDateString(mondayLastWeek),
                end: getLocalDateString(sundayLastWeek),
            };
        }
        case "this month": {
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
            const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
            return {
                start: getLocalDateString(startOfMonth),
                end: getLocalDateString(endOfMonth),
            };
        }
        case "last month": {
            const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
            return {
                start: getLocalDateString(startOfLastMonth),
                end: getLocalDateString(endOfLastMonth),
            };
        }
        default:
            return null;
    }
};
/**
 * Builds dynamic SQL where filters and parameter values from request queries.
 *
 * @param {Object} query - The req.query object.
 * @param {Array<string>} baseConditions - Default conditions (e.g. ['submission_date IS NOT NULL']).
 * @returns {Object} { whereClause, values }
 */
export const buildChecklistFilters = (query, baseConditions = ["submission_date IS NOT NULL"]) => {
    const conditions = [...baseConditions];
    const values = [];
    const role = query.role;
    const username = query.username;
    // 1. Role-based Access Control & Name Filter
    if (role && role !== "admin" && role !== "super_admin" && role !== "pc role" && username) {
        // Regular users can only see their own tasks
        values.push(username.trim());
        conditions.push(`($${values.length} = ANY(SELECT TRIM(n) FROM unnest(string_to_array(name, ',')) n))`);
    } else if (query.name && query.name !== "all") {
        // Admins filtering by a specific doer name
        values.push(query.name.trim());
        conditions.push(`($${values.length} = ANY(SELECT TRIM(n) FROM unnest(string_to_array(name, ',')) n))`);
    }
    // 2. Global Search Query
    if (query.search && query.search.trim()) {
        values.push(`%${query.search.trim()}%`);
        conditions.push(`(
      task_id::text ILIKE $${values.length} OR
      department ILIKE $${values.length} OR
      given_by ILIKE $${values.length} OR
      name ILIKE $${values.length} OR
      task_description ILIKE $${values.length} OR
      frequency ILIKE $${values.length} OR
      remark ILIKE $${values.length} OR
      status::text ILIKE $${values.length} OR
      admin_done_remarks ILIKE $${values.length} OR
      user_reply ILIKE $${values.length} OR
      admin_reply ILIKE $${values.length}
    )`);
    }
    // 3. Admin Done / Approval Status Filter (pending, approved, all)
    if (query.adminStatus) {
        const adminStatus = query.adminStatus.trim().toLowerCase();
        if (adminStatus === "pending") {
            conditions.push(`admin_done IS DISTINCT FROM 'Done'`);
        } else if (adminStatus === "approved") {
            conditions.push(`admin_done = 'Done'`);
        }
    } else if (query.approvalStatus) {
        // Fallback for backward compatibility
        const approvalStatus = query.approvalStatus.trim().toLowerCase();
        if (approvalStatus === "pending") {
            conditions.push(`admin_done IS DISTINCT FROM 'Done'`);
        } else if (approvalStatus === "completed" || approvalStatus === "approved") {
            conditions.push(`admin_done = 'Done'`);
        }
    }
    // 4. Department Filter
    if (query.department && query.department.trim() !== "all") {
        values.push(query.department.trim());
        conditions.push(`LOWER(department) = LOWER($${values.length})`);
    }
    // 4a. Given By Filter
    if (query.givenBy && query.givenBy.trim() !== "all") {
        values.push(query.givenBy.trim());
        conditions.push(`LOWER(given_by) = LOWER($${values.length})`);
    }
    // 5. File / Attachment Filter (view, no file, all)
    if (query.file) {
        const file = query.file.trim().toLowerCase();
        if (file === "view") {
            conditions.push(`image IS NOT NULL AND image <> ''`);
        } else if (file === "no file") {
            conditions.push(`image IS NULL OR image = ''`);
        }
    }
    // 6. User Status Filter - maps "ontime" to 'yes' and "delay" to 'no' (on-time/delay/all)
    if (query.status) {
        const status = query.status.trim().toLowerCase();
        if (status === "on-time" || status === "yes") {
            conditions.push(`status = 'yes'`);
        } else if (status === "delay" || status === "no") {
            conditions.push(`status = 'no'`);
        }
    }
    // 7. Submission Date Shortcut Range
    if (query.submission) {
        const range = resolveShortcutRange(query.submission.trim().toLowerCase());
        if (range) {
            values.push(range.start, range.end);
            conditions.push(`submission_date::date BETWEEN $${values.length - 1} AND $${values.length}`);
        }
    }
    // 8. Deadline Date Shortcut Range (on task_start_date)
    if (query.deadline) {
        const range = resolveShortcutRange(query.deadline.trim().toLowerCase());
        if (range) {
            values.push(range.start, range.end);
            conditions.push(`task_start_date::date BETWEEN $${values.length - 1} AND $${values.length}`);
        }
    }
    // 9. Raw Date Range (fromDate / toDate on task_start_date)
    if (query.fromDate) {
        values.push(query.fromDate.trim());
        conditions.push(`task_start_date::date >= $${values.length}`);
    }
    if (query.toDate) {
        values.push(query.toDate.trim());
        conditions.push(`task_start_date::date <= $${values.length}`);
    }
    // 10. Remarks Filter (with/without/all)
    if (query.remarks) {
        const remarks = query.remarks.trim().toLowerCase();
        if (remarks === "with") {
            conditions.push(`(
        (remark IS NOT NULL AND remark <> '') OR
        (user_reply IS NOT NULL AND user_reply <> '') OR
        (admin_reply IS NOT NULL AND admin_reply <> '') OR
        (admin_done_remarks IS NOT NULL AND admin_done_remarks <> '')
      )`);
        } else if (remarks === "without") {
            conditions.push(`(
        (remark IS NULL OR remark = '') AND
        (user_reply IS NULL OR user_reply = '') AND
        (admin_reply IS NULL OR admin_reply = '') AND
        (admin_done_remarks IS NULL OR admin_done_remarks = '')
      )`);
        }
    }
    // 11. Frequency Filter
    if (query.frequency && query.frequency.trim() !== "all") {
        values.push(query.frequency.trim());
        conditions.push(`LOWER(frequency) = LOWER($${values.length})`);
    }
    // 12. Reminder Filter
    if (query.reminder && query.reminder.trim() !== "all") {
        values.push(query.reminder.trim());
        conditions.push(`LOWER(enable_reminder) = LOWER($${values.length})`);
    }
    // 13. Attachment Filter
    if (query.attachment && query.attachment.trim() !== "all") {
        values.push(query.attachment.trim());
        conditions.push(`LOWER(require_attachment) = LOWER($${values.length})`);
    }
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    return {
        whereClause,
        values,
    };
};