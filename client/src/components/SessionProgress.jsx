import React, { useState } from 'react';

// SessionBar component for individual session visualization
const SessionBar = ({ 
  sessionNum, 
  historyIndex, 
  sessionHistory, 
  pomodoroLength, 
  breakLength, 
  currentSession, 
  currentTimerState 
}) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const formatBubbleDuration = (minutes) => {
    if (minutes < 1) {
      const seconds = Math.round(minutes * 60);
      if (seconds === 1) return '1 sec';
      return `${seconds} secs`;
    }
    const roundedMinutes = Math.round(minutes);
    if (roundedMinutes === 1) return '1 min';
    return `${roundedMinutes} mins`;
  };

  const calculateBarWidth = (durationMinutes) => {
    const minWidth = 20;
    const maxWidth = 60;
    const minDuration = 5;
    const maxDuration = 120;
    
    const clampedDuration = Math.max(minDuration, Math.min(maxDuration, durationMinutes));
    const normalizedDuration = (clampedDuration - minDuration) / (maxDuration - minDuration);
    
    return minWidth + (normalizedDuration * (maxWidth - minWidth));
  };

  const getTierDescription = (durationMinutes) => {
    if (durationMinutes >= 90) return "🏆 Master Focus";
    if (durationMinutes >= 60) return "🎯 Deep Focus";
    if (durationMinutes >= 30) return "💪 Strong Focus";
    if (durationMinutes >= 15) return "🔥 Good Focus";
    if (durationMinutes >= 5) return "⚡ Quick Focus";
    return "👶 Getting Started";
  };

  // Check if this session is completed
  const isCompleted = sessionNum <= (sessionHistory?.length || 0);
  const isCurrent = sessionNum === currentSession;
  const isPending = sessionNum > currentSession;
  
  // Get session info from history if available
  const sessionInfo = sessionHistory?.[historyIndex];
  const sessionType = sessionInfo?.type || (sessionNum % 2 === 1 ? 'pomodoro' : 'break');
  
  // Calculate session duration and progress
  let duration, progress, tooltipContent;
  
  if (isCompleted && sessionInfo) {
    // Completed session - use actual duration from history
    duration = sessionInfo.duration || 0;
    progress = 1;
    
    tooltipContent = formatBubbleDuration(duration);
  } else if (isCurrent && currentTimerState) {
    // Current session - calculate progress
    const expectedDuration = sessionType === 'pomodoro' ? pomodoroLength : breakLength;
    const totalTime = expectedDuration * 60;
    const elapsedTime = totalTime - currentTimerState.timeLeft;
    duration = elapsedTime / 60;
    progress = elapsedTime / totalTime;
    
    tooltipContent = formatBubbleDuration(duration);
  } else {
    // Pending session
    const expectedDuration = sessionType === 'pomodoro' ? pomodoroLength : breakLength;
    duration = expectedDuration;
    progress = 0;
    tooltipContent = formatBubbleDuration(expectedDuration);
  }

  const barWidth = calculateBarWidth(duration);
  
  // Determine session state classes
  let sessionClass = '';
  if (isCompleted) {
    sessionClass = `completed ${sessionType}`;
  } else if (isCurrent) {
    sessionClass = 'current';
  } else {
    sessionClass = 'pending';
  }

  return (
    <div 
      className="session-bar-container"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <div 
        className={`session-bar ${sessionClass}`}
        style={{ width: `${barWidth}px` }}
      >
        <div className="bar-fill" style={{ width: `${progress * 100}%` }}></div>
      </div>
      {showTooltip && (
        <div className="session-tooltip">
          {tooltipContent}
        </div>
      )}
    </div>
  );
};

const SessionProgress = ({ currentUser }) => {
  if (!currentUser) return null;

  const formatDuration = (totalMinutes) => {
    const minutes = Math.floor(totalMinutes);
    const seconds = Math.round((totalMinutes - minutes) * 60);
    
    if (seconds >= 60) {
      return `${minutes + 1}:00`;
    }
    
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const calculateStats = () => {
    const completedSessions = currentUser.completedSessions || 0;
    const currentSession = currentUser.timerState?.currentSession || 1;
    const timerState = currentUser.timerState;
    
    // Get timer settings
    const pomodoroLength = currentUser.settings?.pomodoro || 50;
    const breakLength = currentUser.settings?.break || 10;
    
    // Get accumulated times from server
    const accumulatedWorkTime = currentUser.totalWorkTime || 0;
    const accumulatedBreakTime = currentUser.totalBreakTime || 0;
    
    // Calculate current session elapsed time
    let currentSessionTime = 0;
    
    if (timerState) {
      const totalTime = timerState.mode === 'pomodoro' ? pomodoroLength * 60 : breakLength * 60;
      const elapsedSeconds = totalTime - timerState.timeLeft;
      currentSessionTime = elapsedSeconds / 60;
    }
    
    // For display: show accumulated time + current session time
    const displayWorkTime = accumulatedWorkTime + (timerState?.mode === 'pomodoro' ? currentSessionTime : 0);
    const displayBreakTime = accumulatedBreakTime + (timerState?.mode === 'break' ? currentSessionTime : 0);
    
    return {
      totalWorkTime: formatDuration(displayWorkTime),
      totalBreakTime: formatDuration(displayBreakTime),
      completedSessions,
      currentSession,
      pomodoroLength,
      breakLength
    };
  };

  const renderSessionBars = (completedSessions, currentSession) => {
    const totalBars = Math.max(1, currentSession);
    const sessionHistory = currentUser?.sessionHistory || [];
    
    const pomodoroLength = currentUser?.settings?.pomodoro || 50;
    const breakLength = currentUser?.settings?.break || 10;
    
    return (
      <div className="session-progress-bars">
        {Array.from({ length: totalBars }, (_, index) => {
          const sessionNum = index + 1;
          const historyIndex = index;
          
          return (
            <SessionBar 
              key={sessionNum}
              sessionNum={sessionNum}
              historyIndex={historyIndex}
              sessionHistory={sessionHistory}
              pomodoroLength={pomodoroLength}
              breakLength={breakLength}
              currentSession={currentSession}
              currentTimerState={currentUser?.timerState}
            />
          );
        })}
      </div>
    );
  };

  const stats = calculateStats();

  return (
    <div className="session-progress-section">
      <h4>Session Progress</h4>
      {renderSessionBars(stats.completedSessions, stats.currentSession)}
    </div>
  );
};

export default SessionProgress; 