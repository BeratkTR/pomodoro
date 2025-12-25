import io from 'socket.io-client';

class SocketService {
  constructor() {
    this.socket = null;
    this.isConnected = false;
    this.listeners = new Map();
  }

  // connect(serverUrl = 'https://api.beratkaragol.xyz') {
  connect(serverUrl = 'http://localhost:5001') {
    console.log('🔌 socketService.connect() called with URL:', serverUrl);
    
    if (this.socket && this.isConnected) {
      console.log('✅ Already connected, returning resolved promise');
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      console.log('📡 Creating new socket connection...');
      
      this.socket = io(serverUrl, {
        transports: ['websocket', 'polling'],
        timeout: 20000,
      });

      this.socket.on('connect', () => {
        console.log('✅ SOCKET CONNECTED! Resolving promise...');
        this.isConnected = true;
        resolve();
      });

      this.socket.on('disconnect', () => {
        console.log('❌ Socket disconnected');
        this.isConnected = false;
      });

      this.socket.on('connect_error', (error) => {
        console.error('🚨 Socket connection error:', error);
        this.isConnected = false;
        reject(error);
      });

      // Set up event listeners
      console.log('🔧 Setting up socket event listeners...');
      this.setupEventListeners();
      
      // Timeout fallback
      setTimeout(() => {
        if (!this.isConnected) {
          console.error('⏰ Connection timeout after 10 seconds');
          reject(new Error('Connection timeout'));
        }
      }, 10000);
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
    }
  }

  setupEventListeners() {
    // Clear specific listeners to avoid removing connection listeners
    if (this.socket) {
      console.log('🧹 Clearing existing room/timer event listeners...');
      // Don't remove 'connect', 'disconnect', 'connect_error' listeners
      const eventsToKeep = ['connect', 'disconnect', 'connect_error'];
      const allEvents = ['room_joined', 'user_joined', 'user_disconnected', 'user_reconnected', 'user_left', 
                        'user_timer_update', 'user_timer_complete', 'user_settings_updated',
                        'user_name_updated', 'user_updated', 'session_notes_updated', 'chat_message', 'chat_history', 
                        'message_status_update', 'user_typing_start', 'user_typing_stop',
                        'video_call_request', 'video_call_accepted', 'video_call_rejected', 
                        'video_offer', 'video_answer', 'ice_candidate', 'video_call_ended', 'error'];
      
      allEvents.forEach(event => {
        this.socket.removeAllListeners(event);
      });
    }
    
    // Room events
    this.socket.on('room_joined', (data) => {
      console.log('🔌 SOCKET: room_joined event received', data);
      this.emit('room_joined', data);
    });

    this.socket.on('user_joined', (data) => {
      this.emit('user_joined', data);
    });

    this.socket.on('user_disconnected', (data) => {
      this.emit('user_disconnected', data);
    });

    this.socket.on('user_reconnected', (data) => {
      this.emit('user_reconnected', data);
    });

    this.socket.on('user_left', (data) => {
      this.emit('user_left', data);
    });

    // Individual user timer events
    this.socket.on('user_timer_update', (data) => {
      console.log('🔌 SOCKET: user_timer_update event received', data);
      this.emit('user_timer_update', data);
    });

    this.socket.on('user_timer_complete', (data) => {
      this.emit('user_timer_complete', data);
    });

    this.socket.on('user_settings_updated', (data) => {
      this.emit('user_settings_updated', data);
    });

    // User name updates
    this.socket.on('user_name_updated', (data) => {
      this.emit('user_name_updated', data);
    });

    // User data updates
    this.socket.on('user_updated', (data) => {
      this.emit('user_updated', data);
    });

    // Session notes events
    this.socket.on('session_notes_updated', (data) => {
      this.emit('session_notes_updated', data);
    });

    // Chat events
    this.socket.on('chat_message', (data) => {
      this.emit('chat_message', data);
    });

    this.socket.on('chat_history', (data) => {
      this.emit('chat_history', data);
    });

    this.socket.on('message_status_update', (data) => {
      this.emit('message_status_update', data);
    });

    // Typing indicator events
    this.socket.on('user_typing_start', (data) => {
      this.emit('user_typing_start', data);
    });

    this.socket.on('user_typing_stop', (data) => {
      this.emit('user_typing_stop', data);
    });

    // Video call events
    this.socket.on('video_call_request', (data) => {
      this.emit('video_call_request', data);
    });

    this.socket.on('video_call_accepted', (data) => {
      this.emit('video_call_accepted', data);
    });

    this.socket.on('video_call_rejected', (data) => {
      this.emit('video_call_rejected', data);
    });

    this.socket.on('video_offer', (data) => {
      this.emit('video_offer', data);
    });

    this.socket.on('video_answer', (data) => {
      this.emit('video_answer', data);
    });

    this.socket.on('ice_candidate', (data) => {
      this.emit('ice_candidate', data);
    });

    this.socket.on('video_call_ended', (data) => {
      this.emit('video_call_ended', data);
    });

    // Error events
    this.socket.on('error', (data) => {
      this.emit('error', data);
    });
  }

  // Event emitter methods
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  off(event, callback) {
    if (this.listeners.has(event)) {
      const callbacks = this.listeners.get(event);
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  emit(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(callback => {
        callback(data);
      });
    }
  }

  // Room methods
  joinRoom(roomId, user, isReconnection = false, existingUserData = null) {
    if (this.socket && this.isConnected) {
      this.socket.emit('join_room', { roomId, user, isReconnection, existingUserData });
    }
  }

  leaveRoom() {
    if (this.socket && this.isConnected) {
      this.socket.emit('leave_room');
    }
  }

  // Timer control methods (now for individual user)
  startTimer() {
    if (this.socket && this.isConnected) {
      this.socket.emit('start_timer');
    }
  }

  pauseTimer() {
    if (this.socket && this.isConnected) {
      this.socket.emit('pause_timer');
    }
  }

  resetTimer() {
    if (this.socket && this.isConnected) {
      this.socket.emit('reset_timer');
    }
  }

  changeMode(mode) {
    if (this.socket && this.isConnected) {
      this.socket.emit('change_mode', { mode });
    }
  }

  skipToBreak() {
    if (this.socket && this.isConnected) {
      this.socket.emit('skip_to_break');
    }
  }

  skipToFocus() {
    if (this.socket && this.isConnected) {
      this.socket.emit('skip_to_focus');
    }
  }

  // Settings methods
  updateSettings(settings) {
    if (this.socket && this.isConnected) {
      this.socket.emit('update_settings', settings);
    }
  }

  // Update timezone
  updateTimezone(timezone) {
    if (this.socket && this.isConnected) {
      console.log(`Sending timezone to server: ${timezone}`);
      this.socket.emit('update_timezone', timezone);
    }
  }

  updateUserName(newName) {
    if (this.socket && this.isConnected) {
      this.socket.emit('update_user_name', { name: newName });
    }
  }

  // Task management methods
  addTask(taskData) {
    if (this.socket && this.isConnected) {
      this.socket.emit('add_task', taskData);
    }
  }

  updateTask(taskUpdate) {
    if (this.socket && this.isConnected) {
      this.socket.emit('update_task', taskUpdate);
    }
  }

  deleteTask(taskData) {
    if (this.socket && this.isConnected) {
      this.socket.emit('delete_task', taskData);
    }
  }

  // Session notes methods
  updateSessionNotes(sessionIndex, notes, isCurrent = false) {
    if (this.socket && this.isConnected) {
      console.log('🚀 Emitting update_session_notes:', { sessionIndex, notes: notes.substring(0, 50), isCurrent });
      this.socket.emit('update_session_notes', { sessionIndex, notes, isCurrent });
    }
  }

  // Chat methods
  sendMessage(messageText) {
    if (this.socket && this.isConnected) {
      this.socket.emit('send_message', { text: messageText });
    }
  }

  markMessagesAsRead() {
    if (this.socket && this.isConnected) {
      this.socket.emit('mark_messages_read');
    }
  }

  // Typing indicator methods
  startTyping() {
    if (this.socket && this.isConnected) {
      this.socket.emit('typing_start');
    }
  }

  stopTyping() {
    if (this.socket && this.isConnected) {
      this.socket.emit('typing_stop');
    }
  }

  // Video call methods
  sendVideoCallRequest(toUserId) {
    if (this.socket && this.isConnected) {
      this.socket.emit('video_call_request', { toUserId });
    }
  }

  acceptVideoCall(toUserId) {
    if (this.socket && this.isConnected) {
      this.socket.emit('video_call_accept', { toUserId });
    }
  }

  rejectVideoCall(toUserId) {
    if (this.socket && this.isConnected) {
      this.socket.emit('video_call_reject', { toUserId });
    }
  }

  sendVideoOffer(offer, toUserId) {
    if (this.socket && this.isConnected) {
      this.socket.emit('video_offer', { offer, toUserId });
    }
  }

  sendVideoAnswer(answer, toUserId) {
    if (this.socket && this.isConnected) {
      this.socket.emit('video_answer', { answer, toUserId });
    }
  }

  sendIceCandidate(candidate, toUserId) {
    if (this.socket && this.isConnected) {
      this.socket.emit('ice_candidate', { candidate, toUserId });
    }
  }

  endVideoCall(toUserId) {
    if (this.socket && this.isConnected) {
      this.socket.emit('video_call_end', { toUserId });
    }
  }

  // Utility methods
  isConnected() {
    const connected = this.socket && this.socket.connected && this.isConnected;
    console.log('🔍 socketService.isConnected() check:', {
      hasSocket: !!this.socket,
      socketConnected: this.socket ? this.socket.connected : false,
      isConnectedFlag: this.isConnected,
      result: connected
    });
    return connected;
  }

  isSocketConnected() {
    return this.socket && this.isConnected;
  }

  getSocketId() {
    return this.socket ? this.socket.id : null;
  }
}

// Create singleton instance
const socketService = new SocketService();
export default socketService; 