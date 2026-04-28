import { sendDailySummaryNotification, sendDailyReminderNotification } from '../services/whatsappService.js';
import dotenv from 'dotenv';

dotenv.config();

async function runTests() {
    const testNumber = '917024965168'; // Using one of the numbers from your logs
    
    console.log('--- TESTING MORNING SUMMARY (checklist_daily_summary) ---');
    await sendDailySummaryNotification(testNumber, {
        name: 'John Doe',
        todayCount: 5,
        pendingCount: 2
    });

    console.log('\n--- TESTING EVENING REMINDER (checklist_evening_reminder) ---');
    await sendDailyReminderNotification(testNumber, {
        name: 'Test User',
        pendingCount: 10
    });
}

runTests();
