const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();
const userStore = require('../services/UserStore');

// JWT secret (must match the one in auth.js)
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this-in-production';

// Admin user ID that has access to admin routes
const ADMIN_USER_ID = 'auth_1764962440290_n04znh8jx';

// Admin middleware to check if request has admin privileges via JWT
const requireAdmin = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }

    // Check if the user ID matches the admin user ID
    if (user.userId !== ADMIN_USER_ID) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    req.user = user;
    next();
  });
};

// Get all rooms and users data
router.get('/data', requireAdmin, (req, res) => {
  try {
    const { rooms, users } = req.app.locals;
    
    console.log('Admin data request - Rooms count:', rooms.size, 'Users count:', users.size);
    console.log('Persistent users count:', userStore.persistentUsers.size);
    
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

    // Get all users from UserStore (includes both online and offline users)
    const allUsersData = [];
    const onlineUserIds = new Set(Array.from(users.values()).map(user => user.id));
    
    // First add all persistent users from UserStore
    for (const [userId, persistentUser] of userStore.persistentUsers) {
      console.log('Processing persistent user:', persistentUser.id, persistentUser.name, 'Status:', persistentUser.status);
      allUsersData.push({
        id: persistentUser.id,
        name: persistentUser.name,
        status: persistentUser.status,
        totalWorkTime: persistentUser.totalWorkTime || 0,
        totalBreakTime: persistentUser.totalBreakTime || 0,
        completedSessions: persistentUser.completedSessions || 0,
        joinedAt: persistentUser.joinedAt,
        lastActivity: persistentUser.lastActivity,
        roomId: null // Offline users don't have active room connections
      });
    }
    
    // Then update/add any online users from the active users map to get current room info
    for (const [socketId, activeUser] of users) {
      const existingUserIndex = allUsersData.findIndex(user => user.id === activeUser.id);
      if (existingUserIndex >= 0) {
        // Update existing user with current room info
        allUsersData[existingUserIndex].roomId = activeUser.roomId;
        allUsersData[existingUserIndex].status = 'online';
      } else {
        // Add user if somehow not in persistent store
        console.log('Found active user not in persistent store:', activeUser.id, activeUser.name);
        allUsersData.push({
          id: activeUser.id,
          name: activeUser.name,
          status: activeUser.status,
          totalWorkTime: activeUser.totalWorkTime || 0,
          totalBreakTime: activeUser.totalBreakTime || 0,
          completedSessions: activeUser.completedSessions || 0,
          joinedAt: activeUser.joinedAt,
          lastActivity: activeUser.lastActivity,
          roomId: activeUser.roomId
        });
      }
    }

    console.log('Sending admin data - Rooms:', roomsData.length, 'All Users:', allUsersData.length);

    res.json({
      rooms: roomsData,
      users: allUsersData
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

    // Check if user exists in persistent store
    const persistentUser = userStore.getUser(userId);
    if (!persistentUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Find if user is currently online
    let targetUser = null;
    let targetSocketId = null;

    for (const [socketId, user] of users) {
      if (user.id === userId) {
        targetUser = user;
        targetSocketId = socketId;
        break;
      }
    }

    // If user is online, handle their active session
    if (targetUser) {
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
    }

    // Remove from persistent store (this handles both online and offline users)
    userStore.removeUser(userId);

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

    // Get the persistent user (works for both online and offline users)
    const persistentUser = userStore.getUser(userId);
    if (!persistentUser) {
      console.error('User not found in persistent store:', userId);
      return res.status(404).json({ error: 'User not found' });
    }

    console.log('Found persistent user:', persistentUser.name, 'Status:', persistentUser.status);

    // Find if user is currently online
    let targetUser = null;
    let targetSocketId = null;

    for (const [socketId, user] of users) {
      console.log('Checking user:', user.id, 'against target:', userId);
      if (user.id === userId) {
        targetUser = user;
        targetSocketId = socketId;
        console.log('Found active user:', targetUser.name);
        break;
      }
    }

    console.log('Updating user:', persistentUser.name, 'with:', updates);

    // Update the persistent user first (this is the authoritative source)
    if (updates.name !== undefined) {
      console.log('Updating name from', persistentUser.name, 'to', updates.name);
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

    // If user is currently online, also update the active user data
    if (targetUser) {
      console.log('Updating active user data as well');
      if (updates.name !== undefined) {
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
    }

    // Notify user and room about the update if user is currently online
    if (targetUser && targetUser.roomId) {
      io.to(targetUser.roomId).emit('user_updated', {
        userId: persistentUser.id,
        userData: {
          id: persistentUser.id,
          name: persistentUser.name,
          status: persistentUser.status,
          totalWorkTime: persistentUser.totalWorkTime || 0,
          totalBreakTime: persistentUser.totalBreakTime || 0,
          completedSessions: persistentUser.completedSessions || 0
        }
      });
    }

    // Return updated user data from persistent store
    const updatedData = {
      id: persistentUser.id,
      name: persistentUser.name,
      status: persistentUser.status,
      totalWorkTime: persistentUser.totalWorkTime || 0,
      totalBreakTime: persistentUser.totalBreakTime || 0,
      completedSessions: persistentUser.completedSessions || 0,
      joinedAt: persistentUser.joinedAt,
      lastActivity: persistentUser.lastActivity,
      roomId: targetUser ? targetUser.roomId : null // Get room from active user if online
    };

    console.log('Returning updated data:', updatedData);
    res.json(updatedData);
  } catch (error) {
    console.error('User update error:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// Persistence management endpoints
// Manual save all data
router.post('/persistence/save', requireAdmin, async (req, res) => {
  try {
    const { rooms } = req.app.locals;
    
    if (!userStore.persistenceManager) {
      return res.status(500).json({ error: 'Persistence manager not available' });
    }
    
    await userStore.persistenceManager.saveAll(rooms, userStore);
    
    res.json({ 
      message: 'Data saved successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Manual save error:', error);
    res.status(500).json({ error: 'Failed to save data' });
  }
});

// Get persistence status
router.get('/persistence/status', requireAdmin, async (req, res) => {
  try {
    const { rooms } = req.app.locals;
    
    const status = {
      persistenceManagerAvailable: !!userStore.persistenceManager,
      roomsCount: rooms.size,
      persistentUsersCount: userStore.persistentUsers.size,
      lastSaveTime: 'Auto-save every 30 seconds',
      hasPersistentData: false
    };
    
    if (userStore.persistenceManager) {
      status.hasPersistentData = await userStore.persistenceManager.hasPersistentData();
    }
    
    res.json(status);
  } catch (error) {
    console.error('Persistence status error:', error);
    res.status(500).json({ error: 'Failed to get persistence status' });
  }
});

// Cleanup old data
router.post('/persistence/cleanup', requireAdmin, async (req, res) => {
  try {
    const { daysToKeep = 30 } = req.body;
    
    if (!userStore.persistenceManager) {
      return res.status(500).json({ error: 'Persistence manager not available' });
    }
    
    await userStore.persistenceManager.cleanupOldData(daysToKeep);
    
    res.json({ 
      message: `Data older than ${daysToKeep} days cleaned up successfully`,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Cleanup error:', error);
    res.status(500).json({ error: 'Failed to cleanup old data' });
  }
});

// Get timer recovery information
router.get('/persistence/recovery', requireAdmin, (req, res) => {
  try {
    const recoveredUsers = [];
    
    for (const [userId, user] of userStore.persistentUsers) {
      if (user.recoveryInfo && user.recoveryInfo.recovered) {
        recoveredUsers.push({
          userId: user.id,
          userName: user.name,
          recoveryInfo: user.recoveryInfo,
          currentTimerState: user.timerState
        });
      }
    }
    
    const report = {
      totalRecoveredUsers: recoveredUsers.length,
      recoveredUsers: recoveredUsers,
      lastRecoveryTime: new Date().toISOString()
    };
    
    res.json(report);
  } catch (error) {
    console.error('Recovery info error:', error);
    res.status(500).json({ error: 'Failed to get recovery information' });
  }
});

module.exports = router; 