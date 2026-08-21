const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
// Serve data files (modules.json, engineers.json) to the frontend
app.use('/data', express.static(path.join(__dirname, 'data')));

// Simulated fault reporting endpoint
app.post('/report-fault', (req, res) => {
  const { ip } = req.body;
  if (!ip) {
    return res.status(400).send({ error: 'Missing ip in request body' });
  }
  console.log(`⚡ Fault reported for IP: ${ip}`);
  io.emit('fault_event', { ip });
  res.send({ status: 'ok' });
});

// Socket.io connection log
io.on('connection', (socket) => {
  console.log('🔌 New client connected');
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Server listening on http://localhost:${PORT}`);
});
