import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const META_ACCESS_TOKEN = process.env.ACCESS_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;
const WABA_ID = process.env.WABA_ID;
const META_API_URL = `https://graph.facebook.com/v18.0/${PHONE_NUMBER_ID}/messages`;

// Template Names from .env
const TEMPLATE_ASSIGN = process.env.TASK_ASSIGN_REMINDER; // task_assignment_reminder
const TEMPLATE_COMPLETE = process.env.DELEGATION_TASK_COMPLETE; // delegation_task_complete
const TEMPLATE_EXTEND = process.env.DELEGATION_TASK_EXTENDED; // delegation_task_extended
const TEMPLATE_URGENT = process.env.URGENT_TASK_ALERT; // urgent_task_alert
const TEMPLATE_DAILY_SUMMARY = process.env.DAILY_TASK_REMINDER; // checklist_daily_summary
const TEMPLATE_USER_REPLY = process.env.USER_DELEGATION_REPLY; 
const TEMPLATE_ADMIN_REPLY = process.env.ADMIN_DELEGATION_REPLY;
const TEMPLATE_REVERT = process.env.DELEGATION_TASK_REVERT; // delegation_task_revert
const TEMPLATE_EVENING_REMINDER = process.env.DAILY_EVENING_REMINDER;
const ADMIN_NUMBER = process.env.ADMIN_WHATSAPP_NUMBER;

/**
 * Format phone number for WhatsApp
 * Ensures the number includes country code (defaults to India +91)
 */
const formatPhoneNumber = (phoneNumber) => {
  if (!phoneNumber) return null;
  
  // Convert to string and remove any spaces, dashes, parentheses or plus signs
  let phone = String(phoneNumber).replace(/[\s\-\(\)\+]/g, '');
  
  // If already 12 digits and starts with 91, it's already formatted correctly for India
  if (phone.length === 12 && phone.startsWith('91')) {
    return phone;
  }

  // If number starts with 0 and is 11 digits (0 + 10 digits), replace with 91 (India)
  if (phone.startsWith('0') && phone.length === 11) {
    phone = '91' + phone.substring(1);
  }
  
  // If number doesn't have country code (is 10 digits), add 91
  if (phone.length === 10) {
    phone = '91' + phone;
  }
  
  return phone;
};

/**
 * Format date to readable format (YYYY-MM-DD HH:mm:ss)
 */
const formatDate = (dateStr) => {
  if (!dateStr) return 'N/A';
  
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  } catch (e) {
    return dateStr;
  }
};

/**
 * Format date to dd-mm-yyyy format
 */
const formatDateDDMMYYYY = (dateStr) => {
  if (!dateStr) return 'N/A';
  
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    
    return `${day}-${month}-${year} ${hours}:${minutes}:${seconds}`;
  } catch (e) {
    return dateStr;
  }
};

// Default Logo URL (Fixed 403 Forbidden issue)
const DEFAULT_IMAGE_URL = 'https://drive.google.com/uc?export=download&id=1gb2U7C8DpdVXIJuyd75cYth8YIATg5sM'; // Direct image download link required by Meta API

/**
 * Truncate a string to Meta WhatsApp's 1024-char template parameter limit
 */
const truncate = (str, max = 1024) => {
  if (!str) return 'N/A';
  const s = String(str);
  return s.length > max ? s.substring(0, max - 3) + '...' : s;
};

/**
 * Internal helper to send message via Meta Cloud API
 */
const sendMetaWhatsApp = async (payload) => {
  try {
    if (!META_ACCESS_TOKEN || !PHONE_NUMBER_ID) {
      console.error('❌ Meta WhatsApp configuration missing in .env');
      return { success: false, error: 'Configuration missing' };
    }

    console.log('📤 Sending Meta Payload:', JSON.stringify(payload, null, 2));

    const response = await axios.post(
      META_API_URL,
      payload,
      {
        headers: {
          'Authorization': `Bearer ${META_ACCESS_TOKEN}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      }
    );

    console.log('✅ Meta WhatsApp API Response:', JSON.stringify(response.data, null, 2));
    return { success: true, data: response.data };

  } catch (error) {
    // This will print the exact reason Meta rejected the message
    console.log("Meta API Error Details:", JSON.stringify(error.response?.data || error.message, null, 2));
    
    const errorData = error.response?.data || error.message;
    return { success: false, error: errorData };
  }
};

/**
 * Send raw text message (Only works if user messaged first within 24h)
 * @param {string|number} phoneNumber 
 * @param {string} message 
 */
export const sendWhatsAppMessage = async (phoneNumber, message) => {
  const formattedPhone = formatPhoneNumber(phoneNumber);
  if (!formattedPhone) return { success: false, error: 'Invalid phone number' };

  console.log(`📱 Sending Text via Meta to: ${formattedPhone}`);

  const payload = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: formattedPhone,
    type: "text",
    text: {
      preview_url: true,
      body: message
    }
  };

  return await sendMetaWhatsApp(payload);
};

/**
 * Send task assignment notification via Meta Template
 */
export const sendTaskAssignmentNotification = async (phoneNumber, taskDetails) => {
  const formattedPhone = formatPhoneNumber(phoneNumber);
  if (!formattedPhone) return { success: false, error: 'Invalid phone number' };

  const { doerName, taskId, givenBy, description, dueDate, imageUrl, taskType } = taskDetails;

  console.log(`📱 Sending Task Assignment Template via Meta to: ${formattedPhone}`);

  const payload = {
    messaging_product: "whatsapp",
    to: formattedPhone,
    type: "template",
    template: {
      name: TEMPLATE_ASSIGN,
      language: { code: "en" },
      components: [
        {
          type: "header",
          parameters: [
            {
              type: "image",
              image: { link: imageUrl || DEFAULT_IMAGE_URL }
            }
          ]
        },
        {
          type: "body",
          parameters: [
            { type: "text", text: doerName || 'Team Member' },
            { type: "text", text: taskId || 'N/A' },
            { type: "text", text: givenBy || 'N/A' },
            { type: "text", text: description || 'N/A' },
            { type: "text", text: formatDate(dueDate) },
            { type: "text", text: taskType || 'Task' }
          ]
        }
      ]
    }
  };

  return await sendMetaWhatsApp(payload);
};

/**
 * Send Delegation Done Notification via Meta Template (to Admin)
 */
export const sendDelegationDoneNotification = async (taskDetails, updateType) => {
  const formattedPhone = formatPhoneNumber(ADMIN_NUMBER);
  if (!formattedPhone) return { success: false, error: 'Invalid admin phone number' };

  const { name, task_id, task_description, reason, remarks, submission_date } = taskDetails;
  const finalRemarks = reason || remarks || 'N/A';
  
  let statusText = 'Completed';
  if (updateType === 'partial_done') {
    statusText = 'Partially Done';
  }

  console.log(`📱 Sending Delegation Done Template (${statusText}) via Meta to Admin: ${formattedPhone}`);

  const payload = {
    messaging_product: "whatsapp",
    to: formattedPhone,
    type: "template",
    template: {
      name: TEMPLATE_COMPLETE,
      language: { code: "en" },
      components: [
        {
          type: "body",
          parameters: [
            { type: "text", text: truncate(name, 100) },
            { type: "text", text: String(task_id || 'N/A') },
            { type: "text", text: truncate(task_description, 500) },
            { type: "text", text: truncate(finalRemarks, 500) },
            { type: "text", text: formatDateDDMMYYYY(submission_date || new Date()) },
            { type: "text", text: statusText }
          ]
        }
      ]
    }
  };

  return await sendMetaWhatsApp(payload);
};

/**
 * Send Delegation Extend Notification via Meta Template (to Admin)
 */
export const sendDelegationExtendNotification = async (taskDetails) => {
  const formattedPhone = formatPhoneNumber(ADMIN_NUMBER);
  if (!formattedPhone) return { success: false, error: 'Invalid admin phone number' };

  const { name, task_id, task_description, next_extend_date, reason } = taskDetails;

  console.log(`📱 Sending Delegation Extend Template via Meta to Admin: ${formattedPhone}`);

  const payload = {
    messaging_product: "whatsapp",
    to: formattedPhone,
    type: "template",
    template: {
      name: TEMPLATE_EXTEND,
      language: { code: "en" },
      components: [
        {
          type: "header",
          parameters: [
            { type: "text", text: 'Admin' }           // Hello {{1}}
          ]
        },
        {
          type: "body",
          parameters: [
            { type: "text", text: truncate(name, 100) },
            { type: "text", text: String(task_id || 'N/A') },
            { type: "text", text: truncate(task_description, 500) },
            { type: "text", text: truncate(reason, 500) },
            { type: "text", text: formatDateDDMMYYYY(next_extend_date) }
          ]
        }
      ]
    }
  };

  return await sendMetaWhatsApp(payload);
};

/**
 * Send Urgent Alert Notification via Meta Template
 */
export const sendUrgentAlertNotification = async (phoneNumber, details) => {
  const formattedPhone = formatPhoneNumber(phoneNumber);
  if (!formattedPhone) return { success: false, error: 'Invalid phone number' };

  const { name, taskId, description, plannedDate, givenBy, imageUrl } = details;

  console.log(`📱 Sending Urgent Alert Template via Meta to: ${formattedPhone}`);

  const payload = {
    messaging_product: "whatsapp",
    to: formattedPhone,
    type: "template",
    template: {
      name: TEMPLATE_URGENT,
      language: { code: "en" },
      components: [
        {
          type: "header",
          parameters: [
            {
              type: "image",
              image: { link: imageUrl || DEFAULT_IMAGE_URL }
            }
          ]
        },
        {
          type: "body",
          parameters: [
            { type: "text", text: name || 'N/A' },
            { type: "text", text: taskId || 'N/A' },
            { type: "text", text: description || 'N/A' },
            { type: "text", text: formatDate(plannedDate) },
            { type: "text", text: givenBy || 'N/A' }
          ]
        }
      ]
    }
  };

  return await sendMetaWhatsApp(payload);
};

/**
 * Send Daily Summary Notification via Meta Template
 */
export const sendDailySummaryNotification = async (phoneNumber, details) => {
  const formattedPhone = formatPhoneNumber(phoneNumber);
  if (!formattedPhone) return { success: false, error: 'Invalid phone number' };

  const { name, totalTasks, pendingCount, todayCount } = details;

  console.log(`📱 Sending Daily Summary Template via Meta to: ${formattedPhone}`);

  const payload = {
    messaging_product: "whatsapp",
    to: formattedPhone,
    type: "template",
    template: {
      name: TEMPLATE_DAILY_SUMMARY,
      language: { code: "en" },
      components: [
        {
          type: "body",
          parameters: [
            { type: "text", text: String(todayCount || 0) },    // {{1}} Today's Tasks
            { type: "text", text: name || 'Team Member' },      // {{2}} Task of Doer (Name)
            { type: "text", text: String(pendingCount || 0) }   // {{3}} Overdue Tasks
          ]
        }
      ]
    }
  };

  return await sendMetaWhatsApp(payload);
};

/**
 * Send User Delegation Reply Notification via Meta Template (to Admin)
 */
export const sendUserDelegationReplyNotification = async (taskDetails) => {
  const formattedPhone = formatPhoneNumber(ADMIN_NUMBER);
  if (!formattedPhone) {
    console.error('❌ ADMIN_WHATSAPP_NUMBER missing or invalid in .env');
    return { success: false, error: 'Invalid admin phone number' };
  }

  const { task_id, name, task_description, remarks, planned_date } = taskDetails;

  console.log(`📱 Sending User Delegation Reply Template via Meta to Admin: ${formattedPhone}`);

  const payload = {
    messaging_product: "whatsapp",
    to: formattedPhone,
    type: "template",
    template: {
      name: TEMPLATE_USER_REPLY,
      language: { code: "en" },
      components: [
        {
          type: "body",
          parameters: [
            { type: "text", text: truncate(name, 100) },
            { type: "text", text: String(task_id || 'N/A') },
            { type: "text", text: truncate(task_description, 500) },
            { type: "text", text: truncate(remarks, 500) },
            { type: "text", text: formatDateDDMMYYYY(planned_date) }
          ]
        }
      ]
    }
  };

  const result = await sendMetaWhatsApp(payload);
  if (!result.success) {
    console.error(`❌ User reply WhatsApp FAILED for task ${task_id}:`, JSON.stringify(result.error));
  }
  return result;
};

/**
 * Send Admin Delegation Reply Notification via Meta Template (to User)
 */
export const sendAdminDelegationReplyNotification = async (phoneNumber, taskDetails) => {
  const formattedPhone = formatPhoneNumber(phoneNumber);
  if (!formattedPhone) return { success: false, error: 'Invalid phone number' };

  const { task_id, name, task_description, adminremarks, planned_date, image } = taskDetails;

  console.log(`📱 Sending Admin Delegation Reply Template via Meta to: ${formattedPhone}`);

  const payload = {
    messaging_product: "whatsapp",
    to: formattedPhone,
    type: "template",
    template: {
      name: TEMPLATE_ADMIN_REPLY,
      language: { code: "en" },
      components: [
        {
          type: "body",
          parameters: [
            { type: "text", text: 'Admin' },
            { type: "text", text: String(task_id || 'N/A') },
            { type: "text", text: truncate(task_description, 500) },
            { type: "text", text: truncate(adminremarks, 500) },
            { type: "text", text: formatDateDDMMYYYY(planned_date) },
            { type: "text", text: truncate(name, 100) }
          ]
        }
      ]
    }
  };

  return await sendMetaWhatsApp(payload);
};

/**
 * Send Task Reverted Notification via Meta Template (to User)
 */
export const sendTaskRevertedNotification = async (phoneNumber, taskDetails) => {
  const formattedPhone = formatPhoneNumber(phoneNumber);
  if (!formattedPhone) return { success: false, error: 'Invalid phone number' };

  const { reverted_by, task_id, task_description, reply, planned_date } = taskDetails;

  console.log(`📱 Sending Task Reverted Template via Meta to: ${formattedPhone}`);

  const payload = {
    messaging_product: "whatsapp",
    to: formattedPhone,
    type: "template",
    template: {
      name: TEMPLATE_REVERT,
      language: { code: "en" },
      components: [
        {
          type: "body",
          parameters: [
            { type: "text", text: truncate(reverted_by || 'Admin', 100) },
            { type: "text", text: String(task_id || 'N/A') },
            { type: "text", text: truncate(task_description, 500) },
            { type: "text", text: truncate(reply, 500) },
            { type: "text", text: formatDateDDMMYYYY(planned_date) }
          ]
        }
      ]
    }
  };

  return await sendMetaWhatsApp(payload);
};

export const sendDailyReminderNotification = async (phoneNumber, details) => {
  const formattedPhone = formatPhoneNumber(phoneNumber);
  if (!formattedPhone) return { success: false, error: 'Invalid phone number' };

  const { name, pendingCount } = details;

  console.log(`📱 Sending Evening Reminder Template via Meta to: ${formattedPhone}`);

  const payload = {
    messaging_product: "whatsapp",
    to: formattedPhone,
    type: "template",
    template: {
      name: TEMPLATE_EVENING_REMINDER,
      language: { code: "en" },
      components: [
        {
          type: "body",
          parameters: [
            { type: "text", text: name || 'Team Member' },
            { type: "text", text: String(pendingCount || 0) }
          ]
        }
      ]
    }
  };

  return await sendMetaWhatsApp(payload);

}

export default { 
  sendWhatsAppMessage, 

  sendTaskAssignmentNotification,
  sendDelegationDoneNotification,
  sendDelegationExtendNotification,
  sendUrgentAlertNotification,
  sendDailySummaryNotification,
  sendUserDelegationReplyNotification,
  sendAdminDelegationReplyNotification,
  sendTaskRevertedNotification,
  sendDailyReminderNotification
};
