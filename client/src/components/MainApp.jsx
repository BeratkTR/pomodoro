import React, { useState, useEffect, useRef } from 'react'
import Navbar from './Navbar'
import TimerSection from './TimerSection'
import StudyPartners from './StudyPartners'
import RoomJoinModal from './RoomJoinModal'
// import SoundPermissionModal from './SoundPermissionModal'
import TaskList from './TaskList'
import ChatWidget from './ChatWidget'
import VideoChat from './VideoChat'
import PersonalStatsModal from './PersonalStatsModal'
import SessionNotesModal from './SessionNotesModal'
import { useAuth } from '../contexts/AuthContext'
import socketService from '../services/socketService'
import apiService from '../services/apiService'
import soundService from '../services/soundService'
import { setupSocketListeners, cleanupSocketListeners } from '../utils/socketListeners'
import useScreenWake from '../utils/useScreenWake'
import faviconManager from '../utils/faviconManager'

function MainApp() {
  const { user: authUser } = useAuth();

  // Initialize user state from localStorage or auth user
  const getStoredUserData = () => {
    const storedName = authUser?.name || localStorage.getItem('username');
    let storedUserId = authUser?.id || localStorage.getItem('userId');
    const storedRoomId = localStorage.getItem('currentRoomId');
    const storedRoomName = localStorage.getItem('currentRoomName');
    
    // For authenticated users, always use their auth ID
    if (authUser?.id) {
      storedUserId = authUser.id;
      localStorage.setItem('userId', storedUserId);
      localStorage.setItem('username', authUser.name);
    } else if (!storedUserId) {
      // Generate a unique user ID only for guest users
      storedUserId = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('userId', storedUserId);
    }
    
    return {
      id: storedUserId,
      name: storedName || '',
      currentRoomId: storedRoomId,
      currentRoomName: storedRoomName,
      timerState: {
        timeLeft: 50 * 60, // Match server default
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

  // Prompt for name if not available (only for non-authenticated users)
  useEffect(() => {
    if (!authUser) {
      const storedName = localStorage.getItem('username');
      if (!storedName) {
        const name = prompt('Please enter your name');
        if (name) {
          localStorage.setItem('username', name);
        }
      }
    }
  }, [authUser]);

  // Room state
  const [isConnected, setIsConnected] = useState(false)
  const [currentRoom, setCurrentRoom] = useState(null)
  const [roomUsers, setRoomUsers] = useState([])
  const [showRoomModal, setShowRoomModal] = useState(true)
  const [connectionError, setConnectionError] = useState(null)
  const [isReconnecting, setIsReconnecting] = useState(false)

  // User state
  const [currentUser, setCurrentUser] = useState(getStoredUserData())

  // Update user data when auth user changes
  useEffect(() => {
    if (authUser) {
      setCurrentUser(prev => ({
        ...prev,
        id: authUser.id,
        name: authUser.name
      }));

      // If authenticated user has a saved room and we're connected but not in a room, try to reconnect
      if (authUser.lastRoomId && isConnected && !currentRoom && !showRoomModal) {
        console.log(`Attempting to reconnect authenticated user to room: ${authUser.lastRoomName} (${authUser.lastRoomId})`);
        
        setIsReconnecting(true);
        isReconnectingRef.current = true;
        setShowRoomModal(false);
        
        // Update localStorage
        localStorage.setItem('currentRoomId', authUser.lastRoomId);
        if (authUser.lastRoomName) {
          localStorage.setItem('currentRoomName', authUser.lastRoomName);
        }
        
        // Try to reconnect
        setTimeout(() => {
          socketService.joinRoom(authUser.lastRoomId, {
            id: authUser.id,
            name: authUser.name
          }, true); // true indicates this is a reconnection
        }, 500);

        // Set a timeout to handle failed reconnection
        setTimeout(() => {
          if (isReconnectingRef.current) {
            console.log('Room reconnection timeout for authenticated user')
            setIsReconnecting(false)
            isReconnectingRef.current = false
            setShowRoomModal(true)
            setConnectionError(null)
          }
        }, 5000);
      }
    }
  }, [authUser, isConnected, currentRoom, showRoomModal]);

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
  
  // Keep currentUserRef in sync with currentUser state
  useEffect(() => {
    currentUserRef.current = currentUser
  }, [currentUser])

  // Partner stats modal state
  const [showPartnerStatsModal, setShowPartnerStatsModal] = useState(false)
  const [partnerForStats, setPartnerForStats] = useState(null)

  // Session notes modal state
  const [showSessionNotesModal, setShowSessionNotesModal] = useState(false)
  const [selectedSession, setSelectedSession] = useState(null)
  const [selectedSessionIndex, setSelectedSessionIndex] = useState(null)
  const [isPartnerSession, setIsPartnerSession] = useState(false)
  const [isCurrentSession, setIsCurrentSession] = useState(false)

  // Sound permission state (hidden for now)
  // const [showSoundPermissionModal, setShowSoundPermissionModal] = useState(false)

  // Screen wake to prevent laptop from sleeping when timer is active using NoSleep.js
  const { isSupported: isWakeLockSupported, isWakeLockActive } = useScreenWake(currentUser.timerState?.isActive || false);

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
        console.log('🚀 MainApp: Starting socket connection...')
        await socketService.connect()
        console.log('✅ MainApp: Socket connected, updating React state...')
        setIsConnected(true)
        setConnectionError(null)
        console.log('🎯 MainApp: Connection state updated!')
        
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
        let storedRoomId = localStorage.getItem('currentRoomId');
        let storedRoomName = localStorage.getItem('currentRoomName');
        const storedUserId = localStorage.getItem('userId');
        const storedUserName = localStorage.getItem('username');

        // For authenticated users, prioritize their saved room info
        if (authUser && authUser.lastRoomId) {
          storedRoomId = authUser.lastRoomId;
          storedRoomName = authUser.lastRoomName;
          // Update localStorage with the authenticated user's room info
          localStorage.setItem('currentRoomId', storedRoomId);
          if (storedRoomName) {
            localStorage.setItem('currentRoomName', storedRoomName);
          }
        }

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

  // Detect and send user's timezone when connection is established
  useEffect(() => {
    if (isConnected && currentRoom && currentUser.id) {
      // Detect user's timezone
      const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      console.log(`Detected user timezone: ${userTimezone}`);
      
      // Send timezone to server
      socketService.updateTimezone(userTimezone);
    }
  }, [isConnected, currentRoom, currentUser.id])

  // Check for timezone changes (in case user travels or changes system timezone)
  useEffect(() => {
    const checkTimezone = () => {
      if (isConnected && currentRoom && currentUser.id) {
        const currentTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const storedTimezone = localStorage.getItem('userTimezone');
        
        if (storedTimezone !== currentTimezone) {
          console.log(`Timezone changed from ${storedTimezone} to ${currentTimezone}`);
          localStorage.setItem('userTimezone', currentTimezone);
          socketService.updateTimezone(currentTimezone);
        }
      }
    };

    // Check timezone every 30 minutes (in case it changes)
    const interval = setInterval(checkTimezone, 30 * 60 * 1000);
    
    // Also check on focus (when user returns to the app)
    const handleFocus = () => {
      setTimeout(checkTimezone, 1000); // Small delay to ensure connection is stable
    };
    
    window.addEventListener('focus', handleFocus);
    
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
    };
  }, [isConnected, currentRoom, currentUser.id])

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
        timeLeft: 50 * 60, // Match server default
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
  const [timerActionInProgress, setTimerActionInProgress] = useState(false)

  const handleStartTimer = () => {
    console.log('🚀 Starting timer - Current state:', currentUser.timerState)
    socketService.startTimer()
  }

  const handlePauseTimer = () => {
    console.log('⏸️ Pausing timer... Current state:', currentUser.timerState)
    socketService.pauseTimer()
  }

  const handleResetTimer = () => {
    console.log('🔄 Resetting timer... Current state:', currentUser.timerState)
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

  // Partner stats modal handlers
  const handleShowPartnerStats = (partner) => {
    setPartnerForStats(partner)
    setShowPartnerStatsModal(true)
  }

  const handleClosePartnerStats = () => {
    setShowPartnerStatsModal(false)
    setPartnerForStats(null)
  }

  // Helper to check if two dates are on the same calendar day
  const isSameDay = (a, b) => {
    return a.getDate() === b.getDate() && a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear();
  };

  // Session notes modal handlers
  const handleSessionClick = (sessionIndex, sessionInfo, isCurrent = false, isPartner = false) => {
    setSelectedSessionIndex(sessionIndex)
    setIsPartnerSession(isPartner)
    setIsCurrentSession(isCurrent)
    
    console.log('📝 handleSessionClick:', { 
      sessionIndex, 
      isCurrent, 
      isPartner,
      sessionInfo,
      currentUserCurrentSessionNotes: currentUser.currentSessionNotes 
    })
    
    // Always get fresh data from current state
    if (isCurrent) {
      const notesToUse = isPartner 
        ? (roomUsers.find(u => u.id !== currentUser.id)?.currentSessionNotes || '')
        : (currentUser.currentSessionNotes || '');
      
      console.log('🔍 Current session - Setting notes:', { 
        notesToUse, 
        length: notesToUse.length,
        isPartner 
      });
      
      setSelectedSession({
        ...sessionInfo,
        notes: notesToUse
      })
    } else {
      // Get fresh session data from TODAY's sessionHistory (filtered like in SessionProgress)
      const targetUser = isPartner ? roomUsers.find(u => u.id !== currentUser.id) : currentUser
      const fullSessionHistory = targetUser?.sessionHistory || []
      const today = new Date()
      const todaysSessionHistory = fullSessionHistory.filter(s => {
        if (!s?.completedAt) return false
        const completedAt = new Date(s.completedAt)
        return isSameDay(completedAt, today)
      })
      
      const freshSessionInfo = todaysSessionHistory[sessionIndex]
      
      console.log('🔍 Opening session notes:', { 
        sessionIndex, 
        todaysSessions: todaysSessionHistory.length,
        freshNotes: freshSessionInfo?.notes,
        hasNotes: !!freshSessionInfo?.notes
      })
      
      setSelectedSession(freshSessionInfo || sessionInfo)
    }
    setShowSessionNotesModal(true)
  }

  const handleCloseSessionNotes = () => {
    setShowSessionNotesModal(false)
    setSelectedSession(null)
    setSelectedSessionIndex(null)
    setIsPartnerSession(false)
    setIsCurrentSession(false)
  }

  const handleSaveSessionNotes = (sessionIndex, notes) => {
    console.log('💾 Saving session notes:', { sessionIndex, notes, isPartnerSession, isCurrentSession })
    if (!isPartnerSession) {
      // Only save if it's user's own session
      socketService.updateSessionNotes(sessionIndex, notes, isCurrentSession)
      console.log('✅ Notes sent to server')
    }
    handleCloseSessionNotes()
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

  // Request notification permission (disabled for now to avoid interference)
  // useEffect(() => {
  //   const checkNotificationPermission = async () => {
  //     // Only check after user is connected and has joined a room
  //     if (isConnected && currentRoom && !showRoomModal) {
  //       if (Notification.permission === 'default') {
  //         await Notification.requestPermission()
  //         // Note: modal logic commented out for now
  //         // if (permission === 'denied') {
  //         //   setShowSoundPermissionModal(true)
  //         // }
  //       }
  //       // Note: always show modal logic commented out for now
  //       // else if (Notification.permission === 'denied') {
  //       //   setShowSoundPermissionModal(true)
  //       // }
  //     }
  //   }

  //   checkNotificationPermission()
  // }, [isConnected, currentRoom, showRoomModal])

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
            timerActionInProgress={timerActionInProgress}
            onSessionClick={handleSessionClick}
          />
          
          <StudyPartners 
            users={roomUsers}
            currentUserId={currentUser.id}
            currentUser={currentUser}
            currentRoom={currentRoom}
            onShowPartnerStats={handleShowPartnerStats}
            onSessionClick={handleSessionClick}
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

      {/* Video Chat - only show when in a room */}
      {false && currentRoom && (
        <VideoChat
          currentRoom={currentRoom}
          currentUser={currentUser}
          roomUsers={roomUsers}
        />
      )}

      {/* Partner Stats Modal */}
      {showPartnerStatsModal && partnerForStats && (
        <PersonalStatsModal 
          onClose={handleClosePartnerStats} 
          currentUser={partnerForStats}
          onSessionClick={(sessionIndex, sessionInfo, isCurrent) => {
            // Check if this is partner's stats or own stats
            const isPartner = partnerForStats.id !== currentUser.id
            
            setSelectedSessionIndex(sessionIndex)
            setIsPartnerSession(isPartner)
            setIsCurrentSession(isCurrent)
            
            console.log('📝 Stats modal session click:', { sessionIndex, isCurrent, isPartner })
            
            if (isCurrent) {
              setSelectedSession({
                ...sessionInfo,
                notes: isPartner 
                  ? (partnerForStats.currentSessionNotes || '')
                  : (currentUser.currentSessionNotes || '')
              })
            } else {
              // For completed sessions, use the sessionInfo directly if it has all data
              // This works for both today's sessions and historical sessions
              if (sessionInfo && sessionInfo.completedAt) {
                // Session info is complete, use it directly (for historical data)
                console.log('🔍 Opening session notes from stats modal (direct):', { 
                  sessionIndex, 
                  sessionInfo,
                  notes: sessionInfo?.notes,
                  hasNotes: !!sessionInfo?.notes,
                  isPartner
                })
                setSelectedSession(sessionInfo)
              } else {
                // Fallback: Get fresh session data from TODAY's sessionHistory
                const targetUser = isPartner ? partnerForStats : currentUser
                const fullSessionHistory = targetUser?.sessionHistory || []
                const today = new Date()
                const todaysSessionHistory = fullSessionHistory.filter(s => {
                  if (!s?.completedAt) return false
                  const completedAt = new Date(s.completedAt)
                  return isSameDay(completedAt, today)
                })
                
                const freshSessionInfo = todaysSessionHistory[sessionIndex]
                
                console.log('🔍 Opening session notes from stats modal (today):', { 
                  sessionIndex, 
                  todaysSessions: todaysSessionHistory.length,
                  freshNotes: freshSessionInfo?.notes,
                  hasNotes: !!freshSessionInfo?.notes,
                  isPartner
                })
                
                setSelectedSession(freshSessionInfo || sessionInfo)
              }
            }
            setShowSessionNotesModal(true)
          }}
        />
      )}

      {/* Session Notes Modal */}
      {showSessionNotesModal && selectedSession && (
        <SessionNotesModal
          session={selectedSession}
          sessionIndex={selectedSessionIndex}
          onClose={handleCloseSessionNotes}
          onSave={handleSaveSessionNotes}
          readOnly={isPartnerSession}
        />
      )}

    </div>
  )
}

export default MainApp
