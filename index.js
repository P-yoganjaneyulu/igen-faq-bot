require('dotenv').config();
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const chatStorage = require('./utils/storage');
const bodyParser = require('body-parser');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.json());
app.use(bodyParser.json());

// Static files middleware
app.use(express.static('public'));

// Store client connections
let clients = new Map();

wss.on('connection', ws => {
  const sessionId = chatStorage.generateSessionId();
  clients.set(sessionId, ws);

  // Send session ID to client
  ws.send(JSON.stringify({
    type: 'session',
    sessionId: sessionId,
    history: chatStorage.getHistory(sessionId)
  }));

  ws.on('message', data => {
    console.log('WebSocket received:', data.toString());
  });

  ws.on('error', error => {
    console.error('WebSocket error:', error);
  });

  ws.on('close', () => {
    clients.delete(sessionId);
  });
});

// Update the broadcast function
async function broadcast(from, text, sessionId) {
  const message = {
    type: 'message',
    from,
    text,
    timestamp: new Date().toISOString()
  };

  const ws = clients.get(sessionId);
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
    if (from === 'User') {
      await chatStorage.saveChat(sessionId, message);
    }
  }
}

// Update the send endpoint
app.post('/send', async (req, res) => {
  let { text, sessionId } = req.body;
  
  if (!sessionId || !clients.has(sessionId)) {
    return res.status(400).send('Invalid session');
  }

  text = text.trim();
  if (!text) {
    return res.status(400).send('Message cannot be empty');
  }

  try {
    await broadcast('User', text, sessionId);
    res.send({ success: true });
  } catch (error) {
    console.error('Error broadcasting message:', error);
    res.status(500).send('Failed to send message');
  }
});

// Replace the webhook endpoint with this simpler version
app.post('/webhook/discord', async (req, res) => {
  try {
    console.log('\n=== Discord Reply ===');
    console.log('Author:', req.body.author?.username);
    console.log('Content:', req.body.content);
    console.log('Is Reply:', !!req.body.referenced_message);

    // Ignore bot messages
    if (req.body.author?.bot) {
      return res.json({ success: true });
    }

    // Must be a reply
    if (!req.body.referenced_message) {
      console.log('❌ Not a reply message');
      return res.json({ success: true });
    }

    // Try to extract session ID from referenced message
    let sessionId = null;

    // 1. Try plain text content
    if (req.body.referenced_message.content) {
      const sessionMatch = req.body.referenced_message.content.match(/Session: ([a-zA-Z0-9-]+)/);
      if (sessionMatch) sessionId = sessionMatch[1];
    }

    // 2. Try embed fields (for rich Discord messages)
    if (!sessionId && req.body.referenced_message.embeds && req.body.referenced_message.embeds.length > 0) {
      const embed = req.body.referenced_message.embeds[0];
      if (embed.fields) {
        const sessionField = embed.fields.find(f => f.name === 'Session ID');
        if (sessionField) {
          sessionId = sessionField.value.replace(/`/g, '');
        }
      }
    }

    if (!sessionId) {
      console.log('❌ No session ID found');
      return res.json({ success: false, error: 'No session ID found in reply target' });
    }

    console.log('✅ Session ID:', sessionId);

    // Send to chat
    const ws = clients.get(sessionId);
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'message',
        from: 'Admin',
        text: req.body.content,
        timestamp: new Date().toISOString()
      }));
      console.log('✅ Reply sent to chat');
    } else {
      console.log('❌ WebSocket not open for session:', sessionId);
    }

    return res.json({ success: true });
  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ error: error.message });
  }
});

// Add this after your existing endpoints
app.post('/reset-chat', async (req, res) => {
  const { sessionId } = req.body;
  
  if (!sessionId) {
    return res.status(400).json({ success: false, error: 'Session ID required' });
  }

  try {
    // Clear chat history
    await chatStorage.clearHistory(sessionId);
    
    // Close existing WebSocket connection
    const ws = clients.get(sessionId);
    if (ws) {
      ws.close();
      clients.delete(sessionId);
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error clearing chat:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Serve frontend
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || 'localhost';

server.listen(PORT, () => {
  console.log(`📱 Chat Interface: http://${HOST}:${PORT}`);
  console.log('\n🚀 Server is running!\n');
  console.log('\nPress Ctrl+C to stop the server\n');
});
