# Persistence System Documentation

The Pomodoro app now includes a comprehensive persistence system that automatically saves and restores all application data when the server is restarted.

## Overview

The persistence system saves the following data:
- **User Data**: Timer states, settings, tasks, session history, daily statistics
- **Room Data**: Room details, user associations, chat history
- **Session Data**: Active timers, completed sessions, work/break time tracking

## How It Works

### 1. Automatic Data Loading
When the server starts, it automatically:
- Loads all user data from `data/users.json`
- Loads all room data from `data/rooms.json`
- Restores user-room associations
- Preserves chat history and session statistics

### 2. Real-time Data Saving
The system automatically saves data when:
- Users join or leave rooms
- Tasks are added, updated, or deleted
- Settings are changed
- Chat messages are sent
- Timer sessions are completed
- User names are updated

### 3. Scheduled Auto-Save
- Data is automatically saved every 30 seconds
- Manual saves are triggered after important user actions
- All saves use a debounced mechanism to prevent excessive disk writes

### 4. Graceful Shutdown
When the server receives SIGINT or SIGTERM signals:
- All data is immediately saved to disk
- Server waits for save completion before shutting down

### 5. Timer State Recovery
When the server starts after a sudden stop (crash, power loss):
- Detects gaps in save timestamps to identify potential downtime
- Estimates elapsed time during server downtime for active timers
- Adjusts timer states conservatively (assumes timer ran for 50% of downtime)
- Automatically completes sessions that would have finished during downtime
- Provides detailed recovery reports

## File Structure

```
data/                        # Persistence data directory (auto-created)
├── rooms.json              # Room data and chat history
└── users.json              # User data and statistics
server/
├── services/
│   ├── PersistenceManager.js   # Main persistence logic
│   ├── UserStore.js           # Enhanced with persistence
│   └── RoomManager.js         # Room persistence handling
└── scripts/
    └── test-persistence.js    # Test script for persistence
├── services/
│   └── TimerStateRecovery.js  # Timer recovery after server crashes
```

## Data Format

### Users Data (`users.json`)
```json
{
  "user_id": {
    "id": "user_id",
    "name": "User Name",
    "joinedAt": "2024-01-01T00:00:00.000Z",
    "lastActivity": 1704067200000,
    "status": "offline",
    "timerState": {
      "timeLeft": 1500,
      "mode": "pomodoro",
      "isActive": false,
      "currentSession": 1
    },
    "settings": {
      "pomodoro": 25,
      "break": 5,
      "autoStartBreaks": false,
      "autoStartPomodoros": false
    },
    "tasks": [],
    "completedSessions": 0,
    "sessionHistory": [],
    "totalWorkTime": 0,
    "totalBreakTime": 0,
    "lastResetDate": "2024-01-01",
    "dailyHistory": {}
  }
}
```

### Rooms Data (`rooms.json`)
```json
{
  "room_id": {
    "id": "room_id",
    "name": "Room Name",
    "createdBy": "creator_user_id",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "maxUsers": 2,
    "chatHistory": [],
    "userIds": ["user1", "user2"]
  }
}
```

## Admin API Endpoints

### Check Persistence Status
```bash
curl -H "x-admin: true" http://localhost:3001/api/admin/persistence/status
```

### Manual Save
```bash
curl -X POST -H "x-admin: true" http://localhost:3001/api/admin/persistence/save
```

### Cleanup Old Data
```bash
curl -X POST -H "x-admin: true" -H "Content-Type: application/json" \
  -d '{"daysToKeep": 30}' \
  http://localhost:3001/api/admin/persistence/cleanup
```

### Check Timer Recovery Information
```bash
curl -H "x-admin: true" http://localhost:3001/api/admin/persistence/recovery
```

## Testing the System

### Option 1: Use the Test Script
```bash
cd server
npm install  # Install axios dependency
npm run test-persistence
```

### Option 2: Manual Testing
1. Start the server
2. Create some rooms and users
3. Add tasks, send messages, complete timer sessions
4. Stop the server with Ctrl+C
5. Restart the server
6. Verify all data is restored

## Configuration

The persistence system can be configured in `server.js`:

```javascript
// Auto-save interval (default: 30 seconds)
persistenceManager.setupAutoSave(rooms, userStore, 30000);

// Enhanced timer state saving (default: 10 seconds for active timers)
persistenceManager.setupTimerStateSave(rooms, userStore, 10000);

// Debounce delay for triggered saves (default: 5 seconds, 1 second for timer changes)
triggerPersistenceSave(rooms, userStore, 5000);
```

Timer recovery can be configured in `TimerStateRecovery.js`:

```javascript
// Maximum gap before assuming server downtime (default: 2 minutes)
const maxGapThreshold = 120;

// Conservative estimation factor (default: 50% of downtime)
const estimatedRunTime = Math.min(timeSinceLastSave * 0.5, user.timerState.timeLeft);
```

## Data Integrity

- All timer states are saved as inactive to prevent ghost timers
- User-room associations are properly maintained
- Chat history is limited to last 100 messages per room
- Daily statistics are preserved with proper date handling
- Old historical data can be cleaned up automatically

## Troubleshooting

### Data Not Persisting
1. Check if `data/` directory is writable
2. Look for error messages in server logs
3. Verify no file permission issues
4. Use the test script to diagnose issues

### Performance Concerns
- Auto-save is debounced to prevent excessive writes
- Large datasets are handled efficiently with streaming JSON
- Old data cleanup prevents unlimited growth

### Recovery
If data files become corrupted:
1. Stop the server
2. Backup/remove corrupted files
3. Restart the server (it will create fresh files)
4. Data will be rebuilt as users reconnect

## Best Practices

1. **Backup**: Regularly backup the `data/` directory
2. **Monitoring**: Monitor server logs for persistence errors  
3. **Cleanup**: Run periodic cleanup to remove old historical data
4. **Testing**: Test persistence after major changes using the test script
5. **Graceful Shutdown**: Always use Ctrl+C to stop the server for proper data saving 