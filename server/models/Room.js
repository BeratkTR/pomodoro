const config = require('../config');

class Room {
  constructor(id, name, createdBy, io) {
    this.id = id;
    this.name = name;
    this.createdBy = createdBy;
    this.io = io; // Socket.io instance for broadcasting
    this.users = new Map(); // userId -> user data
    this.createdAt = new Date();
    this.maxUsers = 2; // Limit to 2 users per room
    this.chatHistory = []; // Store chat messages for persistence
    
    // Shared/synchronized timer state for all users in the room
    this.sharedTimerState = {
      timeLeft: config.timer.defaultPomodoro * 60,
      mode: 'pomodoro', // 'pomodoro', 'break'
      isActive: false,
      currentSession: 1
    };
    
    // Single timer interval for the entire room
    this.timerInterval = null;
    
    // Shared clock pulse interval for synchronized individual timers
    this.sharedClockInterval = null;
    
    // Timer settings - could be controlled by room creator or voted on
    this.timerSettings = {
      pomodoro: config.timer.defaultPomodoro,
      break: config.timer.defaultBreak,
      autoStartBreaks: config.timer.defaultAutoStartBreaks,
      autoStartPomodoros: config.timer.defaultAutoStartPomodoros
    };

    // Music state for room-wide synchronized music
    this.musicState = {
      isPlaying: false,
      currentTrack: null,
      volume: 0.5,
      hostId: null, // Who controls the music
      startTime: null, // When the track started playing
      pausedAt: null // When it was paused (for resume)
    };
  }

  addUser(user) {
    // Check if room is full
    if (this.users.size >= this.maxUsers) {
      return { success: false, message: 'Room is full (max 2 users)' };
    }

    this.users.set(user.id, user);
    return { success: true };
  }

  removeUser(userId) {
    const user = this.users.get(userId);
    if (user) {
      user.cleanup(); // Clean up user's timer
      this.users.delete(userId);
    }
  }

  getUsersData() {
    return Array.from(this.users.values()).map(user => user.getUserData());
  }

  getUser(userId) {
    return this.users.get(userId);
  }

  isFull() {
    return this.users.size >= this.maxUsers;
  }

  isEmpty() {
    const onlineUsers = Array.from(this.users.values()).filter(u => u.status === 'online');
    return onlineUsers.length === 0;
  }

  hasNoAttendees() {
    // Returns true if room has no users at all (neither online nor offline)
    return this.users.size === 0;
  }

  // Synchronized timer methods
  startTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
    }

    this.sharedTimerState.isActive = true;
    console.log(`🚀 SHARED TIMER STARTED for room ${this.name}: isActive = ${this.sharedTimerState.isActive}`);
    
    // Immediately broadcast the start state to all users in the room
    this.io.to(this.id).emit('room_timer_update', {
      roomId: this.id,
      timerState: this.sharedTimerState
    });
    
    this.timerInterval = setInterval(() => {
      this.sharedTimerState.timeLeft--;
      
      // Broadcast timer update to all users in the room
      this.io.to(this.id).emit('room_timer_update', {
        roomId: this.id,
        timerState: this.sharedTimerState
      });

      // Handle timer completion
      if (this.sharedTimerState.timeLeft <= 0) {
        this.handleTimerComplete();
      }
    }, 1000);
  }

  pauseTimer() {
    this.sharedTimerState.isActive = false;
    
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    
    console.log(`⏸️ SHARED TIMER PAUSED for room ${this.name}`);
    
    // Broadcast pause to all users in the room
    this.io.to(this.id).emit('room_timer_update', {
      roomId: this.id,
      timerState: this.sharedTimerState
    });
  }

  resetTimer() {
    this.sharedTimerState.isActive = false;
    
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    
    // Reset time based on current mode
    const timeInMinutes = this.sharedTimerState.mode === 'pomodoro' 
      ? this.timerSettings.pomodoro 
      : this.timerSettings.break;
    
    this.sharedTimerState.timeLeft = timeInMinutes * 60;
    
    console.log(`🔄 SHARED TIMER RESET for room ${this.name} to ${timeInMinutes} minutes`);
    
    // Broadcast reset to all users in the room
    this.io.to(this.id).emit('room_timer_update', {
      roomId: this.id,
      timerState: this.sharedTimerState
    });
  }

  changeMode(mode) {
    this.sharedTimerState.mode = mode;
    
    // Reset time based on new mode
    const timeInMinutes = mode === 'pomodoro' 
      ? this.timerSettings.pomodoro 
      : this.timerSettings.break;
    
    this.sharedTimerState.timeLeft = timeInMinutes * 60;
    
    console.log(`🔄 SHARED TIMER MODE CHANGED for room ${this.name} to ${mode}`);
    
    // Broadcast mode change to all users in the room
    this.io.to(this.id).emit('room_timer_update', {
      roomId: this.id,
      timerState: this.sharedTimerState
    });
  }

  handleTimerComplete() {
    console.log(`✅ SHARED TIMER COMPLETED for room ${this.name}: ${this.sharedTimerState.mode}`);
    
    // Clear the interval
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    
    this.sharedTimerState.isActive = false;

    // Determine next mode and time
    const wasPomodoro = this.sharedTimerState.mode === 'pomodoro';
    
    if (wasPomodoro) {
      this.sharedTimerState.currentSession++;
    }

    // Switch mode for the next session
    const nextMode = wasPomodoro ? 'break' : 'pomodoro';
    const nextTimeInMinutes = nextMode === 'pomodoro' 
      ? this.timerSettings.pomodoro 
      : this.timerSettings.break;
    
    this.sharedTimerState.mode = nextMode;
    this.sharedTimerState.timeLeft = nextTimeInMinutes * 60;

    // Update session progress for all users in the room
    if (wasPomodoro) {
      this.users.forEach(user => {
        user.completedSessions++;
        user.sessionHistory.push({
          type: 'pomodoro',
          completedAt: new Date()
        });
        user.totalWorkTime += this.timerSettings.pomodoro;
      });
    } else {
      this.users.forEach(user => {
        user.sessionHistory.push({
          type: 'break',
          completedAt: new Date()
        });
        user.totalBreakTime += this.timerSettings.break;
      });
    }

    // Broadcast completion to all users in the room
    this.io.to(this.id).emit('room_timer_complete', {
      roomId: this.id,
      completedMode: wasPomodoro ? 'pomodoro' : 'break',
      timerState: this.sharedTimerState,
      usersData: this.getUsersData()
    });

    // Auto-start next session based on settings
    const shouldAutoStart = wasPomodoro 
      ? this.timerSettings.autoStartBreaks 
      : this.timerSettings.autoStartPomodoros;
      
    if (shouldAutoStart) {
      console.log(`⏩ AUTO-STARTING next session (${nextMode}) for room ${this.name}`);
      setTimeout(() => {
        this.startTimer();
      }, 1000); // Small delay to ensure UI updates
    }
  }

  updateTimerSettings(newSettings) {
    this.timerSettings = { ...this.timerSettings, ...newSettings };
    
    // If timer is not active, update current time to match new settings
    if (!this.sharedTimerState.isActive) {
      const timeInMinutes = this.sharedTimerState.mode === 'pomodoro' 
        ? this.timerSettings.pomodoro 
        : this.timerSettings.break;
      
      this.sharedTimerState.timeLeft = timeInMinutes * 60;
      
      // Broadcast settings update
      this.io.to(this.id).emit('room_timer_settings_updated', {
        roomId: this.id,
        timerState: this.sharedTimerState
      });
    }
    
    console.log(`⚙️ TIMER SETTINGS UPDATED for room ${this.name}:`, newSettings);
  }

  // Synchronization logic for individual timers with shared clock pulse
  getActiveTimers() {
    const activeUsers = [];
    this.users.forEach(user => {
      if (user.timerState.isActive) {
        activeUsers.push(user);
      }
    });
    return activeUsers;
  }

  // Check if we should synchronize timers (both users active in same mode)
  shouldSynchronizeTimers() {
    const activeTimers = this.getActiveTimers();
    if (activeTimers.length !== 2) return null;
    
    // Only sync if both users are in the same mode (pomodoro/break)
    const [user1, user2] = activeTimers;
    if (user1.timerState.mode === user2.timerState.mode) {
      // Return the user who started first (has less time remaining)
      return user1.timerState.timeLeft <= user2.timerState.timeLeft ? user1 : user2;
    }
    
    return null;
  }

  // Synchronize a user's timer to match the master timer
  synchronizeUserTimer(userToSync, masterUser) {
    console.log(`🔄 SYNCING: ${userToSync.name} timer to match ${masterUser.name}'s timer`);
    console.log(`  Before sync - ${userToSync.name}: ${userToSync.timerState.timeLeft}s, ${masterUser.name}: ${masterUser.timerState.timeLeft}s`);
    
    // Sync the time and mode
    userToSync.timerState.timeLeft = masterUser.timerState.timeLeft;
    userToSync.timerState.mode = masterUser.timerState.mode;
    
    console.log(`  After sync - Both timers at: ${userToSync.timerState.timeLeft}s (${userToSync.timerState.mode})`);
    
    // Broadcast the sync to clients
    this.io.to(this.id).emit('user_timer_update', {
      userId: userToSync.id,
      timerState: userToSync.timerState
    });
  }

  // Check and handle timer synchronization when a user starts their timer
  handleTimerStart(startingUser) {
    const masterTimer = this.shouldSynchronizeTimers();
    
    if (masterTimer && masterTimer.id !== startingUser.id) {
      // Synchronize the starting user to the master timer
      this.synchronizeUserTimer(startingUser, masterTimer);
      console.log(`🎯 SYNCHRONIZED: ${startingUser.name} synced to ${masterTimer.name}'s clock pulse`);
      
      // Start shared clock pulse for both users
      this.startSharedClockPulse();
    } else if (masterTimer) {
      console.log(`⚡ BOTH TIMERS ACTIVE: ${startingUser.name} and partner running in sync`);
      this.startSharedClockPulse();
    } else {
      console.log(`🔧 INDEPENDENT TIMER: ${startingUser.name} running independently`);
    }
  }

  // Handle when a user pauses/stops their timer (check for desync)
  handleTimerStop(stoppingUser) {
    const activeTimers = this.getActiveTimers();
    
    if (activeTimers.length === 1) {
      const remainingUser = activeTimers[0];
      console.log(`🔄 DESYNC: ${stoppingUser.name} stopped, ${remainingUser.name} continuing independently`);
      
      // Stop shared clock pulse and let remaining user continue independently
      this.stopSharedClockPulse();
      
      // Restart individual timer for remaining user (skip room sync to avoid recursion)
      remainingUser.startTimer(this.io, this.id, true);
    } else if (activeTimers.length === 0) {
      console.log(`⏹️ ALL TIMERS STOPPED in room ${this.name}`);
      this.stopSharedClockPulse();
    }
  }

  // Start shared clock pulse for synchronized users
  startSharedClockPulse() {
    // Clear any existing shared pulse
    this.stopSharedClockPulse();
    
    const activeTimers = this.getActiveTimers();
    if (activeTimers.length !== 2) return;
    
    // Stop individual timer intervals for both users
    activeTimers.forEach(user => {
      if (user.timerInterval) {
        clearInterval(user.timerInterval);
        user.timerInterval = null;
      }
    });
    
    console.log(`🕘 SHARED CLOCK PULSE STARTED: Both users synchronized at ${activeTimers[0].timerState.timeLeft}s`);
    
    // Create shared interval that updates both users
    this.sharedClockInterval = setInterval(() => {
      // Decrement time for both users simultaneously
      activeTimers.forEach(user => {
        user.timerState.timeLeft--;
      });
      
      // Broadcast update to both users
      activeTimers.forEach(user => {
        this.io.to(this.id).emit('user_timer_update', {
          userId: user.id,
          timerState: user.timerState
        });
      });
      
      // Check for completion (use first user's timer state since they're synchronized)
      const masterUser = activeTimers[0];
      if (masterUser.timerState.timeLeft <= 0) {
        console.log(`⏰ SHARED CLOCK PULSE COMPLETE: Both timers finished simultaneously`);
        
        // Stop the shared pulse first
        this.stopSharedClockPulse();
        
        // Handle completion for both users (they'll each switch modes and may auto-start)
        activeTimers.forEach(user => {
          user.handleTimerComplete(this.io, this.id);
        });
        
        // Check if both users have auto-start enabled for the new mode - if so, start shared pulse again
        setTimeout(() => {
          const nowActiveTimers = this.getActiveTimers();
          if (nowActiveTimers.length === 2 && 
              nowActiveTimers[0].timerState.mode === nowActiveTimers[1].timerState.mode) {
            console.log(`🔄 AUTO-RESTARTING SHARED PULSE: Both users auto-started ${nowActiveTimers[0].timerState.mode}`);
            this.startSharedClockPulse();
          }
        }, 100); // Small delay to let auto-start logic complete
      }
    }, 1000);
  }

  // Stop shared clock pulse
  stopSharedClockPulse() {
    if (this.sharedClockInterval) {
      clearInterval(this.sharedClockInterval);
      this.sharedClockInterval = null;
      console.log(`🛑 SHARED CLOCK PULSE STOPPED`);
    }
  }

  // Music control methods
  handleMusicControl(action, userId, data = {}) {
    console.log(`🎵 Music control: ${action} from user ${userId}`);
    
    switch (action) {
      case 'take_control':
        this.musicState.hostId = userId;
        console.log(`🎵 User ${userId} took music control`);
        break;
        
      case 'play':
        if (this.musicState.hostId === userId) {
          this.musicState.isPlaying = true;
          this.musicState.startTime = Date.now();
          this.musicState.pausedAt = null;
          console.log(`🎵 Music started by ${userId}`);
        }
        break;
        
      case 'pause':
        if (this.musicState.hostId === userId) {
          this.musicState.isPlaying = false;
          this.musicState.pausedAt = Date.now();
          console.log(`🎵 Music paused by ${userId}`);
        }
        break;
        
      case 'play_pause':
        // Toggle play/pause state
        if (this.musicState.hostId === userId || this.musicState.hostId === null) {
          if (this.musicState.hostId === null) {
            this.musicState.hostId = userId; // Take control if no host
          }
          
          this.musicState.isPlaying = !this.musicState.isPlaying;
          
          if (this.musicState.isPlaying) {
            this.musicState.startTime = Date.now();
            this.musicState.pausedAt = null;
            console.log(`🎵 Music started by ${userId}`);
          } else {
            this.musicState.pausedAt = Date.now();
            console.log(`🎵 Music paused by ${userId}`);
          }
        }
        break;
        
      case 'volume':
        if (this.musicState.hostId === userId && data.volume !== undefined) {
          this.musicState.volume = Math.max(0, Math.min(1, data.volume));
          console.log(`🎵 Volume changed to ${this.musicState.volume} by ${userId}`);
        }
        break;
        
      case 'track_change':
        if (this.musicState.hostId === userId && data.track) {
          this.musicState.currentTrack = data.track;
          this.musicState.startTime = Date.now();
          this.musicState.pausedAt = null;
          console.log(`🎵 Track changed to ${data.track.name} by ${userId}`);
        }
        break;
        
      case 'load_url':
        // Load a new URL/track
        if (this.musicState.hostId === userId || this.musicState.hostId === null) {
          if (this.musicState.hostId === null) {
            this.musicState.hostId = userId; // Take control if no host
          }
          
          this.musicState.currentTrack = {
            url: data.url,
            name: data.url.split('/').pop() || 'Custom Track'
          };
          this.musicState.isPlaying = false; // Stop current playback
          this.musicState.startTime = null;
          this.musicState.pausedAt = null;
          console.log(`🎵 URL loaded: ${data.url} by ${userId}`);
        }
        break;
    }
    
    // Broadcast music state to all users in room
    this.io.to(this.id).emit('room_music_update', this.musicState);
  }

  // Get current music state
  getMusicState() {
    return this.musicState;
  }

  // Clean up method to be called when room is destroyed
  cleanup() {
    // Clean up shared timer
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    
    // Clean up shared clock pulse
    this.stopSharedClockPulse();
    
    // Clean up all users' individual timers (if any remain)
    this.users.forEach(user => {
      user.cleanup();
    });
  }
}

module.exports = Room;  