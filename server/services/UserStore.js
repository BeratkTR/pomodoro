const User = require('../models/User');
const TimerStateRecovery = require('./TimerStateRecovery');

class UserStore {
  constructor() {
    this.persistentUsers = new Map(); // userId -> User instance
    this.persistenceManager = null; // Will be set by server
  }

  setPersistenceManager(persistenceManager) {
    this.persistenceManager = persistenceManager;
  }

  // Load users from persistence
  async loadFromPersistence() {
    if (!this.persistenceManager) return;
    
    try {
      const usersData = await this.persistenceManager.loadUsers();
      
      const recoveredUsers = [];
      
      for (const [userId, userData] of Object.entries(usersData)) {
        // Create user instance without socket connection (offline)
        const user = new User(userData.id, userData.name, null, userData.email, userData.passwordHash);
        
        // Restore all user data
        this.restoreUserData(user, userData);
        
        // Attempt timer state recovery
        const recoveryInfo = TimerStateRecovery.recoverTimerState(user, userData);
        user.recoveryInfo = recoveryInfo;
        
        if (recoveryInfo.recovered) {
          recoveredUsers.push(user);
          console.log(`Timer recovery for ${user.name}: ${recoveryInfo.message}`);
        }
        
        // Set as offline
        user.status = 'offline';
        user.socketId = null;
        
        this.persistentUsers.set(userId, user);
      }
      
      // Generate and log recovery report
      if (recoveredUsers.length > 0) {
        const report = TimerStateRecovery.generateRecoveryReport(recoveredUsers);
        console.log('Timer Recovery Report:', JSON.stringify(report, null, 2));
      }
      
      console.log(`Loaded ${Object.keys(usersData).length} users from persistence`);
    } catch (error) {
      console.error('Error loading users from persistence:', error);
    }
  }

  // Save users to persistence
  async saveToPersistence() {
    if (!this.persistentUsers || !this.persistenceManager) return;
    
    try {
      await this.persistenceManager.saveUsers(this);
    } catch (error) {
      console.error('Error saving users to persistence:', error);
    }
  }

  // Find user by email
  findUserByEmail(email) {
    for (const user of this.persistentUsers.values()) {
      if (user.email === email) {
        return user;
      }
    }
    return null;
  }

  // Get or create a persistent user
  getOrCreateUser(userId, userName, socketId, existingUserData = null) {
    if (this.persistentUsers.has(userId)) {
      const existingUser = this.persistentUsers.get(userId);
      // Update socket connection
      existingUser.socketId = socketId;
      existingUser.status = 'online';
      existingUser.lastActivity = Date.now(); // Update activity when coming online
      console.log(`Retrieved persistent user: ${existingUser.name}`);
      return existingUser;
    }

    // Create new user
    const newUser = new User(userId, userName, socketId);
    
    // If we have existing data (from localStorage), restore it
    if (existingUserData) {
      this.restoreUserData(newUser, existingUserData);
    }
    
    this.persistentUsers.set(userId, newUser);
    console.log(`Created new persistent user: ${newUser.name}`);
    return newUser;
  }

  // Restore user data from previous session
  restoreUserData(user, userData) {
    if (userData.settings) {
      user.settings = { ...user.settings, ...userData.settings };
    }
    
    if (userData.tasks) {
      user.tasks = userData.tasks;
    }
    
    if (userData.completedSessions !== undefined) {
      user.completedSessions = userData.completedSessions;
    }
    
    if (userData.sessionHistory) {
      user.sessionHistory = userData.sessionHistory;
    }
    
    if (userData.currentSessionNotes !== undefined) {
      user.currentSessionNotes = userData.currentSessionNotes;
    }
    
    // Restore accumulated work and break times
    if (userData.totalWorkTime !== undefined) {
      user.totalWorkTime = userData.totalWorkTime;
    }
    
    if (userData.totalBreakTime !== undefined) {
      user.totalBreakTime = userData.totalBreakTime;
    }
    
    // Restore daily tracking data
    if (userData.lastResetDate !== undefined) {
      user.lastResetDate = userData.lastResetDate;
    }
    
    if (userData.dailyHistory !== undefined) {
      user.dailyHistory = userData.dailyHistory || {};
    }
    
    // Restore timezone information
    if (userData.timezone) {
      user.timezone = userData.timezone;
    }
    
    // Restore authentication information
    if (userData.email !== undefined) {
      user.email = userData.email;
    }
    
    if (userData.passwordHash !== undefined) {
      user.passwordHash = userData.passwordHash;
    }
    
    if (userData.isAuthenticated !== undefined) {
      user.isAuthenticated = userData.isAuthenticated;
    }
    
    // Ensure isAuthenticated is correctly set based on email presence
    if (user.email && user.passwordHash) {
      user.isAuthenticated = true;
    }
    
    // Restore room persistence information
    if (userData.lastRoomId !== undefined) {
      user.lastRoomId = userData.lastRoomId;
    }
    
    if (userData.lastRoomName !== undefined) {
      user.lastRoomName = userData.lastRoomName;
    }
    
    // Restore lastActivity if available
    if (userData.lastActivity !== undefined) {
      user.lastActivity = userData.lastActivity;
    }
    
    if (userData.timerState) {
      // Restore timer state with exact time remaining but always start as paused
      user.timerState = {
        ...userData.timerState,
        isActive: false // Always restore as paused to prevent ghost timers
        // Preserve timeLeft from saved state to restore exact progress
      };
      
      // If timeLeft is invalid or missing, reset to full session time
      if (typeof user.timerState.timeLeft !== 'number' || 
          user.timerState.timeLeft < 0 || 
          user.timerState.timeLeft > (user.timerState.mode === 'pomodoro' ? user.settings.pomodoro * 60 : user.settings.break * 60)) {
        user.timerState.timeLeft = user.timerState.mode === 'pomodoro' 
          ? user.settings.pomodoro * 60 
          : user.settings.break * 60;
      }
    }
    
    // After restoring, check if we need to reset for a new day, but don't reset active timers
    const wasReset = user.checkAndResetDaily(false);
    if (wasReset) {
      console.log(`Daily reset occurred during restoration for ${user.name}`);
    }
    
    console.log(`Restored user data for ${user.name} - Work: ${user.totalWorkTime}m, Break: ${user.totalBreakTime}m, Timezone: ${user.timezone}`);
  }

  // Update user in persistent store
  updateUser(userId, userData) {
    if (this.persistentUsers.has(userId)) {
      const user = this.persistentUsers.get(userId);
      // Update with new data while preserving the User instance
      Object.assign(user, userData);
    }
  }

  // Mark user as offline but keep their data
  setUserOffline(userId) {
    if (this.persistentUsers.has(userId)) {
      const user = this.persistentUsers.get(userId);
      user.status = 'offline';
      user.lastActivity = Date.now(); // Update last activity time when going offline
      user.socketId = null;
      // DON'T pause timer on disconnect - let it keep running
      // Timer will be handled by the room system and persistence
      console.log(`User ${user.name} went offline, but keeping timer state intact`);
    }
  }

  // Get user by ID
  getUser(userId) {
    return this.persistentUsers.get(userId);
  }

  // Remove user completely (for cleanup)
  removeUser(userId) {
    const user = this.persistentUsers.get(userId);
    if (user) {
      user.cleanup();
      this.persistentUsers.delete(userId);
      console.log(`Removed persistent user: ${user.name}`);
    }
  }

  // Clean up inactive users (optional, for memory management)
  cleanupInactiveUsers(inactiveThresholdMs = 24 * 60 * 60 * 1000) { // 24 hours
    const now = Date.now();
    for (const [userId, user] of this.persistentUsers) {
      if (user.status === 'offline' && 
          (now - user.lastActivity) > inactiveThresholdMs) {
        this.removeUser(userId);
      }
    }
  }
}

// Singleton instance
const userStore = new UserStore();
module.exports = userStore; 