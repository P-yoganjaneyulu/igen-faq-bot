const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const faq = require('./igen-faq'); // <-- Import the Q&A

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

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
