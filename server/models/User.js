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
    
    // Session history to track types of completed sessions
    this.sessionHistory = []; // Array of {type: 'pomodoro'|'break', completedAt: timestamp}
    
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
      console.log(`TIMER COMPLETE: ${this.name} - Adding ${this.settings.pomodoro}m to totalWorkTime (was ${this.totalWorkTime})`);
      this.totalWorkTime += this.settings.pomodoro;
      console.log(`TIMER COMPLETE: ${this.name} - totalWorkTime is now ${this.totalWorkTime}m`);
      
      // Add to session history
      this.sessionHistory.push({
        type: 'pomodoro',
        completedAt: Date.now(),
        duration: this.settings.pomodoro // Store the actual duration completed
      });
      
      // Update completed sessions (only count pomodoros for backward compatibility)
      this.completedSessions++;
      this.currentSessionProgress = 0;

      // Switch to break
      this.timerState.mode = 'break';
      this.timerState.timeLeft = this.settings.break * 60;
      this.timerState.currentSession++;
    } else {
      // Add completed break time
      console.log(`TIMER COMPLETE: ${this.name} - Adding ${this.settings.break}m to totalBreakTime (was ${this.totalBreakTime})`);
      this.totalBreakTime += this.settings.break;
      console.log(`TIMER COMPLETE: ${this.name} - totalBreakTime is now ${this.totalBreakTime}m`);
      
      // Add to session history
      this.sessionHistory.push({
        type: 'break',
        completedAt: Date.now(),
        duration: this.settings.break // Store the actual duration completed
      });
      
      // Break completed, switch to pomodoro
      this.timerState.mode = 'pomodoro';
      this.timerState.timeLeft = this.settings.pomodoro * 60;
      this.timerState.currentSession++;
      this.currentSessionProgress = 0;
    }

    // Notify room about timer completion
    io.to(roomId).emit('user_timer_complete', {
      userId: this.id,
      timerState: this.timerState,
      completedSessions: this.completedSessions,
      sessionHistory: this.sessionHistory,
      totalWorkTime: this.totalWorkTime,
      totalBreakTime: this.totalBreakTime
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
    console.log(`RESET TIMER: ${this.name} - Before reset: totalWorkTime=${this.totalWorkTime}, totalBreakTime=${this.totalBreakTime}`);
    
    // Save any elapsed time from current session before resetting
    if (this.timerState.isActive || this.timerState.timeLeft < (this.timerState.mode === 'pomodoro' ? this.settings.pomodoro * 60 : this.settings.break * 60)) {
      const totalTime = this.timerState.mode === 'pomodoro' ? this.settings.pomodoro * 60 : this.settings.break * 60;
      const elapsedTime = totalTime - this.timerState.timeLeft;
      const elapsedMinutes = elapsedTime / 60;
      
      if (elapsedMinutes > 0) {
        if (this.timerState.mode === 'pomodoro') {
          console.log(`RESET TIMER: ${this.name} - Saving ${elapsedMinutes}m of current work session`);
          this.totalWorkTime += elapsedMinutes;
        } else {
          console.log(`RESET TIMER: ${this.name} - Saving ${elapsedMinutes}m of current break session`);
          this.totalBreakTime += elapsedMinutes;
        }
      }
    }
    
    this.pauseTimer(io, roomId);
    this.timerState.mode = 'pomodoro';
    this.timerState.timeLeft = this.settings.pomodoro * 60;
    // Only reset current session timer, keep session history and total times
    this.currentSessionProgress = 0;
    
    // Note: Keep completedSessions, sessionHistory, totalWorkTime and totalBreakTime - they should persist
    console.log(`RESET TIMER: ${this.name} - After reset: totalWorkTime=${this.totalWorkTime}, totalBreakTime=${this.totalBreakTime}`);

    // Broadcast reset to room
    io.to(roomId).emit('user_timer_update', {
      userId: this.id,
      timerState: this.timerState
    });
    
    // Also broadcast full user data to ensure all accumulated data is preserved
    io.to(roomId).emit('user_updated', {
      userId: this.id,
      userData: this.getUserData()
    });
  }

  changeMode(mode, io, roomId) {
    // Save any elapsed time from current session before changing mode
    if (this.timerState.isActive || this.timerState.timeLeft < (this.timerState.mode === 'pomodoro' ? this.settings.pomodoro * 60 : this.settings.break * 60)) {
      const totalTime = this.timerState.mode === 'pomodoro' ? this.settings.pomodoro * 60 : this.settings.break * 60;
      const elapsedTime = totalTime - this.timerState.timeLeft;
      const elapsedMinutes = elapsedTime / 60;
      
      if (elapsedMinutes > 0) {
        if (this.timerState.mode === 'pomodoro') {
          console.log(`CHANGE MODE: ${this.name} - Saving ${elapsedMinutes}m of current work session`);
          this.totalWorkTime += elapsedMinutes;
        } else {
          console.log(`CHANGE MODE: ${this.name} - Saving ${elapsedMinutes}m of current break session`);
          this.totalBreakTime += elapsedMinutes;
        }
      }
    }

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

    // Also broadcast full user data to ensure accumulated times are updated
    io.to(roomId).emit('user_updated', {
      userId: this.id,
      userData: this.getUserData()
    });
  }

  skipToBreak(io, roomId) {
    // Only allow skipping to break when in pomodoro mode
    if (this.timerState.mode !== 'pomodoro') {
      return;
    }

    // Calculate elapsed work time in current session
    const totalPomodoroTime = this.settings.pomodoro * 60;
    const elapsedTime = totalPomodoroTime - this.timerState.timeLeft;
    const elapsedMinutes = elapsedTime / 60;

    console.log(`SKIP TO BREAK: ${this.name} - Adding ${elapsedMinutes}m of partial work to totalWorkTime (was ${this.totalWorkTime})`);
    
    // Add the partial work time to total work time
    this.totalWorkTime += elapsedMinutes;
    
    console.log(`SKIP TO BREAK: ${this.name} - totalWorkTime is now ${this.totalWorkTime}m`);

    // Pause the timer and switch to break mode
    this.pauseTimer(io, roomId);
    this.timerState.mode = 'break';
    this.timerState.timeLeft = this.settings.break * 60;

    // Broadcast the update to include the new totalWorkTime
    io.to(roomId).emit('user_timer_update', {
      userId: this.id,
      timerState: this.timerState
    });

    // Also broadcast full user data to ensure totalWorkTime is updated
    io.to(roomId).emit('user_updated', {
      userId: this.id,
      userData: this.getUserData()
    });
  }

  skipToFocus(io, roomId) {
    // Only allow skipping to focus when in break mode
    if (this.timerState.mode !== 'break') {
      return;
    }

    // Calculate elapsed break time in current session
    const totalBreakTime = this.settings.break * 60;
    const elapsedTime = totalBreakTime - this.timerState.timeLeft;
    const elapsedMinutes = elapsedTime / 60;

    console.log(`SKIP TO FOCUS: ${this.name} - Adding ${elapsedMinutes}m of partial break to totalBreakTime (was ${this.totalBreakTime})`);
    
    // Add the partial break time to total break time
    this.totalBreakTime += elapsedMinutes;
    
    console.log(`SKIP TO FOCUS: ${this.name} - totalBreakTime is now ${this.totalBreakTime}m`);

    // Pause the timer and switch to pomodoro mode
    this.pauseTimer(io, roomId);
    this.timerState.mode = 'pomodoro';
    this.timerState.timeLeft = this.settings.pomodoro * 60;

    // Broadcast the update to include the new totalBreakTime
    io.to(roomId).emit('user_timer_update', {
      userId: this.id,
      timerState: this.timerState
    });

    // Also broadcast full user data to ensure totalBreakTime is updated
    io.to(roomId).emit('user_updated', {
      userId: this.id,
      userData: this.getUserData()
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
    const data = {
      id: this.id,
      name: this.name,
      status: this.status,
      timerState: this.timerState,
      settings: this.settings,
      tasks: this.tasks,
      completedSessions: this.completedSessions,
      sessionHistory: this.sessionHistory,
      currentSessionProgress: this.currentSessionProgress,
      totalWorkTime: this.totalWorkTime,
      totalBreakTime: this.totalBreakTime,
      joinedAt: this.joinedAt,
      lastActivity: this.lastActivity
    };
    console.log(`getUserData for ${this.name}: totalWorkTime=${this.totalWorkTime}, totalBreakTime=${this.totalBreakTime}`);
    return data;
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