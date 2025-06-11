// Calculate dead time gaps between sessions (works for any session type - pomodoro or break)
export const calculateDeadTimeGaps = (sessionHistory) => {
  if (!sessionHistory || sessionHistory.length < 2) return [];
  
  const gaps = [];
  
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