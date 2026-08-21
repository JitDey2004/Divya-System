const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());

// Serve files from the project root
app.use(express.static(__dirname));

// Serve data files if you have a data folder
app.use('/data', express.static(path.join(__dirname, 'data')));

// Main website
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Fault reporting endpoint
app.post('/report-fault', (req, res) => {
    const { ip } = req.body;

    if (!ip) {
        return res.status(400).json({
            error: 'Missing ip in request body'
        });
    }

    console.log(`⚡ Fault reported for IP: ${ip}`);

    io.emit('fault_event', { ip });

    res.json({ status: 'ok' });
});

// Socket.io
io.on('connection', (socket) => {
    console.log('🔌 New client connected');
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server listening on port ${PORT}`);
});