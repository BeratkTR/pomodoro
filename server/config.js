module.exports = {
  port: process.env.PORT || 5001,
  cors: {
    origin: [
      "http://18.193.112.244:80",
      "http://18.193.112.244"
    ],
    methods: ["GET", "POST"]
  },
  timer: {
    // Default timer settings (in minutes)
    defaultPomodoro: 50,
    defaultBreak: 10,
    // Auto-start settings
    defaultAutoStartBreaks: false,
    defaultAutoStartPomodoros: false
  },
  room: {
    // Room cleanup settings
    inactiveRoomCleanupDelay: 5 * 60 * 1000, // 5 minutes
    autoStartDelay: 2000 // 2 seconds delay for auto-start
  },
  corsOptions: {
    origin: [
      'http://localhost:5173',
      'http://18.193.112.244:80',
      'http://18.193.112.244'
    ],
    methods: ['GET', 'POST'],
    credentials: true
  },
}; 