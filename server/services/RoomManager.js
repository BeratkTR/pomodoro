const { Room } = require('../models');

class RoomManager {
  constructor() {
    this.persistenceManager = null;
  }

  setPersistenceManager(persistenceManager) {
    this.persistenceManager = persistenceManager;
  }

  // Load rooms from persistence
  async loadFromPersistence(io, userStore) {
    if (!this.persistenceManager) return new Map();
    
    try {
      const roomsData = await this.persistenceManager.loadRooms();
      const rooms = new Map();
      
      for (const [roomId, roomData] of Object.entries(roomsData)) {
        // Create room instance
        const room = new Room(roomData.id, roomData.name, roomData.createdBy, io);
        
        // Restore room properties
        room.createdAt = new Date(roomData.createdAt);
        room.maxUsers = roomData.maxUsers || 2;
        room.chatHistory = roomData.chatHistory || [];
        
        // Restore users to the room if they exist in userStore
        if (roomData.userIds && Array.isArray(roomData.userIds)) {
          for (const userId of roomData.userIds) {
            const user = userStore.getUser(userId);
            if (user) {
              room.addUser(user);
              console.log(`Restored user ${user.name} to room ${room.name}`);
            }
          }
        }
        
        rooms.set(roomId, room);
        console.log(`Restored room: ${room.name} with ${room.users.size} users`);
      }
      
      console.log(`Loaded ${rooms.size} rooms from persistence`);
      return rooms;
    } catch (error) {
      console.error('Error loading rooms from persistence:', error);
      return new Map();
    }
  }

  // Save rooms to persistence
  async saveToPersistence(rooms) {
    if (!this.persistenceManager) return;
    
    try {
      await this.persistenceManager.saveRooms(rooms);
    } catch (error) {
      console.error('Error saving rooms to persistence:', error);
    }
  }

  // Helper method to create a new room
  createRoom(id, name, createdBy, io) {
    return new Room(id, name, createdBy, io);
  }
}

module.exports = RoomManager; 