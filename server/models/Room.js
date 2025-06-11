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

  // Clean up method to be called when room is destroyed
  cleanup() {
    // Clean up all users' timers
    this.users.forEach(user => {
      user.cleanup();
    });
  }
}

module.exports = Room;  