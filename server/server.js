const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');

const config = require('./config');
const { Room } = require('./models');
const routes = require('./routes');
const adminRoutes = require('./routes/admin');
const { initializeSocketHandlers } = require('./sockets/socketHandlers');
const userStore = require('./services/UserStore');
const PersistenceManager = require('./services/PersistenceManager');
const RoomManager = require('./services/RoomManager');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: config.cors
});

// Middleware
app.use(cors());
app.use(express.json());

// Initialize persistence and managers
const persistenceManager = new PersistenceManager();
const roomManager = new RoomManager();

// Set up persistence connections
userStore.setPersistenceManager(persistenceManager);
roomManager.setPersistenceManager(persistenceManager);

// Data structures to store application state
let rooms = new Map(); // roomId -> room data
const users = new Map(); // socketId -> user data

// Initialize data from persistence
async function initializeData() {
  console.log('Loading data from persistence...');
  
  // Load users first
  await userStore.loadFromPersistence();
  
  // Then load rooms (which may reference users)
  rooms = await roomManager.loadFromPersistence(io, userStore);
  
  console.log('Data initialization complete');
}

// Make rooms, users and io available to routes
app.locals.rooms = rooms;
app.locals.users = users;
app.locals.io = io;

// Routes - Admin routes must be registered BEFORE the main routes
// because main routes has a catch-all 404 handler
app.use('/api/admin', adminRoutes);
app.use('/', routes);

const PORT = config.port;

// Initialize server with persistence
async function startServer() {
  try {
    // Initialize data from persistence
    await initializeData();
    
    // Update app.locals with loaded rooms
    app.locals.rooms = rooms;

// Initialize Socket.io handlers
initializeSocketHandlers(io, rooms, users);

    // Set up auto-save (save every 30 seconds)
    persistenceManager.setupAutoSave(rooms, userStore, 30000);
    
    // Set up frequent timer state saving (save every 10 seconds for active timers)
    persistenceManager.setupTimerStateSave(rooms, userStore, 10000);
    
    // Set up graceful shutdown
    process.on('SIGINT', async () => {
      console.log('\nReceived SIGINT, saving data and shutting down gracefully...');
      await persistenceManager.saveAll(rooms, userStore);
      console.log('Data saved successfully');
      process.exit(0);
    });
    
    process.on('SIGTERM', async () => {
      console.log('\nReceived SIGTERM, saving data and shutting down gracefully...');
      await persistenceManager.saveAll(rooms, userStore);
      console.log('Data saved successfully');
      process.exit(0);
    });

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
  console.log(`Server accessible at http://18.193.112.244:${PORT}`);
  console.log(`Socket.io server ready for connections`);
      console.log('Persistence system active - data will be saved automatically');
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
