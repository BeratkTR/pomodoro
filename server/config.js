module.exports = {
  port: process.env.PORT || 5001,
  cors: {
    origin: [
      "http://localhost:5173",
      "https://localhost:5173",
      "http://localhost:5001",
      "http://18.159.206.201:5173",
      "http://18.159.206.201:5001",
    ],
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]
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
      'http://18.159.206.201:5173',
    ],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true
  },
}; 