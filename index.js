const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const fs = require('fs');
const FAQ_FILE = './faq-data.json';

// Load Q/A from file
let faq = [];
if (fs.existsSync(FAQ_FILE)) {
  faq = JSON.parse(fs.readFileSync(FAQ_FILE, 'utf8')).map(item => ({
    q: new RegExp(item.q, 'i'),
    a: item.a
  }));
}

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.json());

// Admin portal route (must be before static middleware)
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
});

// Static files middleware
app.use(express.static('public'));

let clients = [];

// WebSocket: push bot replies to all clients
wss.on('connection', ws => {
  clients.push(ws);
  ws.on('close', () => {
    clients = clients.filter(c => c !== ws);
  });
});

// Send message to all connected clients
function broadcast(from, text) {
  const msg = JSON.stringify({ from, text });
  clients.forEach(ws => {
    if (ws.readyState === WebSocket.OPEN) ws.send(msg);
  });
}

// Simple in-memory admin credentials (replace with env vars or DB for production)
const ADMIN_USER = 'yogi'; // or your chosen username
const ADMIN_PASS = 'IGEN@2025'; // or your chosen password

// Middleware for basic auth
function adminAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Basic ')) return res.status(401).send('Unauthorized');
  const [user, pass] = Buffer.from(auth.split(' ')[1], 'base64').toString().split(':');
  if (user === ADMIN_USER && pass === ADMIN_PASS) return next();
  res.status(401).send('Unauthorized');
}

// Save FAQ to file
function saveFaq() {
  fs.writeFileSync(FAQ_FILE, JSON.stringify(
    faq.map(item => ({
      q: item.q instanceof RegExp ? item.q.source : item.q, // handle both RegExp and string
      a: item.a
    })), null, 2
  ));
}

// Admin: Get all Q/A
app.get('/admin/faq', adminAuth, (req, res) => {
  res.json(
    faq.map(item => ({
      q: item.q.source, // send regex pattern as string
      a: item.a
    }))
  );
});

// Admin: Add Q/A
app.post('/admin/faq', adminAuth, (req, res) => {
  const { q, a } = req.body;
  if (!q || !a) return res.status(400).send('Missing q or a');
  faq.push({ q: new RegExp(q, 'i'), a });
  saveFaq();
  res.send({ success: true });
});

// Admin: Remove Q/A by index
app.delete('/admin/faq/:index', adminAuth, (req, res) => {
  const idx = parseInt(req.params.index, 10);
  if (isNaN(idx) || idx < 0 || idx >= faq.length) return res.status(400).send('Invalid index');
  faq.splice(idx, 1);
  saveFaq();
  res.send({ success: true });
});

// API: Receive user message and respond as IGEN bot
app.post('/send', async (req, res) => {
  let { text } = req.body;
  text = text.trim().replace(/\s+/g, ' '); // normalize whitespace
  const answer = faq.find(faq =>
    faq.q instanceof RegExp
      ? faq.q.test(text)
      : faq.q.trim().toLowerCase() === text.trim().toLowerCase()
  );
  let reply = answer ? answer.a : "Sorry, I don't have an answer for that. Please visit https://theigen.org or contact us for more information.";
  setTimeout(() => broadcast('IGEN Bot', reply), 600);
  res.send({ success: true });
});

// Serve frontend
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log('Server running on http://localhost:' + PORT));
