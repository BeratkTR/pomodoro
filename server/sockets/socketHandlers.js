const config = require('../config');
const { User } = require('../models');
const userStore = require('../services/UserStore');

// Helper function to trigger persistence save with debouncing
let saveTimeout = null;
function triggerPersistenceSave(rooms, userStore, delay = 5000) {
  if (saveTimeout) {
    clearTimeout(saveTimeout);
  }
  
  saveTimeout = setTimeout(async () => {
    try {
      if (userStore.persistenceManager) {
        await Promise.all([
          userStore.persistenceManager.saveRooms(rooms),
          userStore.persistenceManager.saveUsers(userStore)
        ]);
        console.log('Auto-saved data after user activity');
      }
    } catch (error) {
      console.error('Error during triggered persistence save:', error);
    }
  }, delay);
}

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
      const userData = {
        ...persistentUser.getUserData(),
        roomId: roomId
      };
      users.set(socket.id, userData);
      console.log(`✅ Added user to tracking: ${socket.id} -> ${userData.name} in room ${roomId}`);

      // Add user to room
      const addResult = room.addUser(persistentUser);
      if (!addResult.success) {
        socket.emit('error', { message: addResult.message });
        return;
      }

      // Update room info for authenticated users
      persistentUser.updateRoomInfo(roomId, room.name);
      
      // Save to persistence if user is authenticated
      if (persistentUser.isAuthenticated) {
        triggerPersistenceSave(rooms, userStore, 1000); // Save after 1 second
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
      
      // Trigger persistence save when user joins
      triggerPersistenceSave(rooms, userStore);
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
            // Clear room info for authenticated users when explicitly leaving
            userInstance.clearRoomInfo();
            
            // Save to persistence if user is authenticated
            if (userInstance.isAuthenticated) {
              triggerPersistenceSave(rooms, userStore, 1000); // Save after 1 second
            }
            
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

    // Handle synchronized timer control ----------------------------------------------
    socket.on('start_timer', () => {
      const user = users.get(socket.id);
      if (!user) {
        console.log('start_timer: User not found');
        return;
      }

      const room = rooms.get(user.roomId);
      if (!room) {
        console.log('start_timer: Room not found');
        return;
      }

      const userInstance = room.getUser(user.id);
      if (!userInstance) {
        console.log('start_timer: User instance not found in room');
        return;
      }

      // Only allow timer operations for online users
      if (userInstance.status !== 'online') {
        console.log(`Blocked timer start for offline user ${userInstance.name}`);
        return;
      }

      console.log(`Starting individual timer for ${userInstance.name}`);
      userInstance.startTimer(io, room.id);
      
      // Immediate persistence save for timer state changes
      triggerPersistenceSave(rooms, userStore, 1000);
    });

    socket.on('pause_timer', () => {
      const user = users.get(socket.id);
      if (!user) {
        console.log('pause_timer: User not found');
        return;
      }

      const room = rooms.get(user.roomId);
      if (!room) {
        console.log('pause_timer: Room not found');
        return;
      }

      const userInstance = room.getUser(user.id);
      if (!userInstance) {
        console.log('pause_timer: User instance not found in room');
        return;
      }

      // Only allow timer operations for online users
      if (userInstance.status !== 'online') {
        console.log(`Blocked timer pause for offline user ${userInstance.name}`);
        return;
      }

      console.log(`Pausing individual timer for ${userInstance.name}`);
      userInstance.pauseTimer(io, room.id);
      
      // Immediate persistence save for timer state changes
      triggerPersistenceSave(rooms, userStore, 1000);
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

      console.log(`Resetting individual timer for ${userInstance.name}`);
      userInstance.resetTimer(io, room.id);
      
      // Immediate persistence save for timer state changes
      triggerPersistenceSave(rooms, userStore, 1000); // 1 second delay for timer changes
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

      console.log(`Changing individual timer mode for ${userInstance.name} to ${data.mode}`);
      userInstance.changeMode(data.mode, io, room.id);
      
      // Immediate persistence save for timer state changes
      triggerPersistenceSave(rooms, userStore, 1000); // 1 second delay for timer changes
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

      console.log(`Skipping to break for ${userInstance.name}`);
      userInstance.skipToBreak(io, room.id);
      
      // Immediate persistence save for timer state changes
      triggerPersistenceSave(rooms, userStore, 1000); // 1 second delay for timer changes
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

      console.log(`Skipping to pomodoro for ${userInstance.name}`);
      userInstance.skipToFocus(io, room.id);
      
      // Immediate persistence save for timer state changes
      triggerPersistenceSave(rooms, userStore, 1000); // 1 second delay for timer changes
    });

    // Handle force day reset (for testing/debugging)  ----------------------------------------------
    socket.on('force_reset_daily', () => {
      const user = users.get(socket.id);
      if (!user) return;

      const room = rooms.get(user.roomId);
      if (!room) return;

      const userInstance = room.getUser(user.id);
      if (!userInstance) return;

      // Only allow for online users
      if (userInstance.status !== 'online') {
        console.log(`Blocked force daily reset for offline user ${userInstance.name}`);
        return;
      }

      console.log(`Force daily reset requested by ${userInstance.name}`);
      const wasReset = userInstance.forceResetDaily(io, user.roomId);
      
      if (wasReset) {
        console.log(`Force daily reset completed for ${userInstance.name}`);
        // Immediate persistence save for reset
        triggerPersistenceSave(rooms, userStore, 1000);
      } else {
        console.log(`Force daily reset failed for ${userInstance.name}`);
      }
    });

    // Handle individual settings update  ----------------------------------------------
    socket.on('update_settings', (newSettings) => {
      const user = users.get(socket.id);
      if (!user) return;

      const room = rooms.get(user.roomId);
      if (!room) return;

      const userInstance = room.getUser(user.id);
      if (!userInstance) return;

      // Only allow settings update for online users
      if (userInstance.status !== 'online') {
        console.log(`Blocked settings update for offline user ${userInstance.name}`);
        return;
      }

      console.log(`Updating individual timer settings for ${userInstance.name}:`, newSettings);
      userInstance.updateSettings(newSettings, io, room.id);
      
      // Trigger persistence save for settings changes
      triggerPersistenceSave(rooms, userStore);
    });

    // Handle timezone update  ----------------------------------------------
    socket.on('update_timezone', (timezone) => {
      const user = users.get(socket.id);
      if (!user) return;

      const room = rooms.get(user.roomId);
      if (!room) return;

      const userInstance = room.getUser(user.id);
      if (!userInstance) return;

      console.log(`Timezone update from ${userInstance.name}: ${timezone}`);
      const wasReset = userInstance.setTimezone(timezone);
      
      if (wasReset) {
        console.log(`Daily reset triggered by timezone change for ${userInstance.name}`);
        // Broadcast the reset to update clients
        io.to(user.roomId).emit('user_updated', {
          userId: userInstance.id,
          userData: userInstance.getUserData()
        });
        
        // Trigger immediate persistence save for reset
        triggerPersistenceSave(rooms, userStore, 1000);
      } else {
        // Just trigger normal persistence save
        triggerPersistenceSave(rooms, userStore);
      }
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
      
      // Trigger persistence save for name changes
      triggerPersistenceSave(rooms, userStore);
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
      
      // Trigger persistence save for task changes
      triggerPersistenceSave(rooms, userStore);
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
        
        // Trigger persistence save for task changes
        triggerPersistenceSave(rooms, userStore);
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
      
      // Trigger persistence save for task changes
      triggerPersistenceSave(rooms, userStore);
    });

    // Handle session notes  ----------------------------------------------
    socket.on('update_session_notes', (data) => {
      const user = users.get(socket.id);
      if (!user) return;

      const room = rooms.get(user.roomId);
      if (!room) return;

      const userInstance = room.getUser(user.id);
      if (!userInstance) return;

      const { sessionIndex, notes } = data;
      
      // Initialize currentSessionNotes if it doesn't exist
      if (!userInstance.currentSessionNotes) {
        userInstance.currentSessionNotes = '';
      }
      
      // Helper to check if two dates are on the same calendar day
      const isSameDay = (a, b) => {
        return a.getDate() === b.getDate() && a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear();
      };
      
      // Filter today's sessions (same logic as frontend)
      const today = new Date();
      const todaysSessionHistory = (userInstance.sessionHistory || []).filter(s => {
        if (!s?.completedAt) return false;
        const completedAt = new Date(s.completedAt);
        return isSameDay(completedAt, today);
      });
      
      console.log(`📝 Updating session notes for ${userInstance.name}:`, {
        sessionIndex,
        totalSessions: userInstance.sessionHistory?.length,
        todaysSessions: todaysSessionHistory.length,
        notes: notes.substring(0, 50)
      });
      
      // Check if this is for a completed session (from today's filtered list)
      const isCompletedSession = todaysSessionHistory[sessionIndex];
      
      if (isCompletedSession) {
        // Find this session in the full sessionHistory array
        const sessionToUpdate = todaysSessionHistory[sessionIndex];
        const fullHistoryIndex = userInstance.sessionHistory.findIndex(s => 
          s.completedAt === sessionToUpdate.completedAt
        );
        
        if (fullHistoryIndex !== -1) {
          userInstance.sessionHistory[fullHistoryIndex].notes = notes;
          console.log(`✅ Completed session notes updated at full index ${fullHistoryIndex} (today's index ${sessionIndex})`);
        }
      } else {
        // This is for the current/active session
        userInstance.currentSessionNotes = notes;
        console.log(`✅ Current session notes updated`);
      }
      
      // Broadcast updated user data to room
      io.to(user.roomId).emit('user_updated', {
        userId: user.id,
        userData: userInstance.getUserData()
      });
      
      // Also emit specific session notes update event with isCurrent flag
      io.to(user.roomId).emit('session_notes_updated', {
        userId: user.id,
        sessionIndex: sessionIndex,
        notes: notes,
        isCurrent: !isCompletedSession // Flag to indicate if this is current session
      });
      
      // Trigger persistence save for session notes changes
      triggerPersistenceSave(rooms, userStore);
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
        roomId: user.roomId,
        status: {
          sent: true,
          read: false
        }
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

      // Message is sent and delivered immediately

      console.log(`Chat message in room ${room.name} from ${userInstance.name}: ${data.text}`);
      
      // Trigger persistence save for chat messages
      triggerPersistenceSave(rooms, userStore);
    });

    // Handle message read status  ----------------------------------------------
    socket.on('mark_messages_read', (data) => {
      const user = users.get(socket.id);
      if (!user) return;

      const room = rooms.get(user.roomId);
      if (!room) return;

      // Mark all messages from other users as read
      if (room.chatHistory) {
        let hasUpdates = false;
        room.chatHistory.forEach(message => {
          // Only mark messages from other users as read
          if (message.userId !== user.id && !message.status.read) {
            message.status.read = true;
            hasUpdates = true;
            
            // Notify the sender that their message was read
            const senderUser = Array.from(room.users.values()).find(u => u.id === message.userId);
            if (senderUser && senderUser.socketId) {
              io.to(senderUser.socketId).emit('message_status_update', {
                messageId: message.id,
                status: message.status
              });
            }
          }
        });

        if (hasUpdates) {
          console.log(`User ${user.id} marked messages as read in room ${room.name}`);
        }
      }
    });

    // Handle typing indicators  ----------------------------------------------
    socket.on('typing_start', (data) => {
      const user = users.get(socket.id);
      if (!user) return;

      const room = rooms.get(user.roomId);
      if (!room) return;

      const userInstance = room.getUser(user.id);
      if (!userInstance) return;

      // Notify other users in the room that this user started typing
      socket.to(user.roomId).emit('user_typing_start', {
        userId: user.id,
        userName: userInstance.name
      });

      console.log(`User ${userInstance.name} started typing in room ${room.name}`);
    });

    socket.on('typing_stop', (data) => {
      const user = users.get(socket.id);
      if (!user) return;

      const room = rooms.get(user.roomId);
      if (!room) return;

      const userInstance = room.getUser(user.id);
      if (!userInstance) return;

      // Notify other users in the room that this user stopped typing
      socket.to(user.roomId).emit('user_typing_stop', {
        userId: user.id,
        userName: userInstance.name
      });

      console.log(`User ${userInstance.name} stopped typing in room ${room.name}`);
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
            // Stop typing indicator when user disconnects
            socket.to(user.roomId).emit('user_typing_stop', {
              userId: user.id,
              userName: userInstance.name
            });
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
          
          // Trigger persistence save for user status changes
          triggerPersistenceSave(rooms, userStore);

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

    // Music control handlers
    socket.on('music_control', (data) => {
      const user = users.get(socket.id);
      if (!user) {
        console.log('music_control: User not found');
        return;
      }

      const room = rooms.get(user.roomId);
      if (!room) {
        console.log('music_control: Room not found');
        return;
      }

      console.log(`🎵 Music control from ${user.name}:`, data);
      
      // Handle the music control action
      room.handleMusicControl(data.action, user.id, data);
      
      // Immediate persistence save for music state changes
      triggerPersistenceSave(rooms, userStore, 1000);
    });

    // Request current music state when joining room
    socket.on('get_music_state', () => {
      const user = users.get(socket.id);
      if (!user) {
        console.log('get_music_state: User not found');
        return;
      }

      const room = rooms.get(user.roomId);
      if (!room) {
        console.log('get_music_state: Room not found');
        return;
      }

      // Send current music state to the requesting user
      socket.emit('room_music_update', room.getMusicState());
    });
  });
}

module.exports = { initializeSocketHandlers }; 