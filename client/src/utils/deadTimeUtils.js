// Calculate dead time gaps between sessions (works for any session type - pomodoro or break)
export const calculateDeadTimeGaps = (sessionHistory) => {
  if (!sessionHistory || sessionHistory.length === 0) return [];
  
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
  
  return gaps;
}; 