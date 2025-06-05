const config = require('../config');

class User {
  constructor(id, name, socketId) {
    this.id = id;
    this.name = name;
    this.socketId = socketId;
    this.joinedAt = new Date();
    this.lastActivity = Date.now();
    this.status = 'online'; // 'online', 'offline'
    
    // Individual timer state
    this.timerState = {
      timeLeft: config.timer.defaultPomodoro * 60,
      mode: 'pomodoro', // 'pomodoro', 'break'
      isActive: false,
      currentSession: 1
    };
    
    // Individual timer interval
    this.timerInterval = null;
    
    // Individual settings
    this.settings = {
      pomodoro: config.timer.defaultPomodoro,
      break: config.timer.defaultBreak,
      autoStartBreaks: config.timer.defaultAutoStartBreaks,
      autoStartPomodoros: config.timer.defaultAutoStartPomodoros
    };
    
    // User's tasks
    this.tasks = [];
    this.completedSessions = 0;
    this.currentSessionProgress = 0;
    
    // Accumulated time tracking (in minutes)
    this.totalWorkTime = 0;
    this.totalBreakTime = 0;
  }

  addTask(task) {
    const newTask = {
      id: Date.now().toString(),
      text: task.text,
      completed: false,
      createdAt: new Date()
    };
    this.tasks.push(newTask);
    return newTask;
  }

  updateTask(taskId, updates) {
    const taskIndex = this.tasks.findIndex(task => task.id === taskId);
    if (taskIndex !== -1) {
      this.tasks[taskIndex] = { ...this.tasks[taskIndex], ...updates };
      return this.tasks[taskIndex];
    }
    return null;
  }

  deleteTask(taskId) {
    this.tasks = this.tasks.filter(task => task.id !== taskId);
  }

  startTimer(io, roomId) {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
    }

    this.timerState.isActive = true;
    this.timerInterval = setInterval(() => {
      this.timerState.timeLeft--;
      
      // Broadcast timer update to room (so partner can see)
      io.to(roomId).emit('user_timer_update', {
        userId: this.id,
        timerState: this.timerState
      });

      // Handle timer completion
      if (this.timerState.timeLeft <= 0) {
        this.handleTimerComplete(io, roomId);
      }
    }, 1000);
  }

  pauseTimer(io, roomId) {
    this.timerState.isActive = false;
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }

    // Broadcast pause to room
    io.to(roomId).emit('user_timer_update', {
      userId: this.id,
      timerState: this.timerState
    });
  }

  handleTimerComplete(io, roomId) {
    this.pauseTimer(io, roomId);
    
    if (this.timerState.mode === 'pomodoro') {
      // Add completed pomodoro time
      this.totalWorkTime += this.settings.pomodoro;
      
      // Update completed sessions
      this.completedSessions++;
      this.currentSessionProgress = 0;

      // Switch to break
      this.timerState.mode = 'break';
      this.timerState.timeLeft = this.settings.break * 60;
      this.timerState.currentSession++;
    } else {
      // Add completed break time
      this.totalBreakTime += this.settings.break;
      
      // Break completed, switch to pomodoro
      this.timerState.mode = 'pomodoro';
      this.timerState.timeLeft = this.settings.pomodoro * 60;
      this.currentSessionProgress = 0;
    }

    // Notify room about timer completion
    io.to(roomId).emit('user_timer_complete', {
      userId: this.id,
      timerState: this.timerState,
      completedSessions: this.completedSessions
    });

    // Auto-start next session if enabled and user is online
    const shouldAutoStart = (this.timerState.mode === 'pomodoro' && this.settings.autoStartPomodoros) ||
                          (this.timerState.mode !== 'pomodoro' && this.settings.autoStartBreaks);
    
    if (shouldAutoStart && this.status === 'online') {
      setTimeout(() => {
        // Double check user is still online before auto-starting
        if (this.status === 'online') {
          this.startTimer(io, roomId);
        }
      }, config.room.autoStartDelay);
    }
  }

  resetTimer(io, roomId) {
    this.pauseTimer(io, roomId);
    this.timerState.mode = 'pomodoro';
    this.timerState.timeLeft = this.settings.pomodoro * 60;
    this.timerState.currentSession = 1;
    this.completedSessions = 0;
    this.currentSessionProgress = 0;
    // Note: Don't reset totalWorkTime and totalBreakTime - they should persist

    // Broadcast reset to room
    io.to(roomId).emit('user_timer_update', {
      userId: this.id,
      timerState: this.timerState
    });
  }

  changeMode(mode, io, roomId) {
    this.pauseTimer(io, roomId);
    this.timerState.mode = mode;
    
    if (mode === 'pomodoro') {
      this.timerState.timeLeft = this.settings.pomodoro * 60;
    } else if (mode === 'break') {
      this.timerState.timeLeft = this.settings.break * 60;
    }

    // Broadcast mode change to room
    io.to(roomId).emit('user_timer_update', {
      userId: this.id,
      timerState: this.timerState
    });
  }

  updateSettings(newSettings, io, roomId) {
    this.settings = { ...this.settings, ...newSettings };
    
    // If timer is not active, update the time based on current mode
    if (!this.timerState.isActive) {
      if (this.timerState.mode === 'pomodoro') {
        this.timerState.timeLeft = this.settings.pomodoro * 60;
      } else if (this.timerState.mode === 'break') {
        this.timerState.timeLeft = this.settings.break * 60;
      }
    }

    // Broadcast settings update to room
    io.to(roomId).emit('user_settings_updated', {
      userId: this.id,
      settings: this.settings,
      timerState: this.timerState
    });
  }

  getUserData() {
    return {
      id: this.id,
      name: this.name,
      status: this.status,
      timerState: this.timerState,
      settings: this.settings,
      tasks: this.tasks,
      completedSessions: this.completedSessions,
      currentSessionProgress: this.currentSessionProgress,
            totalWorkTime: this.totalWorkTime,
      totalBreakTime: this.totalBreakTime,
      joinedAt: this.joinedAt
    };
  }

  // Clean up method to be called when user disconnects
  cleanup() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }
}

module.exports = User; 