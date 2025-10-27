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
    console.log('🏠 ROOM JOINED SUCCESS:', data)
    console.log('🎯 ROOM ID:', data.room.id)
    console.log('👤 MY TIMER STATE ON JOIN:', data.currentUser.timerState)
    
    setCurrentRoom(data.room)
    setRoomUsers(data.users)
    
    // Set current user data with individual timer state
    setCurrentUser(prev => {
      console.log('🔀 UPDATING CLIENT USER DATA:')
      console.log('  OLD timer state:', prev.timerState)
      console.log('  NEW timer state from server:', data.currentUser.timerState)
      
      return {
        ...prev,
        ...data.currentUser
        // Keep individual timer state from server
      }
    })
    
    setShowRoomModal(false)
    setIsReconnecting(false)
    if (isReconnectingRef) isReconnectingRef.current = false
    
    console.log('✅ ROOM JOIN COMPLETE - NOW LISTENING FOR INDIVIDUAL TIMER UPDATES')
  })

  socketService.on('user_joined', (data) => {
    console.log('User joined:', data.user.name)
    setRoomUsers(data.users)
    
    // Play partner join sound when someone joins
    const currentUser = getCurrentUser()
    if (data.user.id !== currentUser.id) {
      soundService.playPartnerJoinSound()
    }
  })

  socketService.on('user_reconnected', (data) => {
    console.log('User reconnected:', data.user.name)
    setRoomUsers(data.users)
    
    // Play partner join sound when someone reconnects
    const currentUser = getCurrentUser()
    if (data.user.id !== currentUser.id) {
      soundService.playPartnerJoinSound()
    }
  })

  socketService.on('user_left', (data) => {
    console.log('User left:', data.userId)
    setRoomUsers(data.users)
    
    // Play partner leave sound when someone leaves
    const currentUser = getCurrentUser()
    if (data.userId !== currentUser.id) {
      soundService.playPartnerLeaveSound()
    }
  })

  socketService.on('user_disconnected', (data) => {
    console.log('User disconnected:', data.userId)
    setRoomUsers(data.users)
    
    // Play partner leave sound when someone disconnects
    const currentUser = getCurrentUser()
    if (data.userId !== currentUser.id) {
      soundService.playPartnerLeaveSound()
    }
  })

  // Individual user timer events  
  socketService.on('user_timer_update', (data) => {
    console.log('🔄 USER TIMER UPDATE:', data)
    const currentUser = getCurrentUser()
    
    if (data.userId === currentUser.id) {
      // This is current user's timer update
      const timeDisplay = `${Math.floor(data.timerState.timeLeft / 60)}:${(data.timerState.timeLeft % 60).toString().padStart(2, '0')}`;
      console.log(`⏱️ My Timer: ${timeDisplay} - Active: ${data.timerState.isActive}`)
      
      // Check if this is a sync event (timer jumped significantly)
      if (currentUser.timerState && Math.abs(currentUser.timerState.timeLeft - data.timerState.timeLeft) > 2) {
        console.log(`🎯 TIMER SYNCHRONIZED! Jumped from ${Math.floor(currentUser.timerState.timeLeft / 60)}:${(currentUser.timerState.timeLeft % 60).toString().padStart(2, '0')} to ${timeDisplay}`);
      }
      
      setCurrentUser(prev => ({
        ...prev,
        timerState: data.timerState
      }))
    } else {
      // This is partner's timer update
      console.log(`👥 Partner Timer: ${Math.floor(data.timerState.timeLeft / 60)}:${(data.timerState.timeLeft % 60).toString().padStart(2, '0')} - Active: ${data.timerState.isActive}`)
      setRoomUsers(prev => prev.map(user => 
        user.id === data.userId 
          ? { ...user, timerState: data.timerState }
          : user
      ))
    }
  })

  socketService.on('user_timer_complete', (data) => {
    console.log('User timer complete received:', data)
    const currentUser = getCurrentUser()
    
    if (data.userId === currentUser.id) {
      // This is current user's timer completion
      console.log('🎉 My timer completed!')
      console.log('📊 Timer completion data:', data)
      console.log('⏱️ New timer state:', data.timerState)
      console.log('📈 User data:', data.userData)
      
      setCurrentUser(prev => {
        const newUserState = {
          ...prev,
          timerState: data.timerState,
          completedSessions: data.userData?.completedSessions || prev.completedSessions,
          totalWorkTime: data.userData?.totalWorkTime || prev.totalWorkTime,
          totalBreakTime: data.userData?.totalBreakTime || prev.totalBreakTime,
          sessionHistory: data.userData?.sessionHistory || prev.sessionHistory
        };
        
        console.log('🔄 Updated user state:', newUserState)
        return newUserState;
      })
      
      // Play timer end sound for current user
      soundService.playTimerEndSound()
      
      // Show notification for current user
      if (Notification.permission === 'granted') {
        const completedMode = data.completedMode === 'pomodoro' ? 'Work' : 'Break'
        const nextMode = data.timerState.mode === 'pomodoro' ? 'work session' : 'break'
        new Notification(`${completedMode} session completed!`, {
          body: `Time for a ${nextMode}`,
          icon: '/favicon.ico'
        })
      }
    } else {
      // This is partner's timer completion
      console.log('👥 Partner timer completed!')
      setRoomUsers(prev => prev.map(user => 
        user.id === data.userId 
          ? { 
              ...user, 
              timerState: data.timerState,
              completedSessions: data.userData.completedSessions || user.completedSessions,
              totalWorkTime: data.userData.totalWorkTime || user.totalWorkTime,
              totalBreakTime: data.userData.totalBreakTime || user.totalBreakTime,
              sessionHistory: data.userData.sessionHistory || user.sessionHistory
            }
          : user
      ))
    }
  })

  // Individual user settings events
  socketService.on('user_settings_updated', (data) => {
    console.log('User settings update received:', data)
    const currentUser = getCurrentUser()
    
    if (data.userId === currentUser.id) {
      // This is current user's settings update
      console.log('⚙️ My settings updated:', data.settings)
      setCurrentUser(prev => ({
        ...prev,
        settings: data.settings,
        timerState: data.timerState
      }))
    } else {
      // This is partner's settings update
      console.log('👥 Partner settings updated')
      setRoomUsers(prev => prev.map(user => 
        user.id === data.userId 
          ? { ...user, settings: data.settings, timerState: data.timerState }
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

  // Session notes events
  socketService.on('session_notes_updated', (data) => {
    console.log('📝 Session notes updated:', data)
    const currentUser = getCurrentUser()
    
    if (data.userId === currentUser.id) {
      // This is current user's session notes update
      setCurrentUser(prev => {
        // Use the isCurrent flag from backend to determine which to update
        if (data.isCurrent) {
          // Update current session notes
          console.log('✅ Updating current session notes for user')
          return {
            ...prev,
            currentSessionNotes: data.notes
          }
        } else {
          // Update completed session notes
          console.log('✅ Updating completed session notes at index', data.sessionIndex)
          
          // Filter today's sessions to match backend logic
          const today = new Date()
          const isSameDay = (a, b) => {
            return a.getDate() === b.getDate() && a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear()
          }
          const todaysSessionHistory = (prev.sessionHistory || []).filter(s => {
            if (!s?.completedAt) return false
            const completedAt = new Date(s.completedAt)
            return isSameDay(completedAt, today)
          })
          
          // Find the session in full history
          const sessionToUpdate = todaysSessionHistory[data.sessionIndex]
          if (sessionToUpdate) {
            const fullHistoryIndex = prev.sessionHistory.findIndex(s => 
              s.completedAt === sessionToUpdate.completedAt
            )
            
            if (fullHistoryIndex !== -1) {
              const updatedSessionHistory = [...prev.sessionHistory]
              updatedSessionHistory[fullHistoryIndex] = {
                ...updatedSessionHistory[fullHistoryIndex],
                notes: data.notes
              }
              return {
                ...prev,
                sessionHistory: updatedSessionHistory
              }
            }
          }
          
          return prev
        }
      })
    } else {
      // This is partner's session notes update
      setRoomUsers(prev => prev.map(user => {
        if (user.id === data.userId) {
          // Use the isCurrent flag from backend to determine which to update
          if (data.isCurrent) {
            // Update current session notes
            console.log('✅ Updating partner current session notes')
            return {
              ...user,
              currentSessionNotes: data.notes
            }
          } else {
            // Update completed session notes
            console.log('✅ Updating partner completed session notes at index', data.sessionIndex)
            
            // Filter today's sessions to match backend logic
            const today = new Date()
            const isSameDay = (a, b) => {
              return a.getDate() === b.getDate() && a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear()
            }
            const todaysSessionHistory = (user.sessionHistory || []).filter(s => {
              if (!s?.completedAt) return false
              const completedAt = new Date(s.completedAt)
              return isSameDay(completedAt, today)
            })
            
            // Find the session in full history
            const sessionToUpdate = todaysSessionHistory[data.sessionIndex]
            if (sessionToUpdate) {
              const fullHistoryIndex = user.sessionHistory.findIndex(s => 
                s.completedAt === sessionToUpdate.completedAt
              )
              
              if (fullHistoryIndex !== -1) {
                const updatedSessionHistory = [...user.sessionHistory]
                updatedSessionHistory[fullHistoryIndex] = {
                  ...updatedSessionHistory[fullHistoryIndex],
                  notes: data.notes
                }
                return {
                  ...user,
                  sessionHistory: updatedSessionHistory
                }
              }
            }
            
            return user
          }
        }
        return user
      }))
    }
  })

  // Chat events
  socketService.on('chat_message', (data) => {
    console.log('Received chat message:', data)
    setChatMessages(prev => {
      // Prevent duplicate messages
      const messageExists = prev.some(msg => msg.id === data.id)
      if (messageExists) {
        return prev
      }
      // No limit on chat history - keep all messages
      return [...prev, data]
    })
    
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

  socketService.on('message_status_update', (data) => {
    console.log('Received message status update:', data)
    setChatMessages(prev => prev.map(message => 
      message.id === data.messageId 
        ? { ...message, status: data.status }
        : message
    ))
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
  socketService.off('user_name_updated')
  socketService.off('user_updated')
  socketService.off('chat_message')
  socketService.off('chat_history')
  socketService.off('message_status_update')
  socketService.off('error')
} 