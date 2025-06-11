// Calculate dead time gaps between sessions (works for any session type - pomodoro or break)
export const calculateDeadTimeGaps = (sessionHistory, currentTimerState = null, userSettings = null) => {
  if (!sessionHistory) sessionHistory = [];
  
  const gaps = [];
  
  // Add dead time from start of day to first session
  if (sessionHistory.length > 0) {
    const firstSession = sessionHistory[0];
    if (firstSession.completedAt && firstSession.duration) {
      // Calculate when the first session started
      const firstSessionDuration = firstSession.duration * 60 * 1000;
      const firstSessionStartTime = new Date(firstSession.completedAt).getTime() - firstSessionDuration;
      
      // Get start of day (midnight)
      const firstSessionDate = new Date(firstSession.completedAt);
      const dayStart = new Date(firstSessionDate);
      dayStart.setHours(0, 0, 0, 0); // 00:00 AM (midnight)
      
      // Calculate gap from day start to first session
      const gapMilliseconds = firstSessionStartTime - dayStart.getTime();
      const gapMinutes = gapMilliseconds / (1000 * 60);
      
      // Only include if gap is 10 minutes or more and first session started after midnight
      if (gapMinutes >= 10 && firstSessionStartTime > dayStart.getTime()) {
        console.log('🌅 Start-of-day gap calculation:', {
          dayStart: dayStart.toISOString(),
          firstSessionCompletedAt: firstSession.completedAt,
          firstSessionDuration: firstSession.duration,
          firstSessionStartTime: new Date(firstSessionStartTime).toISOString(),
          gapMinutes: gapMinutes,
          gapFormatted: `${Math.floor(gapMinutes / 60)} hours ${Math.round(gapMinutes % 60)} mins`
        });
        
        gaps.push({
          afterSessionIndex: -1, // Special index for start-of-day gap
          duration: gapMinutes,
          isStartOfDay: true,
          debug: {
            dayStart: dayStart.toISOString(),
            firstSessionStartTime: new Date(firstSessionStartTime).toISOString(),
            firstSessionType: firstSession.type,
            gapMinutes: gapMinutes
          }
        });
      }
    }
  }
  
  // Add gaps between consecutive sessions
  for (let i = 1; i < sessionHistory.length; i++) {
    const prevSession = sessionHistory[i - 1];
    const currentSession = sessionHistory[i];
    
    // Make sure both sessions have completion timestamps and durations
    if (prevSession.completedAt && currentSession.completedAt && 
        prevSession.duration && currentSession.duration) {
      
      // Calculate when the previous session ended
      const prevEndTime = new Date(prevSession.completedAt).getTime();
      
      // Calculate when the current session started
      // completedAt is when the session ended, so subtract duration to get start time
      const currentSessionDuration = currentSession.duration * 60 * 1000; // Convert minutes to milliseconds
      const currentStartTime = new Date(currentSession.completedAt).getTime() - currentSessionDuration;
      
      // Calculate the gap between sessions
      const gapMilliseconds = currentStartTime - prevEndTime;
      const gapMinutes = gapMilliseconds / (1000 * 60);
      
      // Only include gaps of 10 minutes or more (regardless of session type)
      if (gapMinutes >= 10) {
        gaps.push({
          afterSessionIndex: i - 1,
          duration: gapMinutes,
          isStartOfDay: false,
          // Debug info to help track what's happening
          debug: {
            prevSessionType: prevSession.type,
            currentSessionType: currentSession.type,
            prevEndTime: new Date(prevEndTime).toISOString(),
            currentStartTime: new Date(currentStartTime).toISOString(),
            gapMinutes: gapMinutes
          }
        });
      }
    }
  }
  
  // Add dead time gap for current active session (if user has started a timer)
  if (currentTimerState && sessionHistory.length > 0) {
    const lastCompletedSession = sessionHistory[sessionHistory.length - 1];
    
    if (lastCompletedSession.completedAt && currentTimerState.isActive) {
      // Calculate when the current session started
      // We need to estimate when the current session started based on timer state
      const currentSessionExpectedDuration = currentTimerState.mode === 'pomodoro' ? 
        (userSettings?.pomodoro || 25) : (userSettings?.break || 10);
      const currentSessionElapsedTime = (currentSessionExpectedDuration * 60) - currentTimerState.timeLeft;
      const currentSessionStartTime = Date.now() - (currentSessionElapsedTime * 1000);
      
      // Calculate when the last completed session ended
      const lastSessionEndTime = new Date(lastCompletedSession.completedAt).getTime();
      
      // Calculate the gap
      const gapMilliseconds = currentSessionStartTime - lastSessionEndTime;
      const gapMinutes = gapMilliseconds / (1000 * 60);
      
      // Only include if gap is 10 minutes or more
      if (gapMinutes >= 10) {
        console.log('⏰ Current session gap calculation:', {
          lastSessionEndTime: new Date(lastSessionEndTime).toISOString(),
          currentSessionStartTime: new Date(currentSessionStartTime).toISOString(),
          currentSessionMode: currentTimerState.mode,
          gapMinutes: gapMinutes,
          gapFormatted: `${Math.floor(gapMinutes / 60)} hours ${Math.round(gapMinutes % 60)} mins`
        });
        
        gaps.push({
          afterSessionIndex: sessionHistory.length - 1, // After the last completed session
          duration: gapMinutes,
          isStartOfDay: false,
          isCurrentSession: true, // Mark as current session gap
          debug: {
            lastSessionType: lastCompletedSession.type,
            currentSessionType: currentTimerState.mode,
            lastSessionEndTime: new Date(lastSessionEndTime).toISOString(),
            currentSessionStartTime: new Date(currentSessionStartTime).toISOString(),
            gapMinutes: gapMinutes
          }
        });
      }
    }
  }
  
  // Handle case where this is the very first session of the day and user has started timer
  if (currentTimerState && sessionHistory.length === 0 && currentTimerState.isActive) {
    // Calculate when the current session started
    const currentSessionExpectedDuration = currentTimerState.mode === 'pomodoro' ? 
      (userSettings?.pomodoro || 25) : (userSettings?.break || 10);
    const currentSessionElapsedTime = (currentSessionExpectedDuration * 60) - currentTimerState.timeLeft;
    const currentSessionStartTime = Date.now() - (currentSessionElapsedTime * 1000);
    
    // Get start of day (midnight)
    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    
    // Calculate gap from day start to current session
    const gapMilliseconds = currentSessionStartTime - dayStart.getTime();
    const gapMinutes = gapMilliseconds / (1000 * 60);
    
    // Only include if gap is 10 minutes or more
    if (gapMinutes >= 10 && currentSessionStartTime > dayStart.getTime()) {
      console.log('🌅 First session (current) gap calculation:', {
        dayStart: dayStart.toISOString(),
        currentSessionStartTime: new Date(currentSessionStartTime).toISOString(),
        currentSessionMode: currentTimerState.mode,
        gapMinutes: gapMinutes,
        gapFormatted: `${Math.floor(gapMinutes / 60)} hours ${Math.round(gapMinutes % 60)} mins`
      });
      
      gaps.push({
        afterSessionIndex: -1, // Special index for start-of-day gap
        duration: gapMinutes,
        isStartOfDay: true,
        isCurrentSession: true, // Mark as current session gap
        debug: {
          dayStart: dayStart.toISOString(),
          currentSessionStartTime: new Date(currentSessionStartTime).toISOString(),
          currentSessionType: currentTimerState.mode,
          gapMinutes: gapMinutes
        }
      });
    }
  }
  
  return gaps;
}; 