const config = require('../config');
const { User } = require('../models');
const userStore = require('../services/UserStore');

function initializeSocketHandlers(io, rooms, users) {
  io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    // Handle user joining a room  ----------------------------------------------
    socket.on('join_room', (data) => {
      const { roomId, user, isReconnection = false, existingUserData = null } = data;
      const room = rooms.get(roomId);

      if (!room) {
        socket.emit('error', { message: 'Room not found' });
        return;
      }

      // Handle reconnection case
      if (isReconnection) {
        // Try to get user from persistent store first
        let existingUser = userStore.getUser(user.id);
        if (existingUser) {
          // Update socket connection
          existingUser.socketId = socket.id;
          existingUser.status = 'online';
          existingUser.lastActivity = Date.now();
          
          // Add user to room if not already there
          if (!room.getUser(user.id)) {
            room.addUser(existingUser);
          }
        } else {
          // Fallback to room lookup
          existingUser = room.getUser(user.id);
          if (existingUser) {
            existingUser.socketId = socket.id;
            existingUser.status = 'online';
            existingUser.lastActivity = Date.now();
          }
        }
        
        if (existingUser) {
          // Update users tracking
          users.set(socket.id, {
            ...existingUser.getUserData(),
            roomId: roomId
          });

          // Join socket room
          socket.join(roomId);

          // Send current room state to the user
          socket.emit('room_joined', {
            room: {
              id: room.id,
              name: room.name,
              maxUsers: room.maxUsers,
              currentUsers: room.users.size
            },
            users: room.getUsersData(),
            currentUser: existingUser.getUserData()
          });

          // Send chat history to reconnecting user
          if (room.chatHistory && room.chatHistory.length > 0) {
            socket.emit('chat_history', {
              messages: room.chatHistory
            });
          }

          // Notify other users that this user came back online
          socket.to(roomId).emit('user_reconnected', {
            user: existingUser.getUserData(),
            users: room.getUsersData()
          });

          console.log(`User ${existingUser.name} reconnected to room ${room.name}`);
          return;
        }
      }

      // Check if room is full (only for new joins, not reconnections)
      if (room.isFull()) {
        // Check if user already exists in room but is offline
        const existingOfflineUser = Array.from(room.users.values()).find(u => u.name === user.name && u.status === 'offline');
        if (existingOfflineUser) {
          // Reactivate the offline user
          existingOfflineUser.socketId = socket.id;
          existingOfflineUser.status = 'online';
          
          users.set(socket.id, {
            ...existingOfflineUser.getUserData(),
            roomId: roomId
          });

          socket.join(roomId);

          socket.emit('room_joined', {
            room: {
              id: room.id,
              name: room.name,
              maxUsers: room.maxUsers,
              currentUsers: room.users.size
            },
            users: room.getUsersData(),
            currentUser: existingOfflineUser.getUserData()
          });

          // Send chat history to reactivating user
          if (room.chatHistory && room.chatHistory.length > 0) {
            socket.emit('chat_history', {
              messages: room.chatHistory
            });
          }

          socket.to(roomId).emit('user_reconnected', {
            user: existingOfflineUser.getUserData(),
            users: room.getUsersData()
          });

          console.log(`User ${existingOfflineUser.name} reactivated in room ${room.name}`);
          return;
        }

        socket.emit('error', { message: 'Room is full (max 2 users)' });
        return;
      }

      // Get or create persistent user with existing data
      const persistentUser = userStore.getOrCreateUser(
        user.id || socket.id, 
        user.name, 
        socket.id, 
        existingUserData
      );
      
      // Add user to our tracking
      users.set(socket.id, {
        ...persistentUser.getUserData(),
        roomId: roomId
      });

      // Add user to room
      const addResult = room.addUser(persistentUser);
      if (!addResult.success) {
        socket.emit('error', { message: addResult.message });
        return;
      }

      // Join socket room
      socket.join(roomId);

      // Send current room state to the user
      socket.emit('room_joined', {
        room: {
          id: room.id,
          name: room.name,
          maxUsers: room.maxUsers,
          currentUsers: room.users.size
        },
        users: room.getUsersData(),
        currentUser: persistentUser.getUserData()
      });

      // Send chat history to new user
      if (room.chatHistory && room.chatHistory.length > 0) {
        socket.emit('chat_history', {
          messages: room.chatHistory
        });
      }

      // Notify other users in the room
      socket.to(roomId).emit('user_joined', {
        user: persistentUser.getUserData(),
        users: room.getUsersData()
      });

      console.log(`User ${persistentUser.name} joined room ${room.name}`);
    });

    // Handle explicit leave room
    socket.on('leave_room', () => {
      const user = users.get(socket.id);
      if (user) {
        const room = rooms.get(user.roomId);
        if (room) {
          // Get user instance to preserve data
          const userInstance = room.getUser(user.id);
          if (userInstance) {
            userInstance.lastActivity = Date.now();
            // Keep user data in persistent store when leaving room
            userStore.setUserOffline(user.id);
          }
          
          // Remove user completely from room
          room.removeUser(user.id);
          
          // Notify other users
          socket.to(user.roomId).emit('user_left', {
            userId: user.id,
            users: room.getUsersData()
          });

          // Leave socket room
          socket.leave(user.roomId);

          // Don't delete room immediately when users leave
          // Room will only be deleted after prolonged inactivity timeout
          console.log(`Room ${room.name} now has ${room.users.size} users remaining`);
          
          // Optional: Set a delayed cleanup for rooms with no attendees at all
          if (room.hasNoAttendees()) {
            setTimeout(() => {
              const currentRoom = rooms.get(user.roomId);
              if (currentRoom && currentRoom.hasNoAttendees()) {
                currentRoom.cleanup();
                rooms.delete(user.roomId);
                console.log(`Room ${room.name} deleted - no attendees for extended period`);
              }
            }, config.room.inactiveRoomCleanupDelay || 5 * 60 * 1000); // 5 minutes default
          }

          console.log(`User ${user.name} left room ${room.name}`);
        }
        users.delete(socket.id);
      }
    });

    // Handle individual timer control ----------------------------------------------
    socket.on('start_timer', () => {
      const user = users.get(socket.id);
      if (!user) return;

      const room = rooms.get(user.roomId);
      if (!room) return;

      const userInstance = room.getUser(user.id);
      if (!userInstance) return;

      // Only allow timer operations for online users
      if (userInstance.status !== 'online') {
        console.log(`Blocked timer start for offline user ${userInstance.name}`);
        return;
      }

      userInstance.startTimer(io, user.roomId);
    });

    socket.on('pause_timer', () => {
      const user = users.get(socket.id);
      if (!user) return;

      const room = rooms.get(user.roomId);
      if (!room) return;

      const userInstance = room.getUser(user.id);
      if (!userInstance) return;

      // Only allow timer operations for online users
      if (userInstance.status !== 'online') {
        console.log(`Blocked timer pause for offline user ${userInstance.name}`);
        return;
      }

      userInstance.pauseTimer(io, user.roomId);
    });

    socket.on('reset_timer', () => {
      const user = users.get(socket.id);
      if (!user) return;

      const room = rooms.get(user.roomId);
      if (!room) return;

      const userInstance = room.getUser(user.id);
      if (!userInstance) return;

      // Only allow timer operations for online users
      if (userInstance.status !== 'online') {
        console.log(`Blocked timer reset for offline user ${userInstance.name}`);
        return;
      }

      userInstance.resetTimer(io, user.roomId);
    });

    socket.on('change_mode', (data) => {
      const user = users.get(socket.id);
      if (!user) return;

      const room = rooms.get(user.roomId);
      if (!room) return;

      const userInstance = room.getUser(user.id);
      if (!userInstance) return;

      // Only allow mode change for online users
      if (userInstance.status !== 'online') {
        console.log(`Blocked mode change for offline user ${userInstance.name}`);
        return;
      }

      userInstance.changeMode(data.mode, io, user.roomId);
    });

    socket.on('skip_to_break', () => {
      const user = users.get(socket.id);
      if (!user) return;

      const room = rooms.get(user.roomId);
      if (!room) return;

      const userInstance = room.getUser(user.id);
      if (!userInstance) return;

      // Only allow skip to break for online users
      if (userInstance.status !== 'online') {
        console.log(`Blocked skip to break for offline user ${userInstance.name}`);
        return;
      }

      userInstance.skipToBreak(io, user.roomId);
    });

    socket.on('skip_to_focus', () => {
      const user = users.get(socket.id);
      if (!user) return;

      const room = rooms.get(user.roomId);
      if (!room) return;

      const userInstance = room.getUser(user.id);
      if (!userInstance) return;

      // Only allow skip to focus for online users
      if (userInstance.status !== 'online') {
        console.log(`Blocked skip to focus for offline user ${userInstance.name}`);
        return;
      }

      userInstance.skipToFocus(io, user.roomId);
    });

    // Handle individual settings update  ----------------------------------------------
    socket.on('update_settings', (newSettings) => {
      const user = users.get(socket.id);
      if (!user) return;

      const room = rooms.get(user.roomId);
      if (!room) return;

      const userInstance = room.getUser(user.id);
      if (!userInstance) return;

      userInstance.updateSettings(newSettings, io, user.roomId);
    });

    // Handle user name update  ----------------------------------------------
    socket.on('update_user_name', (data) => {
      const user = users.get(socket.id);
      if (!user) return;

      const room = rooms.get(user.roomId);
      if (!room) return;

      const userInstance = room.getUser(user.id);
      if (!userInstance) return;

      const oldName = userInstance.name;
      userInstance.name = data.name;
      userInstance.lastActivity = Date.now();

      // Update persistent store
      userStore.updateUser(user.id, { name: data.name });

      // Update local users tracking
      users.set(socket.id, {
        ...user,
        name: data.name
      });

      // Broadcast name change to room
      io.to(user.roomId).emit('user_name_updated', {
        userId: user.id,
        oldName: oldName,
        newName: data.name,
        users: room.getUsersData()
      });

      console.log(`User ${oldName} changed name to ${data.name}`);
    });

    // Handle task management  ----------------------------------------------
    socket.on('add_task', (taskData) => {
      const user = users.get(socket.id);
      if (!user) return;

      const room = rooms.get(user.roomId);
      if (!room) return;

      const userInstance = room.getUser(user.id);
      if (!userInstance) return;

      const newTask = userInstance.addTask(taskData);
      
      // Broadcast updated user data to room
      io.to(user.roomId).emit('user_updated', {
        userId: user.id,
        userData: userInstance.getUserData()
      });
    });

    socket.on('update_task', (taskUpdate) => {
      const user = users.get(socket.id);
      if (!user) return;

      const room = rooms.get(user.roomId);
      if (!room) return;

      const userInstance = room.getUser(user.id);
      if (!userInstance) return;

      const updatedTask = userInstance.updateTask(taskUpdate.taskId, taskUpdate.updates);
      
      if (updatedTask) {
        // Broadcast updated user data to room
        io.to(user.roomId).emit('user_updated', {
          userId: user.id,
          userData: userInstance.getUserData()
        });
      }
    });

    socket.on('delete_task', (taskData) => {
      const user = users.get(socket.id);
      if (!user) return;

      const room = rooms.get(user.roomId);
      if (!room) return;

      const userInstance = room.getUser(user.id);
      if (!userInstance) return;

      userInstance.deleteTask(taskData.taskId);
      
      // Broadcast updated user data to room
      io.to(user.roomId).emit('user_updated', {
        userId: user.id,
        userData: userInstance.getUserData()
      });
    });

    // Handle chat messages  ----------------------------------------------
    socket.on('send_message', (data) => {
      const user = users.get(socket.id);
      if (!user) return;

      const room = rooms.get(user.roomId);
      if (!room) return;

      const userInstance = room.getUser(user.id);
      if (!userInstance) return;

      // Validate message text
      if (!data.text || data.text.trim().length === 0) {
        console.log('Received empty message, ignoring');
        return;
      }

      // Create message object
      const message = {
        id: Date.now() + '_' + Math.random().toString(36).substr(2, 9),
        text: data.text.trim(),
        userId: user.id,
        userName: userInstance.name,
        timestamp: new Date().toISOString(),
        roomId: user.roomId
      };

      // Add message to room's chat history
      if (!room.chatHistory) {
        room.chatHistory = [];
      }
      room.chatHistory.push(message);

      // Keep only last 100 messages
      if (room.chatHistory.length > 100) {
        room.chatHistory = room.chatHistory.slice(-100);
      }

      // Broadcast message to all users in the room
      io.to(user.roomId).emit('chat_message', message);

      console.log(`Chat message in room ${room.name} from ${userInstance.name}: ${data.text}`);
    });

    // Handle disconnect  ----------------------------------------------
    socket.on('disconnect', () => {
      const user = users.get(socket.id);
      
      if (user) {
        const room = rooms.get(user.roomId);
        
        if (room) {
          // Update user status to offline (don't remove immediately)
          const userInstance = room.getUser(user.id);
          if (userInstance) {
            // Pause timer if it's running when user goes offline
            if (userInstance.timerState.isActive) {
              userInstance.pauseTimer(io, user.roomId);
              console.log(`Paused timer for offline user ${userInstance.name}`);
            }
            
            userInstance.status = 'offline';
            userInstance.socketId = null;
            userInstance.lastActivity = Date.now();
            
            // Update persistent user store
            userStore.setUserOffline(user.id);
          }
          
          // Notify other users
          socket.to(user.roomId).emit('user_disconnected', {
            userId: user.id,
            users: room.getUsersData()
          });

          // Only clean up rooms after a much longer delay and only if room has no attendees at all
          setTimeout(() => {
            const currentRoom = rooms.get(user.roomId);
            if (currentRoom && currentRoom.hasNoAttendees()) {
              // Only delete if room is completely empty (no users at all)
              currentRoom.cleanup();
              rooms.delete(user.roomId);
              console.log(`Room ${room.name} deleted - no attendees for extended period`);
            } else if (currentRoom) {
              console.log(`Room ${room.name} kept alive - still has ${currentRoom.users.size} attendees`);
            }
          }, config.room.inactiveRoomCleanupDelay || 5 * 60 * 1000); // 5 minutes default
        }
        
        // Delete from users tracking after disconnect
        users.delete(socket.id);
      }
      
      console.log(`User disconnected: ${socket.id}`);
    });
  });
}

module.exports = { initializeSocketHandlers }; 