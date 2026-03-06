// Minimal test server for Render deployment
const express = require('express');
const http = require('http');
const WebSocket = require('ws');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 10000;

app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'Reactivity Arena Server' });
});

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', uptime: process.uptime() });
});

wss.on('connection', (ws) => {
  console.log('Client connected');
  ws.send(JSON.stringify({ type: 'welcome', message: 'Connected to game server' }));
  
  ws.on('message', (message) => {
    console.log('Received:', message.toString());
    ws.send(JSON.stringify({ type: 'echo', data: message.toString() }));
  });
  
  ws.on('close', () => {
    console.log('Client disconnected');
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Health check: http://0.0.0.0:${PORT}/health`);
});
