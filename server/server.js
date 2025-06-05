const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');

const config = require('./config');
const { Room } = require('./models');
const routes = require('./routes');
const { initializeSocketHandlers } = require('./sockets/socketHandlers');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: config.cors
});

// Middleware
app.use(cors());
app.use(express.json());

// Data structures to store application state
const rooms = new Map(); // roomId -> room data
const users = new Map(); // socketId -> user data

// Make rooms and io available to routes
app.locals.rooms = rooms;
app.locals.io = io;

// Routes
app.use('/', routes);

// Initialize Socket.io handlers
initializeSocketHandlers(io, rooms, users);

const PORT = config.port;

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
  console.log(`Server accessible at http://192.168.1.89:${PORT}`);
  console.log(`Socket.io server ready for connections`);
});
