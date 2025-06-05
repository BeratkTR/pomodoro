# Pomodoro Backend Server

A Node.js/Express backend with Socket.io for the collaborative Pomodoro timer application.

## Features

- **Real-time collaboration** with Socket.io
- **Room management** for study groups
- **Timer synchronization** across all users in a room
- **User progress tracking** with session counts
- **Settings synchronization** for timer durations
- **Automatic session progression** (Pomodoro → Short Break → Long Break)
- **Offline user handling** with automatic cleanup

## API Endpoints

### Health Check
```
GET /api/health
```
Returns server status and timestamp.

### Rooms
```
GET /api/rooms
```
Get list of all active rooms.

```
POST /api/rooms
```
Create a new room.
**Body:**
```json
{
  "name": "Study Room 1",
  "createdBy": "John Doe"
}
```

## Socket.io Events

### Client → Server Events

| Event | Description | Data |
|-------|-------------|------|
| `join_room` | Join a study room | `{ roomId, user: { id, name } }` |
| `start_timer` | Start the timer | None |
| `pause_timer` | Pause the timer | None |
| `reset_timer` | Reset timer and sessions | None |
| `update_settings` | Update timer settings | `{ pomodoro, shortBreak, longBreak, autoStartBreaks, autoStartPomodoros }` |
| `update_progress` | Update user progress | `{ completedSessions, currentProgress }` |

### Server → Client Events

| Event | Description | Data |
|-------|-------------|------|
| `room_joined` | Confirmation of joining room | `{ room, users }` |
| `user_joined` | Another user joined | `{ user, users }` |
| `user_disconnected` | User left the room | `{ userId, users }` |
| `timer_update` | Timer tick update | `{ timeLeft, mode, session, isActive }` |
| `timer_started` | Timer was started | `{ timeLeft, mode, session }` |
| `timer_paused` | Timer was paused | `{ timeLeft, mode, session }` |
| `timer_reset` | Timer was reset | `{ timeLeft, mode, session, users }` |
| `timer_complete` | Timer finished | `{ mode, timeLeft, session, usersData }` |
| `settings_updated` | Settings were changed | `{ settings, timeLeft, mode }` |
| `users_updated` | User progress updated | `{ users }` |
| `error` | Error occurred | `{ message }` |

## Data Structures

### Room Object
```javascript
{
  id: "uuid",
  name: "Study Room 1",
  createdBy: "John Doe",
  users: Map(), // userId -> user data
  currentSession: 1,
  isActive: false,
  mode: "pomodoro", // "pomodoro" | "shortBreak" | "longBreak"
  timeLeft: 1500, // seconds
  settings: {
    pomodoro: 25,     // minutes
    shortBreak: 5,    // minutes
    longBreak: 15,    // minutes
    autoStartBreaks: false,
    autoStartPomodoros: false
  }
}
```

### User Object
```javascript
{
  id: "user-id",
  name: "John Doe",
  socketId: "socket-id",
  roomId: "room-id",
  joinedAt: Date,
  completedSessions: 0,
  currentSessionProgress: 0, // 0-100
  status: "online" // "online" | "offline"
}
```

## Timer Logic

1. **Pomodoro Session (25 min)** → **Short Break (5 min)**
2. After 4 pomodoro sessions → **Long Break (15 min)**
3. Auto-progression based on settings
4. All users in room see synchronized timer
5. Session completion updates all users' progress

## Installation & Running

```bash
# Install dependencies
npm install

# Development (with auto-restart)
npm run dev

# Production
npm start
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `5000` | Server port |

## Development

The server uses nodemon for development with automatic restarts on file changes.

```bash
npm run dev
```

## Architecture

- **Express.js** for HTTP API
- **Socket.io** for real-time communication
- **In-memory storage** for rooms and users (can be replaced with database)
- **CORS enabled** for frontend development
- **Room-based broadcasting** for efficient updates 