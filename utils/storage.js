const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const axios = require('axios');
require('dotenv').config();

class ChatStorage {
  constructor() {
    this.storageDir = path.join(__dirname, '..', 'chat-history');
    if (!fs.existsSync(this.storageDir)) {
      fs.mkdirSync(this.storageDir, { recursive: true });
    }
    
    this.webhookUrl = process.env.DISCORD_WEBHOOK;
    if (!this.webhookUrl) {
      console.error('Warning: DISCORD_WEBHOOK not set in environment variables');
    }
  }

  generateSessionId() {
    const timestamp = Date.now().toString(36);
    const random = crypto.randomBytes(8).toString('hex');
    return `${timestamp}-${random}`;
  }

  async saveChat(sessionId, message) {
    // Save to file
    const filePath = path.join(this.storageDir, `${sessionId}.json`);
    let history = [];
    
    if (fs.existsSync(filePath)) {
      history = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }
    
    history.push(message);
    fs.writeFileSync(filePath, JSON.stringify(history, null, 2));

    // Only send to Discord if it's a user message
    if (message.from === 'User') {
      try {
        // Simpler Discord message format
        const discordMessage = {
          content: `📨 New Message\nSession: ${sessionId}\nMessage: ${message.text}\n\nReply to this message to respond to the user`
        };

        await axios.post(this.webhookUrl, discordMessage);
      } catch (error) {
        console.error('Discord notification failed:', error);
      }
    }
  }

  getHistory(sessionId) {
    const filePath = path.join(this.storageDir, `${sessionId}.json`);
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }
    return [];
  }

  clearHistory(sessionId) {
    const filePath = path.join(this.storageDir, `${sessionId}.json`);
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      return true;
    } catch (error) {
      console.error('Error clearing chat history:', error);
      throw error;
    }
  }
}

module.exports = new ChatStorage();