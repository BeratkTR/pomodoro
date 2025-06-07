import io from 'socket.io-client';

class SocketService {
  constructor() {
    this.socket = null;
    this.isConnected = false;
    this.listeners = new Map();
  }

  connect(serverUrl = 'http://18.159.206.201:5001') {
    if (this.socket && this.isConnected) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      this.socket = io(serverUrl, {
        transports: ['websocket', 'polling'],
        timeout: 20000,
      });

      this.socket.on('connect', () => {
        console.log('Connected to server');
        this.isConnected = true;
        resolve();
      });

      this.socket.on('disconnect', () => {
        console.log('Disconnected from server');
        this.isConnected = false;
      });

      this.socket.on('connect_error', (error) => {
        console.error('Connection error:', error);
        this.isConnected = false;
        reject(error);
      });

      // Set up event listeners
      this.setupEventListeners();
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
    // Room events
    this.socket.on('room_joined', (data) => {
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
      this.emit('user_timer_update', data);
    });

    this.socket.on('user_timer_complete', (data) => {
      this.emit('user_timer_complete', data);
    });

    // Individual user settings events
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

    // Chat events
    this.socket.on('chat_message', (data) => {
      this.emit('chat_message', data);
    });

    this.socket.on('chat_history', (data) => {
      this.emit('chat_history', data);
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

  // Settings methods (now for individual user)
  updateSettings(settings) {
    if (this.socket && this.isConnected) {
      this.socket.emit('update_settings', settings);
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

  // Chat methods
  sendMessage(messageText) {
    if (this.socket && this.isConnected) {
      this.socket.emit('send_message', { text: messageText });
    }
  }

  // Utility methods
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