require('dotenv').config();
const axios = require('axios');

async function testWebhook() {
  try {
    // First verify webhook URL exists
    if (!process.env.DISCORD_WEBHOOK) {
      throw new Error('DISCORD_WEBHOOK not found in .env file');
    }

    console.log('Testing webhook URL:', process.env.DISCORD_WEBHOOK);

    const response = await axios.post(process.env.DISCORD_WEBHOOK, {
      username: 'IGEN FAQ Bot',
      content: '🔔 Test message from IGEN FAQ Bot\n\n⏰ Time: ' + new Date().toLocaleString()
    });
    
    if (response.status === 204) {
      console.log('✅ Webhook test successful!');
    } else {
      console.log('⚠️ Unexpected status:', response.status);
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
    console.error('Please check your .env file and webhook URL format');
  }
}

testWebhook();