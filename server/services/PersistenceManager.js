const fs = require('fs').promises;
const path = require('path');

class PersistenceManager {
  constructor() {
    this.dataDir = path.join(__dirname, '..', '..', 'data');
    this.roomsFile = path.join(this.dataDir, 'rooms.json');
    this.usersFile = path.join(this.dataDir, 'users.json');
    this.ensureDataDirectory();
  }

  async ensureDataDirectory() {
    try {
      await fs.access(this.dataDir);
    } catch (error) {
      await fs.mkdir(this.dataDir, { recursive: true });
      console.log('Created data directory for persistence');
    }
  }

  // Save rooms data
  async saveRooms(rooms) {
    try {
      const roomsData = {};
      
      for (const [roomId, room] of rooms.entries()) {
        roomsData[roomId] = {
          id: room.id,
          name: room.name,
          createdBy: room.createdBy,
          createdAt: room.createdAt,
          maxUsers: room.maxUsers,
          chatHistory: room.chatHistory || [],
          // Save user IDs that belong to this room
          userIds: Array.from(room.users.keys())
        };
      }
      
      await fs.writeFile(this.roomsFile, JSON.stringify(roomsData, null, 2));
      console.log(`Saved ${Object.keys(roomsData).length} rooms to persistence`);
    } catch (error) {
      console.error('Error saving rooms:', error);
    }
  }

  // Load rooms data
  async loadRooms() {
    try {
      const data = await fs.readFile(this.roomsFile, 'utf8');
      const roomsData = JSON.parse(data);
      console.log(`Loaded ${Object.keys(roomsData).length} rooms from persistence`);
      return roomsData;
    } catch (error) {
      if (error.code === 'ENOENT') {
        console.log('No existing rooms data found, starting fresh');
        return {};
      }
      console.error('Error loading rooms:', error);
      return {};
    }
  }

  // Save users data (from UserStore)
  async saveUsers(userStore) {
    try {
      const usersData = {};
      
      for (const [userId, user] of userStore.persistentUsers.entries()) {
        usersData[userId] = {
          id: user.id,
          name: user.name,
          joinedAt: user.joinedAt,
          lastActivity: user.lastActivity,
          status: user.status,
          timerState: {
            timeLeft: user.timerState.timeLeft, // Save exact time remaining
            mode: user.timerState.mode,
            isActive: false, // Always save as inactive to prevent ghost timers
            currentSession: user.timerState.currentSession,
            // Save timestamp to calculate elapsed time if needed
            lastSaveTime: Date.now()
          },
          settings: user.settings,
          tasks: user.tasks,
          completedSessions: user.completedSessions,
          currentSessionProgress: user.currentSessionProgress,
          sessionHistory: user.sessionHistory,
          totalWorkTime: user.totalWorkTime,
          totalBreakTime: user.totalBreakTime,
          lastResetDate: user.lastResetDate,
          dailyHistory: user.dailyHistory
        };
      }
      
      await fs.writeFile(this.usersFile, JSON.stringify(usersData, null, 2));
      console.log(`Saved ${Object.keys(usersData).length} users to persistence`);
    } catch (error) {
      console.error('Error saving users:', error);
    }
  }

  // Load users data
  async loadUsers() {
    try {
      const data = await fs.readFile(this.usersFile, 'utf8');
      const usersData = JSON.parse(data);
      console.log(`Loaded ${Object.keys(usersData).length} users from persistence`);
      return usersData;
    } catch (error) {
      if (error.code === 'ENOENT') {
        console.log('No existing users data found, starting fresh');
        return {};
      }
      console.error('Error loading users:', error);
      return {};
    }
  }

  // Auto-save functionality with debouncing
  setupAutoSave(rooms, userStore, intervalMs = 30000) { // Save every 30 seconds
    setInterval(async () => {
      await this.saveRooms(rooms);
      await this.saveUsers(userStore);
    }, intervalMs);
    
    console.log(`Auto-save enabled: saving data every ${intervalMs/1000} seconds`);
  }

  // Enhanced auto-save for active timer states
  setupTimerStateSave(rooms, userStore, intervalMs = 10000) { // Save every 10 seconds
    setInterval(async () => {
      // Only save if there are active timers
      let hasActiveTimers = false;
      
      for (const [userId, user] of userStore.persistentUsers) {
        if (user.timerState && user.timerState.isActive) {
          hasActiveTimers = true;
          break;
        }
      }
      
      if (hasActiveTimers) {
        try {
          await this.saveUsers(userStore);
          console.log('Saved timer states for active sessions');
        } catch (error) {
          console.error('Error saving timer states:', error);
        }
      }
    }, intervalMs);
    
    console.log(`Timer state auto-save enabled: saving active timers every ${intervalMs/1000} seconds`);
  }

  // Manual save method
  async saveAll(rooms, userStore) {
    await Promise.all([
      this.saveRooms(rooms),
      this.saveUsers(userStore)
    ]);
  }

  // Cleanup old data (optional)
  async cleanupOldData(daysToKeep = 30) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
      
      // Load users and clean up old daily history
      const usersData = await this.loadUsers();
      let cleaned = false;
      
      for (const userId in usersData) {
        const user = usersData[userId];
        if (user.dailyHistory) {
          const originalSize = Object.keys(user.dailyHistory).length;
          
          for (const dateString in user.dailyHistory) {
            const date = new Date(dateString);
            if (date < cutoffDate) {
              delete user.dailyHistory[dateString];
              cleaned = true;
            }
          }
          
          const newSize = Object.keys(user.dailyHistory).length;
          if (originalSize !== newSize) {
            console.log(`Cleaned ${originalSize - newSize} old history entries for user ${user.name}`);
          }
        }
      }
      
      if (cleaned) {
        await fs.writeFile(this.usersFile, JSON.stringify(usersData, null, 2));
        console.log('Cleanup completed');
      }
    } catch (error) {
      console.error('Error during cleanup:', error);
    }
  }

  // Check if persistence files exist
  async hasPersistentData() {
    try {
      await fs.access(this.roomsFile);
      await fs.access(this.usersFile);
      return true;
    } catch {
      return false;
    }
  }
}

module.exports = PersistenceManager; 