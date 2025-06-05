import socketService from '../services/socketService'
import soundService from '../services/soundService'

export const setupSocketListeners = (
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
  getCurrentUser
  // checkPermissionModal // Hidden for now
) => {
  // Room events
  socketService.on('room_joined', (data) => {
    console.log('Joined room:', data)
    setCurrentRoom(data.room)
    setRoomUsers(data.users)
    setCurrentUser(prev => ({
      ...prev,
      ...data.currentUser
    }))
    setShowRoomModal(false)
    setIsReconnecting(false)
    if (isReconnectingRef) isReconnectingRef.current = false
  })

  socketService.on('user_joined', (data) => {
    console.log('User joined:', data.user.name)
    setRoomUsers(data.users)
  })

  socketService.on('user_reconnected', (data) => {
    console.log('User reconnected:', data.user.name)
    setRoomUsers(data.users)
  })

  socketService.on('user_left', (data) => {
    console.log('User left:', data.userId)
    setRoomUsers(data.users)
  })

  socketService.on('user_disconnected', (data) => {
    console.log('User disconnected:', data.userId)
    setRoomUsers(data.users)
  })

  // Individual user timer events
  socketService.on('user_timer_update', (data) => {
    console.log('Timer update received:', data)
    const currentUser = getCurrentUser()
    
    // Update the specific user's timer state
    if (data.userId === currentUser.id) {
      // This is current user's timer update
      console.log('Updating current user timer state')
      setCurrentUser(prev => ({
        ...prev,
        timerState: data.timerState
      }))
    } else {
      // This is partner's timer update
      console.log('Updating partner timer state')
      setRoomUsers(prev => prev.map(user => 
        user.id === data.userId 
          ? { ...user, timerState: data.timerState }
          : user
      ))
    }
  })

  socketService.on('user_timer_complete', (data) => {
    console.log('Timer complete received:', data)
    const currentUser = getCurrentUser()
    
    // Update the specific user's timer state and completed sessions
    if (data.userId === currentUser.id) {
      // This is current user's timer completion
      console.log('Current user timer completed')
      setCurrentUser(prev => ({
        ...prev,
        timerState: data.timerState,
        completedSessions: data.completedSessions
      }))
      
      // Play timer end sound
      soundService.playTimerEndSound()
      
      // Note: permission modal check hidden for now
      // if (checkPermissionModal) {
      //   checkPermissionModal()
      // }
      
      // Show notification
      if (Notification.permission === 'granted') {
        new Notification(`${data.timerState.mode === 'pomodoro' ? 'Work' : 'Break'} time!`, {
          body: `Time for a ${data.timerState.mode === 'pomodoro' ? 'focus session' : 'break'}`,
          icon: '/favicon.ico'
        })
      }
    } else {
      // This is partner's timer completion
      console.log('Partner timer completed')
      setRoomUsers(prev => prev.map(user => 
        user.id === data.userId 
          ? { 
              ...user, 
              timerState: data.timerState,
              completedSessions: data.completedSessions
            }
          : user
      ))
    }
  })

  // Individual user settings events
  socketService.on('user_settings_updated', (data) => {
    console.log('Settings update received:', data)
    const currentUser = getCurrentUser()
    
    if (data.userId === currentUser.id) {
      // This is current user's settings update
      console.log('Updating current user settings')
      setCurrentUser(prev => ({
        ...prev,
        settings: data.settings,
        timerState: data.timerState
      }))
    } else {
      // This is partner's settings update
      console.log('Updating partner settings')
      setRoomUsers(prev => prev.map(user => 
        user.id === data.userId 
          ? { 
              ...user, 
              settings: data.settings,
              timerState: data.timerState
            }
          : user
      ))
    }
  })

  // User name updates
  socketService.on('user_name_updated', (data) => {
    console.log('User name update received:', data)
    const currentUser = getCurrentUser()
    
    if (data.userId === currentUser.id) {
      // This is current user's name update
      console.log('Updating current user name')
      setCurrentUser(prev => ({
        ...prev,
        name: data.newName
      }))
    } else {
      // This is partner's name update
      console.log('Updating partner name')
      setRoomUsers(prev => prev.map(user => 
        user.id === data.userId 
          ? { ...user, name: data.newName }
          : user
      ))
    }
  })

  // User data updates (for tasks, etc.)
  socketService.on('user_updated', (data) => {
    console.log('User data update received:', data)
    console.log('User data totalWorkTime:', data.userData?.totalWorkTime, 'totalBreakTime:', data.userData?.totalBreakTime)
    const currentUser = getCurrentUser()
    
    if (data.userId === currentUser.id) {
      // This is current user's data update
      console.log('Updating current user data (tasks, etc.)')
      console.log('Current user before update - totalWorkTime:', currentUser.totalWorkTime, 'totalBreakTime:', currentUser.totalBreakTime)
      setCurrentUser(prev => ({
        ...prev,
        ...data.userData
      }))
    } else {
      // This is partner's data update
      console.log('Updating partner data (tasks, etc.)')
      setRoomUsers(prev => prev.map(user => 
        user.id === data.userId 
          ? { ...user, ...data.userData }
          : user
      ))
    }
  })

  // Chat events
  socketService.on('chat_message', (data) => {
    console.log('Received chat message:', data)
    setChatMessages(prev => [...prev, data])
    
    // If message is from partner, handle sound and unread count
    const currentUser = getCurrentUser()
    if (data.userId !== currentUser.id) {
      // Check if chat is currently open using the ref
      const isChatOpen = isChatOpenRef && isChatOpenRef.current
      
      // Only play message sound if chat is closed
      if (!isChatOpen) {
        soundService.playMessageSound()
        
        // Note: permission modal check hidden for now
        // if (checkPermissionModal) {
        //   checkPermissionModal()
        // }
        
        // Increment unread count when chat is closed
        setUnreadCount(prev => prev + 1)
      }
    }
  })

  socketService.on('chat_history', (data) => {
    console.log('Received chat history:', data)
    setChatMessages(data.messages || [])
  })

  socketService.on('error', (data) => {
    console.error('Socket error:', data.message)
    
    // If room not found, clear localStorage and show room modal
    if (data.message.includes('Room not found') || data.message.includes('room not found')) {
      console.log('Room not found, clearing localStorage and showing room modal')
      localStorage.removeItem('currentRoomId')
      localStorage.removeItem('currentRoomName')
      setCurrentRoom(null)
      setRoomUsers([])
      setChatMessages([])
      setUnreadCount(0)
      setShowRoomModal(true)
      setIsReconnecting(false)
      if (isReconnectingRef) isReconnectingRef.current = false
      setConnectionError(null) // Clear the error since we're handling it
    } else {
      setConnectionError(data.message)
      setIsReconnecting(false)
      if (isReconnectingRef) isReconnectingRef.current = false
    }
  })
}

export const cleanupSocketListeners = () => {
  // Remove all listeners to prevent memory leaks
  socketService.off('room_joined')
  socketService.off('user_joined')
  socketService.off('user_reconnected')
  socketService.off('user_left')
  socketService.off('user_disconnected')
  socketService.off('user_timer_update')
  socketService.off('user_timer_complete')
  socketService.off('user_settings_updated')
  socketService.off('user_updated')
  socketService.off('chat_message')
  socketService.off('chat_history')
  socketService.off('error')
} 