import cron from 'node-cron';
import pool from '../config/db.js';
import { sendDailySummaryNotification } from './whatsappService.js';

/**
 * Initialize all cron jobs
 */
export const initCronJobs = () => {
    // Schedule: Daily at 9:00 AM
    // Seconds Minutes Hours DayOfMonth Month DayOfWeek
    cron.schedule('0 9 * * *', async () => {
        console.log('⏰ Running Daily WhatsApp Summary Cron Job (9:00 AM)...');
        await sendDailySummaries();
    }, {
        scheduled: true,
        timezone: "Asia/Kolkata"
    });

    console.log('🚀 Cron Jobs Initialized (Daily Summary @ 9:00 AM)');
};

/**
 * Fetch pending and overdue tasks for each active user and send WhatsApp notifications
 */
const sendDailySummaries = async () => {
    try {
        // 0. Check if today is a working day
        const workingDayQuery = `
            SELECT COUNT(*) FROM working_day_calender
            WHERE working_date::date = CURRENT_DATE
        `;
        const { rows: workingDayRows } = await pool.query(workingDayQuery);
        
        if (parseInt(workingDayRows[0].count) === 0) {
            console.log('ℹ️ Today is not a working day according to the calendar. Skipping WhatsApp summaries.');
            return;
        }

        // 1. Fetch all active users who have a phone number
        const userQuery = `
            SELECT user_name, number 
            FROM users 
            WHERE status = 'active' 
              AND number IS NOT NULL 
              AND number <> 0
        `;
        const { rows: users } = await pool.query(userQuery);

        if (users.length === 0) {
            console.log('ℹ️ No active users with phone numbers found.');
            return;
        }

        console.log(`📊 Processing summaries for ${users.length} users...`);

        // 2. For each user, get task counts
        for (const user of users) {
            const userName = user.user_name;
            const phoneNumber = user.number;

            try {
                // Query counts from BOTH checklist and delegation tables
                // 1. Total Tasks: All assigned till date (<= CURRENT_DATE)
                // 2. Total Pending: All incomplete till date (<= CURRENT_DATE AND submission_date IS NULL)
                // 3. Today's Tasks: All assigned specifically for today (== CURRENT_DATE)
                const taskQuery = `
                    WITH checklist_summary AS (
                        SELECT 
                            COUNT(*) as total_till_date,
                            COUNT(*) FILTER (WHERE submission_date IS NULL) as pending_till_date,
                            COUNT(*) FILTER (WHERE task_start_date::date = CURRENT_DATE) as today_total
                        FROM checklist
                        WHERE LOWER(name) = LOWER($1)
                          AND task_start_date::date <= CURRENT_DATE
                    ),
                    delegation_summary AS (
                        SELECT 
                            COUNT(*) as total_till_date,
                            COUNT(*) FILTER (WHERE submission_date IS NULL AND (status IS NULL OR status = '' OR status IN ('pending', 'extend'))) as pending_till_date,
                            COUNT(*) FILTER (WHERE task_start_date::date = CURRENT_DATE) as today_total
                        FROM delegation
                        WHERE LOWER(name) = LOWER($1)
                          AND task_start_date::date <= CURRENT_DATE
                    )
                    SELECT 
                        (c.total_till_date + d.total_till_date) as total_tasks,
                        (c.pending_till_date + d.pending_till_date) as total_pending,
                        (c.today_total + d.today_total) as today_tasks
                    FROM checklist_summary c, delegation_summary d
                `;
                
                const { rows: counts } = await pool.query(taskQuery, [userName]);
                const totalTasks = parseInt(counts[0].total_tasks || 0);
                const totalPending = parseInt(counts[0].total_pending || 0);
                const todayTasks = parseInt(counts[0].today_tasks || 0);

                // 3. Send notification if there are any tasks assigned till today (even if completed)
                if (totalTasks > 0) {
                    const result = await sendDailySummaryNotification(phoneNumber, {
                        name: userName,
                        totalTasks: totalTasks,      // {{2}}
                        pendingCount: totalPending,  // {{3}}
                        todayCount: todayTasks       // {{4}}
                    });

                    if (result.success) {
                        console.log(`✅ Daily summary sent to ${userName} (${phoneNumber})`);
                    } else {
                        console.error(`❌ Failed to send summary to ${userName}:`, result.error);
                    }
                } else {
                    console.log(`ℹ️ No tasks assigned for ${userName} up to today, skipping notification.`);
                }

            } catch (userError) {
                console.error(`❌ Error processing summary for user ${userName}:`, userError.message);
            }
        }

        console.log('✅ Daily WhatsApp Summary Cron Job Completed.');

    } catch (error) {
        console.error('❌ Critical Error in Daily WhatsApp Summary Cron Job:', error.message);
    }
};

export default { initCronJobs };
