const User = require('../models/User');

class UserStore {
  constructor() {
    this.persistentUsers = new Map(); // userId -> User instance
  }

  // Get or create a persistent user
  getOrCreateUser(userId, userName, socketId, existingUserData = null) {
    if (this.persistentUsers.has(userId)) {
      const existingUser = this.persistentUsers.get(userId);
      // Update socket connection
      existingUser.socketId = socketId;
      existingUser.status = 'online';
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
    
    // Restore accumulated work and break times
    if (userData.totalWorkTime !== undefined) {
      user.totalWorkTime = userData.totalWorkTime;
    }
    
    if (userData.totalBreakTime !== undefined) {
      user.totalBreakTime = userData.totalBreakTime;
    }
    
    if (userData.timerState) {
      // Restore timer state but always start as paused
      user.timerState = {
        ...userData.timerState,
        isActive: false,
        timeLeft: userData.timerState.mode === 'pomodoro' 
          ? user.settings.pomodoro * 60 
          : user.settings.break * 60
      };
    }
    
    console.log(`Restored user data for ${user.name} - Work: ${user.totalWorkTime}m, Break: ${user.totalBreakTime}m`);
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
      user.socketId = null;
      // Pause timer if active
      if (user.timerState.isActive) {
        user.timerState.isActive = false;
        if (user.timerInterval) {
          clearInterval(user.timerInterval);
          user.timerInterval = null;
        }
      }
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