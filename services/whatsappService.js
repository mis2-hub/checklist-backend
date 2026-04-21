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

// Default Logo URL (Fixed 403 Forbidden issue)
const DEFAULT_IMAGE_URL = 'https://drive.google.com/uc?export=download&id=1gb2U7C8DpdVXIJuyd75cYth8YIATg5sM'; // Direct image download link required by Meta API

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
    const errorData = error.response?.data || error.message;
    console.error('❌ Meta WhatsApp send error:', JSON.stringify(errorData, null, 2));
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

  const { name, task_id, task_description, reason } = taskDetails;
  
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
          type: "header",
          parameters: [
            {
              type: "image",
              image: { link: DEFAULT_IMAGE_URL }
            }
          ]
        },
        {
          type: "body",
          parameters: [
            { type: "text", text: String(task_id || 'N/A') },
            { type: "text", text: task_description || 'N/A' },
            { type: "text", text: reason || 'N/A' }
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
            {
              type: "image",
              image: { link: DEFAULT_IMAGE_URL }
            }
          ]
        },
        {
          type: "body",
          parameters: [
            { type: "text", text: String(task_id || 'N/A') },
            { type: "text", text: task_description || 'N/A' },
            { type: "text", text: formatDate(next_extend_date) },
            { type: "text", text: reason || 'N/A' }
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
          type: "header",
          parameters: [
            {
              type: "image",
              image: { link: DEFAULT_IMAGE_URL }
            }
          ]
        },
        {
          type: "body",
          parameters: [
            { type: "text", text: name || 'Team Member' },
            { type: "text", text: String(totalTasks || 0) },
            { type: "text", text: String(pendingCount || 0) },
            { type: "text", text: String(todayCount || 0) }
          ]
        }
      ]
    }
  };

  return await sendMetaWhatsApp(payload);
};

export default { 
  sendWhatsAppMessage, 
  sendTaskAssignmentNotification,
  sendDelegationDoneNotification,
  sendDelegationExtendNotification,
  sendUrgentAlertNotification,
  sendDailySummaryNotification
};
