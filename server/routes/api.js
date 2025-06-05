const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { Room } = require('../models');

const router = express.Router();

// API Routes
router.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

router.get('/rooms', (req, res) => {
  const { rooms } = req.app.locals;
  const roomList = Array.from(rooms.values()).map(room => ({
    id: room.id,
    name: room.name,
    userCount: room.users.size,
    isActive: room.isActive,
    mode: room.mode,
    createdAt: room.createdAt
  }));
  res.json(roomList);
});

router.post('/rooms', (req, res) => {
  const { name, createdBy } = req.body;
  
  if (!name || !createdBy) {
    return res.status(400).json({ error: 'Room name and creator are required' });
  }

  const { rooms, io } = req.app.locals;
  const roomId = uuidv4();
  const room = new Room(roomId, name, createdBy, io);
  rooms.set(roomId, room);

  res.status(201).json( {
    id: room.id,
    name: room.name,
    createdBy: room.createdBy
  });
});

// Debug endpoint to get detailed room information
router.get('/rooms/debug', (req, res) => {
  const { rooms, users } = req.app.locals;
  const roomDetails = Array.from(rooms.values()).map(room => ({
    id: room.id,
    name: room.name,
    userCount: room.users.size,
    users: Array.from(room.users.values()).map(user => ({
      id: user.id,
      name: user.name,
      status: user.status,
      socketId: user.socketId
    })),
    createdAt: room.createdAt,
    isEmpty: room.isEmpty()
  }));
  
  const activeUsers = Array.from(users.entries()).map(([socketId, userData]) => ({
    socketId,
    userData
  }));

  res.json({
    rooms: roomDetails,
    activeUsers,
    totalRooms: rooms.size,
    totalUsers: users.size
  });
});

// Debug endpoint to clean up all rooms (for testing)
router.delete('/rooms/cleanup', (req, res) => {
  const { rooms } = req.app.locals;
  const deletedCount = rooms.size;
  
  // Clean up all rooms
  rooms.forEach(room => room.cleanup());
  rooms.clear();
  
  res.json({ 
    message: `Cleaned up ${deletedCount} rooms`,
    remainingRooms: rooms.size
  });
});

module.exports = router; 