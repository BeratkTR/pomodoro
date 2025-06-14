const config = require('../config');

class User {
  constructor(id, name, socketId) {
    this.id = id;
    this.name = name;
    this.socketId = socketId;
    this.joinedAt = new Date();
    this.lastActivity = Date.now();
    this.status = 'online'; // 'online', 'offline'
    
    // User's timezone (defaults to UTC, will be updated when client connects)
    this.timezone = 'UTC';
    
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
    
    // Accumulated time tracking (in minutes) - current day
    this.totalWorkTime = 0;
    this.totalBreakTime = 0;
    
    // Daily tracking
    this.lastResetDate = this.getCurrentDateString(); // Store the date of last reset
    
    // Historical data - stores data for each day
    this.dailyHistory = {
      // Format: 'YYYY-MM-DD': {
      //   totalWorkTime: number,
      //   totalBreakTime: number, 
      //   completedSessions: number,
      //   sessionHistory: array
      // }
    };
  }

  // Set user's timezone
  setTimezone(timezone) {
    const oldTimezone = this.timezone;
    this.timezone = timezone;
    console.log(`Updated timezone for ${this.name}: ${oldTimezone} -> ${timezone}`);
    
    // Check if we need to reset with the new timezone
    const wasReset = this.checkAndResetDaily();
    return wasReset;
  }

  getCurrentDateString() {
    const now = new Date();
    
    // Use user's timezone to get the correct local date
    try {
      // Create date in user's timezone
      const userDate = new Date(now.toLocaleString("en-US", {timeZone: this.timezone}));
      
      return userDate.getFullYear() + '-' + 
             String(userDate.getMonth() + 1).padStart(2, '0') + '-' + 
             String(userDate.getDate()).padStart(2, '0');
    } catch (error) {
      console.warn(`Invalid timezone ${this.timezone} for user ${this.name}, falling back to UTC`);
      // Fallback to UTC if timezone is invalid
      return now.getFullYear() + '-' + 
             String(now.getMonth() + 1).padStart(2, '0') + '-' + 
             String(now.getDate()).padStart(2, '0');
    }
  }



  // Check if it's a new day and reset daily stats if needed
  checkAndResetDaily() {
    const currentDate = this.getCurrentDateString();
    
    if (this.lastResetDate !== currentDate) {
      console.log(`NEW DAY DETECTED for ${this.name}: Last reset was ${this.lastResetDate}, current date is ${currentDate}`);
      
      // Handle any remaining time from active timer before resetting
      let additionalWorkTime = 0;
      let additionalBreakTime = 0;
      
      if (this.timerState && (this.timerState.isActive || this.timerState.timeLeft < (this.timerState.mode === 'pomodoro' ? this.settings.pomodoro * 60 : this.settings.break * 60))) {
        const totalTime = this.timerState.mode === 'pomodoro' ? this.settings.pomodoro * 60 : this.settings.break * 60;
        const elapsedTime = totalTime - this.timerState.timeLeft;
        const elapsedMinutes = Math.max(0, elapsedTime / 60);
        
        if (elapsedMinutes > 0) {
          if (this.timerState.mode === 'pomodoro') {
            additionalWorkTime = elapsedMinutes;
            console.log(`END OF DAY: ${this.name} - Adding ${elapsedMinutes}m of remaining work time to previous day`);
          } else {
            additionalBreakTime = elapsedMinutes;
            console.log(`END OF DAY: ${this.name} - Adding ${elapsedMinutes}m of remaining break time to previous day`);
          }
          
          // Add partial session to history for the previous day
          this.sessionHistory.push({
            type: this.timerState.mode,
            duration: elapsedMinutes,
            completedAt: Date.now(),
            isPartial: true,
            isEndOfDay: true // Mark as end-of-day partial session
          });
        }
      }
      
      // Save current day's data to history before resetting (including any additional time from active timer)
      if (this.lastResetDate && (this.totalWorkTime + additionalWorkTime > 0 || this.totalBreakTime + additionalBreakTime > 0 || this.completedSessions > 0)) {
        this.dailyHistory[this.lastResetDate] = {
          totalWorkTime: this.totalWorkTime + additionalWorkTime,
          totalBreakTime: this.totalBreakTime + additionalBreakTime,
          completedSessions: this.completedSessions,
          sessionHistory: [...this.sessionHistory] // Make a copy
        };
        console.log(`Saved data for ${this.lastResetDate}: ${this.totalWorkTime + additionalWorkTime}m work, ${this.totalBreakTime + additionalBreakTime}m break, ${this.completedSessions} sessions`);
      }
      
      // Reset timer state when day changes
      if (this.timerState) {
        // Stop any active timer
        this.timerState.isActive = false;
        if (this.timerInterval) {
          clearInterval(this.timerInterval);
          this.timerInterval = null;
        }
        
        // Reset timer to initial state
        this.timerState.mode = 'pomodoro';
        this.timerState.timeLeft = this.settings.pomodoro * 60;
        this.timerState.currentSession = 1;
        console.log(`END OF DAY: ${this.name} - Timer reset to initial state`);
      }
      
      // Reset daily stats
      this.totalWorkTime = 0;
      this.totalBreakTime = 0;
      this.completedSessions = 0;
      this.sessionHistory = [];
      
      // Update last reset date
      this.lastResetDate = currentDate;
      
      console.log(`Daily stats reset for ${this.name} on ${currentDate}`);
      
      return true; // Indicates a reset occurred
    }
    
    return false; // No reset needed
  }

  // Get historical data for a specific date
  getHistoryForDate(dateString) {
    return this.dailyHistory[dateString] || null;
  }

  // Get all historical dates (for showing in UI)
  getHistoricalDates() {
    return Object.keys(this.dailyHistory).sort().reverse(); // Most recent first
  }

  // Get current day stats including any in-progress session
  getCurrentDayStats(includeCurrentSession = true) {
    // First check if we need to reset for a new day
    this.checkAndResetDaily();
    
    let currentSessionTime = 0;
    
    if (includeCurrentSession && this.timerState) {
      const totalTime = this.timerState.mode === 'pomodoro' ? this.settings.pomodoro * 60 : this.settings.break * 60;
      const elapsedSeconds = totalTime - this.timerState.timeLeft;
      const cappedElapsedSeconds = Math.min(elapsedSeconds, totalTime);
      currentSessionTime = Math.max(0, cappedElapsedSeconds / 60);
    }
    
    return {
      totalWorkTime: this.totalWorkTime + (this.timerState?.mode === 'pomodoro' && includeCurrentSession ? currentSessionTime : 0),
      totalBreakTime: this.totalBreakTime + (this.timerState?.mode === 'break' && includeCurrentSession ? currentSessionTime : 0),
      completedSessions: this.completedSessions,
      sessionHistory: this.sessionHistory,
      currentSession: this.timerState?.currentSession || 1
    };
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
    // Check for daily reset before starting timer
    const wasReset = this.checkAndResetDaily();
    if (wasReset) {
      // Broadcast the reset to update clients
      io.to(roomId).emit('user_updated', {
        userId: this.id,
        userData: this.getUserData()
      });
    }

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
      totalBreakTime: this.totalBreakTime,
      wasSkipped: false // Natural completion, not skipped
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
    
    // Only add time and create session if there was actual elapsed time
    if (elapsedMinutes > 0) {
      // Add the partial work time to total work time
      this.totalWorkTime += elapsedMinutes;
      
      // Create session history entry for the partial work session
      const sessionEntry = {
        type: 'pomodoro',
        duration: elapsedMinutes, // Only the actual elapsed time, not the full pomodoro duration
        completedAt: new Date().toISOString(),
        isPartial: true // Mark as partial session
      };
      
      this.sessionHistory.push(sessionEntry);
      
      console.log(`SKIP TO BREAK: ${this.name} - Created partial session entry: ${elapsedMinutes}m work session`);
    }
    
    console.log(`SKIP TO BREAK: ${this.name} - totalWorkTime is now ${this.totalWorkTime}m`);

    // Pause the timer and switch to break mode
    this.pauseTimer(io, roomId);
    this.timerState.mode = 'break';
    this.timerState.timeLeft = this.settings.break * 60;
    this.timerState.currentSession++; // Increment session to allow next skip to create a new bar

    // Broadcast the update to include the new totalWorkTime
    io.to(roomId).emit('user_timer_update', {
      userId: this.id,
      timerState: this.timerState
    });

    // Also broadcast full user data including session history to ensure all data is updated
    io.to(roomId).emit('user_updated', {
      userId: this.id,
      userData: this.getUserData()
    });
    
    // Also emit a timer complete event to ensure session history is properly synced
    if (elapsedMinutes > 0) {
      io.to(roomId).emit('user_timer_complete', {
        userId: this.id,
        timerState: this.timerState,
        completedSessions: this.completedSessions,
        sessionHistory: this.sessionHistory,
        totalWorkTime: this.totalWorkTime,
        totalBreakTime: this.totalBreakTime,
        wasSkipped: true // Manual skip, not natural completion
      });
    }
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
    
    // Only add time and create session if there was actual elapsed time
    if (elapsedMinutes > 0) {
      // Add the partial break time to total break time
      this.totalBreakTime += elapsedMinutes;
      
      // Create session history entry for the partial break session
      const sessionEntry = {
        type: 'break',
        duration: elapsedMinutes, // Only the actual elapsed time, not the full break duration
        completedAt: new Date().toISOString(),
        isPartial: true // Mark as partial session
      };
      
      this.sessionHistory.push(sessionEntry);
      
      console.log(`SKIP TO FOCUS: ${this.name} - Created partial session entry: ${elapsedMinutes}m break session`);
    }
    
    console.log(`SKIP TO FOCUS: ${this.name} - totalBreakTime is now ${this.totalBreakTime}m`);

    // Pause the timer and switch to pomodoro mode
    this.pauseTimer(io, roomId);
    this.timerState.mode = 'pomodoro';
    this.timerState.timeLeft = this.settings.pomodoro * 60;
    this.timerState.currentSession++; // Increment session to allow next skip to create a new bar

    // Broadcast the update to include the new totalBreakTime
    io.to(roomId).emit('user_timer_update', {
      userId: this.id,
      timerState: this.timerState
    });

    // Also broadcast full user data including session history to ensure all data is updated
    io.to(roomId).emit('user_updated', {
      userId: this.id,
      userData: this.getUserData()
    });
    
    // Also emit a timer complete event to ensure session history is properly synced
    if (elapsedMinutes > 0) {
      io.to(roomId).emit('user_timer_complete', {
        userId: this.id,
        timerState: this.timerState,
        completedSessions: this.completedSessions,
        sessionHistory: this.sessionHistory,
        totalWorkTime: this.totalWorkTime,
        totalBreakTime: this.totalBreakTime,
        wasSkipped: true // Manual skip, not natural completion
      });
    }
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
    // Check for daily reset before returning data
    this.checkAndResetDaily();
    
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
      lastActivity: this.lastActivity,
      // Include daily tracking data
      lastResetDate: this.lastResetDate,
      dailyHistory: this.dailyHistory
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

  // Helper method for testing/debugging - manually trigger day reset
  // This can be useful for testing the end-of-day functionality without waiting for midnight
  forceResetDaily(io = null, roomId = null) {
    console.log(`FORCE RESET: ${this.name} - Manually triggering daily reset`);
    
    // Temporarily modify the last reset date to trigger reset
    const originalDate = this.lastResetDate;
    this.lastResetDate = 'force-reset-' + new Date().getTime();
    
    // Call the normal reset logic
    const wasReset = this.checkAndResetDaily();
    
    if (wasReset && io && roomId) {
      // Broadcast the reset to update clients
      io.to(roomId).emit('user_updated', {
        userId: this.id,
        userData: this.getUserData()
      });
      console.log(`FORCE RESET: ${this.name} - Broadcasted reset to room ${roomId}`);
    }
    
    return wasReset;
  }
}

module.exports = User; 