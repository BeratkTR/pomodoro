const express = require('express');
const router = express.Router();
const userStore = require('../services/UserStore');

// Admin middleware to check if request has admin privileges
const requireAdmin = (req, res, next) => {
  // For now, we'll just check if the request includes admin header
  // In a real application, you'd verify admin JWT token or session
  const isAdmin = req.headers['x-admin'] === 'true';
  if (!isAdmin) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

// Get all rooms and users data
router.get('/data', requireAdmin, (req, res) => {
  try {
    const { rooms, users } = req.app.locals;
    
    console.log('Admin data request - Rooms count:', rooms.size, 'Users count:', users.size);
    
    // Convert Maps to arrays for JSON response
    const roomsData = Array.from(rooms.values()).map(room => {
      console.log('Processing room:', room.id, room.name);
      return {
        id: room.id,
        name: room.name,
        userCount: room.users.size,
        createdAt: room.createdAt,
        users: Array.from(room.users.values()).map(user => ({
          id: user.id,
          name: user.name,
          status: user.status
        }))
      };
    });

    const usersData = Array.from(users.values()).map(user => {
      console.log('Processing user:', user.id, user.name);
      return {
        id: user.id,
        name: user.name,
        status: user.status,
        totalWorkTime: user.totalWorkTime || 0,
        totalBreakTime: user.totalBreakTime || 0,
        completedSessions: user.completedSessions || 0,
        joinedAt: user.joinedAt,
        lastActivity: user.lastActivity,
        roomId: user.roomId
      };
    });

    console.log('Sending admin data - Rooms:', roomsData.length, 'Users:', usersData.length);

    res.json({
      rooms: roomsData,
      users: usersData
    });
  } catch (error) {
    console.error('Admin data fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch admin data' });
  }
});

// Delete a room
router.delete('/rooms/:roomId', requireAdmin, (req, res) => {
  try {
    const { roomId } = req.params;
    const { rooms, users } = req.app.locals;
    const io = req.app.locals.io;

    const room = rooms.get(roomId);
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    // Disconnect all users in the room
    room.users.forEach(user => {
      if (user.socketId) {
        const socket = io.sockets.sockets.get(user.socketId);
        if (socket) {
          socket.emit('room_deleted', { message: 'Room has been deleted by admin' });
          socket.disconnect();
        }
      }
      // Remove user from global users map
      users.delete(user.socketId);
    });

    // Delete the room
    rooms.delete(roomId);

    res.json({ message: 'Room deleted successfully' });
  } catch (error) {
    console.error('Room deletion error:', error);
    res.status(500).json({ error: 'Failed to delete room' });
  }
});

// Delete a user
router.delete('/users/:userId', requireAdmin, (req, res) => {
  try {
    const { userId } = req.params;
    const { rooms, users } = req.app.locals;
    const io = req.app.locals.io;

    // Find user by ID across all sessions
    let targetUser = null;
    let targetSocketId = null;

    for (const [socketId, user] of users) {
      if (user.id === userId) {
        targetUser = user;
        targetSocketId = socketId;
        break;
      }
    }

    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Remove user from their room
    if (targetUser.roomId) {
      const room = rooms.get(targetUser.roomId);
      if (room) {
        room.removeUser(userId);
        
        // Notify other users in the room
        io.to(targetUser.roomId).emit('user_left', {
          userId: userId,
          userName: targetUser.name,
          reason: 'removed_by_admin'
        });
      }
    }

    // Disconnect the user's socket
    const socket = io.sockets.sockets.get(targetSocketId);
    if (socket) {
      socket.emit('user_removed', { message: 'You have been removed by admin' });
      socket.disconnect();
    }

    // Remove from global users map
    users.delete(targetSocketId);

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('User deletion error:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// Update user data
router.patch('/users/:userId', requireAdmin, (req, res) => {
  try {
    const { userId } = req.params;
    const updates = req.body;
    const { rooms, users } = req.app.locals;
    const io = req.app.locals.io;

    console.log('Admin update request for userId:', userId);
    console.log('Update data:', updates);
    console.log('Total users in memory:', users.size);

    // Find user by ID across all sessions
    let targetUser = null;
    let targetSocketId = null;

    for (const [socketId, user] of users) {
      console.log('Checking user:', user.id, 'against target:', userId);
      if (user.id === userId) {
        targetUser = user;
        targetSocketId = socketId;
        console.log('Found target user:', targetUser.name);
        break;
      }
    }

    if (!targetUser) {
      console.error('User not found:', userId);
      return res.status(404).json({ error: 'User not found' });
    }

    console.log('Updating user:', targetUser.name, 'with:', updates);

    // Update allowed fields in the active user (users Map)
    if (updates.name !== undefined) {
      console.log('Updating name from', targetUser.name, 'to', updates.name);
      targetUser.name = updates.name;
    }
    if (updates.totalWorkTime !== undefined) {
      targetUser.totalWorkTime = parseFloat(updates.totalWorkTime) || 0;
    }
    if (updates.totalBreakTime !== undefined) {
      targetUser.totalBreakTime = parseFloat(updates.totalBreakTime) || 0;
    }
    if (updates.completedSessions !== undefined) {
      targetUser.completedSessions = parseInt(updates.completedSessions) || 0;
    }

    // Also update the persistent user in UserStore
    const persistentUser = userStore.getUser(targetUser.id);
    if (persistentUser) {
      console.log('Updating persistent user:', persistentUser.name);
      if (updates.name !== undefined) {
        persistentUser.name = updates.name;
      }
      if (updates.totalWorkTime !== undefined) {
        persistentUser.totalWorkTime = parseFloat(updates.totalWorkTime) || 0;
      }
      if (updates.totalBreakTime !== undefined) {
        persistentUser.totalBreakTime = parseFloat(updates.totalBreakTime) || 0;
      }
      if (updates.completedSessions !== undefined) {
        persistentUser.completedSessions = parseInt(updates.completedSessions) || 0;
      }
      console.log('Persistent user updated successfully:', persistentUser.name);
    } else {
      console.log('Warning: Persistent user not found for ID:', targetUser.id);
    }

    console.log('User updated successfully:', targetUser.name);

    // Notify user and room about the update
    if (targetUser.roomId) {
      io.to(targetUser.roomId).emit('user_updated', {
        userId: targetUser.id,
        userData: {
          id: targetUser.id,
          name: targetUser.name,
          status: targetUser.status,
          totalWorkTime: targetUser.totalWorkTime || 0,
          totalBreakTime: targetUser.totalBreakTime || 0,
          completedSessions: targetUser.completedSessions || 0
        }
      });
    }

    // Return updated user data
    const updatedData = {
      id: targetUser.id,
      name: targetUser.name,
      status: targetUser.status,
      totalWorkTime: targetUser.totalWorkTime || 0,
      totalBreakTime: targetUser.totalBreakTime || 0,
      completedSessions: targetUser.completedSessions || 0,
      joinedAt: targetUser.joinedAt,
      lastActivity: targetUser.lastActivity,
      roomId: targetUser.roomId
    };

    console.log('Returning updated data:', updatedData);
    res.json(updatedData);
  } catch (error) {
    console.error('User update error:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

module.exports = router; 