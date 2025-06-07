import React, { useState, useEffect, useRef } from 'react'
import Navbar from './components/Navbar'
import TimerSection from './components/TimerSection'
import StudyPartners from './components/StudyPartners'
import RoomJoinModal from './components/RoomJoinModal'
// import SoundPermissionModal from './components/SoundPermissionModal'
import TaskList from './components/TaskList'
import ChatWidget from './components/ChatWidget'
import socketService from './services/socketService'
import apiService from './services/apiService'
import soundService from './services/soundService'
import { setupSocketListeners, cleanupSocketListeners } from './utils/socketListeners'
import useWakeLock from './utils/useWakeLock'
import faviconManager from './utils/faviconManager'
import './App.css'

function App() {
  // Initialize user state from localStorage
  const getStoredUserData = () => {
    const storedName = localStorage.getItem('username');
    let storedUserId = localStorage.getItem('userId');
    const storedRoomId = localStorage.getItem('currentRoomId');
    const storedRoomName = localStorage.getItem('currentRoomName');
    
    // Generate a unique user ID if none exists
    if (!storedUserId) {
      storedUserId = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('userId', storedUserId);
    }
    
    return {
      id: storedUserId,
      name: storedName || '',
      currentRoomId: storedRoomId,
      currentRoomName: storedRoomName,
      timerState: {
        timeLeft: 25 * 60,
        mode: 'pomodoro',
        isActive: false,
        currentSession: 1
      },
          settings: {
      pomodoro: 50,
      break: 10,
      autoStartBreaks: false,
      autoStartPomodoros: false
    },
      tasks: [],
      completedSessions: 0
    };
  };

  // Prompt for name if not available
  useEffect(() => {
    const storedName = localStorage.getItem('username');
    if (!storedName) {
      const name = prompt('Please enter your name');
      if (name) {
        localStorage.setItem('username', name);
      }
    }
  }, []);

  // Room state
  const [isConnected, setIsConnected] = useState(false)
  const [currentRoom, setCurrentRoom] = useState(null)
  const [roomUsers, setRoomUsers] = useState([])
  const [showRoomModal, setShowRoomModal] = useState(true)
  const [connectionError, setConnectionError] = useState(null)
  const [isReconnecting, setIsReconnecting] = useState(false)

  // User state
  const [currentUser, setCurrentUser] = useState(getStoredUserData())

  // Update ref whenever currentUser changes
  useEffect(() => {
    currentUserRef.current = currentUser
  }, [currentUser])

  // Chat state
  const [chatMessages, setChatMessages] = useState([])
  const [isChatOpen, setIsChatOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const isChatOpenRef = useRef(false)
  const isReconnectingRef = useRef(false)
  const currentUserRef = useRef(currentUser)

  // Sound permission state (hidden for now)
  // const [showSoundPermissionModal, setShowSoundPermissionModal] = useState(false)

  // Wake lock to prevent laptop from sleeping when timer is active
  const { isSupported: isWakeLockSupported, isWakeLockActive } = useWakeLock(currentUser.timerState?.isActive || false);

  // Update favicon whenever timer state changes
  useEffect(() => {
    if (currentUser.timerState && currentUser.settings) {
      faviconManager.updateFavicon(currentUser.timerState, currentUser.settings);
    }
  }, [currentUser.timerState, currentUser.settings]);

  // Initialize favicon on mount
  useEffect(() => {
    faviconManager.setStaticFavicon();
  }, []);

  // Save user data to localStorage whenever it changes
  useEffect(() => {
    if (currentUser.id) {
      localStorage.setItem('userId', currentUser.id);
    }
    if (currentUser.name) {
      localStorage.setItem('username', currentUser.name);
    }
  }, [currentUser.id, currentUser.name]);

  // Initialize socket connection
  useEffect(() => {
    const initializeConnection = async () => {
      try {
        await socketService.connect()
        setIsConnected(true)
        setConnectionError(null)
        
        // Make sound service available for debugging
        window.soundService = soundService
        
        // Set up socket event listeners
        setupSocketListeners(
          setCurrentRoom,
          setRoomUsers,
          setCurrentUser,
          setConnectionError,
          setShowRoomModal,
          setIsReconnecting,
          setChatMessages,
          setUnreadCount,
          isChatOpenRef,
          isReconnectingRef,
          () => currentUserRef.current // Function to get current user
          // Note: permission modal check commented out for now
          // () => { // Function to check permission modal
          //   if (Notification.permission === 'denied' && !showSoundPermissionModal && currentRoom) {
          //     setShowSoundPermissionModal(true)
          //   }
          // }
        )

        // Check if we should auto-reconnect to a room
        const storedRoomId = localStorage.getItem('currentRoomId');
        const storedUserId = localStorage.getItem('userId');
        const storedUserName = localStorage.getItem('username');

        if (storedRoomId && storedUserId && storedUserName) {
          setIsReconnecting(true);
          isReconnectingRef.current = true;
          setShowRoomModal(false);
          
          // Try to reconnect to the stored room
          setTimeout(() => {
            socketService.joinRoom(storedRoomId, {
              id: storedUserId,
              name: storedUserName
            }, true); // true indicates this is a reconnection
          }, 500);

          // Set a timeout to handle failed reconnection
          setTimeout(() => {
            // If still reconnecting after 5 seconds, something went wrong
            if (isReconnectingRef.current) {
              console.log('Reconnection timeout, clearing stored data')
              localStorage.removeItem('currentRoomId')
              localStorage.removeItem('currentRoomName')
              setIsReconnecting(false)
              isReconnectingRef.current = false
              setShowRoomModal(true)
              setConnectionError(null)
            }
          }, 5000);
        }
        
      } catch (error) {
        console.error('Failed to connect to server:', error)
        setConnectionError('Failed to connect to server. Please try again.')
        setIsConnected(false)
      }
    }

    initializeConnection()

    return () => {
      cleanupSocketListeners()
      socketService.disconnect()
    }
  }, [])

  const handleJoinRoom = async (roomData) => {
    try {
      const userId = currentUser.id || socketService.getSocketId() || Date.now().toString();
      const user = {
        ...currentUser,
        id: userId,
        name: roomData.userName
      }
      
      setCurrentUser(prev => ({ ...prev, ...user }))
      
      let roomId;
      if (roomData.roomId) {
        // Join existing room
        roomId = roomData.roomId;
      } else {
        // Create new room
        const newRoom = await apiService.createRoom(roomData.roomName, user.name)
        roomId = newRoom.id;
      }

      // Store room and user info for persistence
      localStorage.setItem('currentRoomId', roomId);
      localStorage.setItem('currentRoomName', roomData.roomName || 'Study Room');
      localStorage.setItem('userId', userId);
      localStorage.setItem('username', user.name);

      // Pass current user data to preserve settings, tasks, and timer state across room changes
      const existingUserData = currentUser.id && currentUser.id !== userId ? {
        settings: currentUser.settings,
        tasks: currentUser.tasks,
        completedSessions: currentUser.completedSessions,
        timerState: currentUser.timerState
      } : null;

      socketService.joinRoom(roomId, user, false, existingUserData);
      
    } catch (error) {
      console.error('Failed to join room:', error)
      setConnectionError('Failed to join room. Please try again.')
    }
  }

  const handleLeaveRoom = () => {
    // Clear stored room data
    localStorage.removeItem('currentRoomId');
    localStorage.removeItem('currentRoomName');
    
    // Emit leave room event to server
    socketService.leaveRoom();
    
    // Reset UI state
    setCurrentRoom(null)
    setRoomUsers([])
    setShowRoomModal(true)
    setIsReconnecting(false)
    
    // Reset chat state
    setChatMessages([])
    setIsChatOpen(false)
    setUnreadCount(0)
    
    // Reset user state
    setCurrentUser(prev => ({
      ...prev,
      timerState: {
        timeLeft: 25 * 60,
        mode: 'pomodoro',
        isActive: false,
        currentSession: 1
      },
      tasks: [],
      completedSessions: 0,
      sessionHistory: []
    }))
  }

  // Timer control functions - now for individual user
  const handleStartTimer = () => {
    socketService.startTimer()
  }

  const handlePauseTimer = () => {
    socketService.pauseTimer()
  }

  const handleResetTimer = () => {
    socketService.resetTimer()
  }

  const handleModeChange = (mode) => {
    socketService.changeMode(mode)
  }

  const handleSkipToBreak = () => {
    socketService.skipToBreak()
  }

  const handleSkipToFocus = () => {
    socketService.skipToFocus()
  }

  // Settings update function - now for individual user
  const handleUpdateSettings = (newSettings) => {
    socketService.updateSettings(newSettings)
  }

  const handleUpdateUserName = (newName) => {
    socketService.updateUserName(newName)
  }

  // Task management functions
  const handleAddTask = (taskText) => {
    socketService.addTask({ text: taskText })
  }

  const handleUpdateTask = (taskId, updates) => {
    socketService.updateTask({ taskId, updates })
  }

  const handleDeleteTask = (taskId) => {
    socketService.deleteTask({ taskId })
  }

  // Chat functions
  const handleToggleChat = () => {
    setIsChatOpen(prev => {
      const newState = !prev
      isChatOpenRef.current = newState
      if (newState) {
        // Reset unread count when opening chat
        setUnreadCount(0)
      }
      return newState
    })
  }

  const handleSendMessage = (messageText) => {
    socketService.sendMessage(messageText)
  }

  const handleMarkAsRead = () => {
    setUnreadCount(0)
  }

  // Debug function to clear localStorage (can be called from browser console)
  window.clearPomodoroStorage = () => {
    localStorage.removeItem('currentRoomId')
    localStorage.removeItem('currentRoomName')
    localStorage.removeItem('userId')
    localStorage.removeItem('username')
    console.log('Pomodoro localStorage cleared')
    window.location.reload()
  }

  // Request notification permission (without modal for now)
  useEffect(() => {
    const checkNotificationPermission = async () => {
      // Only check after user is connected and has joined a room
      if (isConnected && currentRoom && !showRoomModal) {
        if (Notification.permission === 'default') {
          await Notification.requestPermission()
          // Note: modal logic commented out for now
          // if (permission === 'denied') {
          //   setShowSoundPermissionModal(true)
          // }
        }
        // Note: always show modal logic commented out for now
        // else if (Notification.permission === 'denied') {
        //   setShowSoundPermissionModal(true)
        // }
      }
    }

    checkNotificationPermission()
  }, [isConnected, currentRoom, showRoomModal])

  // Sound permission modal functionality (commented out for now)
  /*
  // Check for notification permission on important events
  const checkAndShowPermissionModal = () => {
    if (Notification.permission === 'denied' && !showSoundPermissionModal && currentRoom) {
      setShowSoundPermissionModal(true)
    }
  }

  // Periodic check for notification permission (less frequent)
  useEffect(() => {
    if (!currentRoom || showRoomModal) return

    const intervalId = setInterval(() => {
      checkAndShowPermissionModal()
    }, 120000) // Check every 2 minutes

    return () => clearInterval(intervalId)
  }, [currentRoom, showRoomModal, showSoundPermissionModal])

  // Sound permission modal handlers
  const handleCloseSoundModal = () => {
    setShowSoundPermissionModal(false)
  }

  const handleRetrySoundPermission = () => {
    // Provide instructions for manual permission grant
    alert('Please click the lock icon in your browser address bar and set Notifications to "Allow", then refresh the page.')
    setShowSoundPermissionModal(false)
  }
  */

  if (!isConnected && !connectionError) {
    return (
      <div className="app">
        <div className="loading-screen">
          <h2>Connecting to server...</h2>
        </div>
      </div>
    )
  }

  if (connectionError) {
    return (
      <div className="app">
        <div className="error-screen">
          <h2>Connection Error</h2>
          <p>{connectionError}</p>
          <button onClick={() => window.location.reload()}>Retry</button>
        </div>
      </div>
    )
  }

  if (isReconnecting) {
    return (
      <div className="app">
        <div className="loading-screen">
          <h2>Reconnecting to your study session...</h2>
          <p>Getting back to where you left off</p>
        </div>
      </div>
    )
  }

  return (
    <div className="app">
      <Navbar 
        setPomodoroSettings={handleUpdateSettings}
        currentRoom={currentRoom}
        onLeaveRoom={handleLeaveRoom}
        userName={currentUser.name}
        currentSettings={currentUser.settings}
        onUpdateUserName={handleUpdateUserName}
        currentUser={currentUser}
      />
      
            <div className={`main-container ${roomUsers.find(user => user.id !== currentUser.id) ? 'with-partner' : 'solo'}`}>
        {/* User's own tasks on the left */}
        <TaskList 
          tasks={currentUser.tasks}
          onAddTask={handleAddTask}
          onUpdateTask={handleUpdateTask}
          onDeleteTask={handleDeleteTask}
          position="left"
          userName={currentUser.name}
        />
        
        <div className="timer-and-partner-section">
          <TimerSection 
            timerState={currentUser.timerState}
            settings={currentUser.settings} 
            onStart={handleStartTimer}
            onPause={handlePauseTimer}
            onReset={handleResetTimer}
            onModeChange={handleModeChange}
            onSkipToBreak={handleSkipToBreak}
            onSkipToFocus={handleSkipToFocus}
            currentUser={currentUser}
          />
          
          <StudyPartners 
            users={roomUsers}
            currentUserId={currentUser.id}
            currentUser={currentUser}
            currentRoom={currentRoom}
          />
        </div>
        
        {/* Partner's tasks on the right */}
        {roomUsers.find(user => user.id !== currentUser.id) ? (
          <TaskList 
            tasks={roomUsers.find(user => user.id !== currentUser.id).tasks || []}
            position="right"
            userName={roomUsers.find(user => user.id !== currentUser.id).name}
            onAddTask={() => {}} // Read-only for partner
            onUpdateTask={() => {}} // Read-only for partner
            onDeleteTask={() => {}} // Read-only for partner
            readOnly={true}
          />
        ) : (
          <div className="task-list right">
            <div className="waiting-message">
              <h4>🎯 Waiting for Study Partner</h4>
              <p>Share your room ID to invite someone to join your study session!</p>
              <div className="room-id-display">
                <span className="room-id-label">Room ID:</span>
                <span className="room-id">{currentRoom?.id}</span>
              </div>
              <div className="partner-benefits">
                <h5>✨ Benefits of studying together:</h5>
                <ul>
                  <li>• Stay motivated with visible progress</li>
                  <li>• Track each other's focus sessions</li>
                  <li>• Share tasks and goals</li>
                  <li>• Built-in accountability partner</li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>

      {showRoomModal && (
        <RoomJoinModal 
          onJoinRoom={handleJoinRoom}
          isConnected={isConnected}
        />
      )}

      {/* Sound permission modal hidden for now - can be re-enabled later
      {showSoundPermissionModal && (
        <SoundPermissionModal
          onClose={handleCloseSoundModal}
          onRetry={handleRetrySoundPermission}
        />
      )}
      */}

      {/* Chat Widget - only show when in a room */}
      {currentRoom && (
        <ChatWidget
          isOpen={isChatOpen}
          onToggle={handleToggleChat}
          messages={chatMessages}
          onSendMessage={handleSendMessage}
          currentUser={currentUser}
          unreadCount={unreadCount}
          onMarkAsRead={handleMarkAsRead}
        />
      )}
    </div>
  )
}

export default App
