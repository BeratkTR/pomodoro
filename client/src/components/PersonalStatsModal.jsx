import React, { useState, useEffect } from 'react';

// Session bar component with tooltip - memoized to prevent unnecessary re-renders
const SessionBar = React.memo(({ 
  sessionNum, 
  historyIndex, 
  sessionHistory, 
  pomodoroLength, 
  breakLength, 
  currentSession, 
  currentTimerState 
}) => {
  const [showTooltip, setShowTooltip] = useState(false);
  
  // Helper function to format tooltip duration for bubble display
  const formatBubbleDuration = (minutes) => {
    if (minutes < 1) {
      const seconds = Math.round(minutes * 60);
      return `${seconds}s`;
    }
    return `${Math.round(minutes)}m`;
  };
  
  // Calculate the width based on duration ranges (tiered system)
  const calculateBarWidth = (durationMinutes) => {
    // Tiered scaling system
    if (durationMinutes <= 5) return 15;      // 0-5 min
    if (durationMinutes <= 10) return 20;     // 5-10 min
    if (durationMinutes <= 15) return 25;     // 10-15 min
    if (durationMinutes <= 20) return 30;     // 15-20 min
    if (durationMinutes <= 25) return 35;     // 20-25 min
    if (durationMinutes <= 30) return 40;     // 25-30 min
    if (durationMinutes <= 35) return 45;     // 30-35 min
    if (durationMinutes <= 40) return 50;     // 35-40 min
    if (durationMinutes <= 45) return 55;     // 40-45 min
    if (durationMinutes <= 50) return 60;     // 45-50 min
    if (durationMinutes <= 55) return 65;     // 50-55 min
    if (durationMinutes <= 60) return 70;     // 55-60 min
    return 75; // 60+ min (maximum)
  };
  
  // Helper function to get the tier description for debugging
  const getTierDescription = (durationMinutes) => {
    if (durationMinutes <= 5) return "0-5min";
    if (durationMinutes <= 10) return "5-10min";
    if (durationMinutes <= 15) return "10-15min";
    if (durationMinutes <= 20) return "15-20min";
    if (durationMinutes <= 25) return "20-25min";
    if (durationMinutes <= 30) return "25-30min";
    if (durationMinutes <= 35) return "30-35min";
    if (durationMinutes <= 40) return "35-40min";
    if (durationMinutes <= 45) return "40-45min";
    if (durationMinutes <= 50) return "45-50min";
    if (durationMinutes <= 55) return "50-55min";
    if (durationMinutes <= 60) return "55-60min";
    return "60+ min";
  };
  
  let barClass = 'session-bar';
  let tooltipText = '';
  let barWidth = 30; // default width
  
  if (historyIndex < sessionHistory.length) {
    const sessionType = sessionHistory[historyIndex].type;
    const sessionData = sessionHistory[historyIndex];
    barClass += ` completed ${sessionType}`;
    
    // For completed sessions, use the actual duration that was completed
    // If duration is stored in session history, use that; otherwise fall back to current settings
    const sessionDuration = sessionData.duration || (sessionType === 'pomodoro' ? pomodoroLength : breakLength);
    tooltipText = `${formatBubbleDuration(sessionDuration)}`;
    barWidth = calculateBarWidth(sessionDuration);
    console.log(`✅ Personal Stats Completed session ${sessionNum}: type=${sessionType}, actualDuration=${sessionDuration}min, tier=${getTierDescription(sessionDuration)}, width=${barWidth}px`);
  } else if (sessionNum === currentSession) {
    // Current session - show as yellow/pending with pulse
    barClass += ' current';
    
    // Calculate elapsed time for current session
    if (currentTimerState) {
      const totalTime = currentTimerState.mode === 'pomodoro' ? pomodoroLength * 60 : breakLength * 60;
      const elapsedSeconds = totalTime - currentTimerState.timeLeft;
      const elapsedMinutes = elapsedSeconds / 60;
      
      tooltipText = `${formatBubbleDuration(elapsedMinutes)}`;
      barWidth = calculateBarWidth(elapsedMinutes);
      console.log(`⏱️ Personal Stats Current session ${sessionNum}: elapsed=${elapsedMinutes.toFixed(1)}min, tier=${getTierDescription(elapsedMinutes)}, width=${barWidth}px`);
    } else {
      tooltipText = `0m`;
      barWidth = calculateBarWidth(0.5); // Show very small bar for 0 time
      console.log(`⭕ Personal Stats Current session ${sessionNum}: not started, tier=${getTierDescription(0.5)}, width=${barWidth}px`);
    }
  } else {
    // Future sessions - show as grey pending
    barClass += ' pending';
    tooltipText = `Pending`;
    // Use a small default width for pending sessions
    const pendingDuration = pomodoroLength * 0.3;
    barWidth = calculateBarWidth(pendingDuration); // 30% of expected duration for pending
    console.log(`⏳ Personal Stats Pending session ${sessionNum}: expected=${pomodoroLength}min (30% = ${pendingDuration.toFixed(1)}min), tier=${getTierDescription(pendingDuration)}, width=${barWidth}px`);
  }
  
  return (
    <div 
      className="session-bar-container"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <div 
        className={barClass}
        style={{ 
          width: `${barWidth}px`,
          minWidth: `${barWidth}px`,
          maxWidth: `${barWidth}px`
        }}
      >
        <div className="bar-fill"></div>
      </div>
      {showTooltip && (
        <div className="session-tooltip">
          {tooltipText}
        </div>
      )}
    </div>
  );
});

const PersonalStatsModal = ({ onClose, currentUser }) => {
  // State to force re-render for live updates
  const [, setUpdateTrigger] = useState(0);

  // Update stats every second when timer is active
  useEffect(() => {
    let intervalId;
    
    if (currentUser?.timerState?.isActive) {
      intervalId = setInterval(() => {
        setUpdateTrigger(prev => prev + 1);
      }, 1000);
    }
    
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [currentUser?.timerState?.isActive]);

  // Format time function as minutes:seconds (e.g., 3:01 for 3 minutes 1 second)
  const formatDuration = (totalMinutes) => {
    const minutes = Math.floor(totalMinutes);
    const seconds = Math.round((totalMinutes - minutes) * 60);
    
    // Handle case where seconds round to 60
    if (seconds >= 60) {
      return `${minutes + 1}:00`;
    }
    
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Format time for timer display
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Calculate personal stats with live updates
  const calculatePersonalStats = () => {
    if (!currentUser) return null;

    const completedSessions = currentUser.completedSessions || 0;
    const currentSession = currentUser.timerState?.currentSession || 1;
    const timerState = currentUser.timerState;
    
    // Get timer settings
    const pomodoroLength = currentUser.settings?.pomodoro || 50;
    const breakLength = currentUser.settings?.break || 10;
    
    // Get accumulated times from server (these persist across rooms)
    const accumulatedWorkTime = currentUser.totalWorkTime || 0;
    const accumulatedBreakTime = currentUser.totalBreakTime || 0;
    
    // Debug logging
    console.log(`PersonalStats Debug - User: ${currentUser.name}, AccumulatedWork: ${accumulatedWorkTime}, AccumulatedBreak: ${accumulatedBreakTime}, TimerActive: ${timerState?.isActive}, Mode: ${timerState?.mode}`);
    
    // Calculate current session elapsed time (just the current session, not total)
    let currentSessionTime = 0;
    
    if (timerState) {
      // Calculate elapsed time in current session
      const totalTime = timerState.mode === 'pomodoro' ? pomodoroLength * 60 : breakLength * 60;
      const elapsedSeconds = totalTime - timerState.timeLeft;
      currentSessionTime = elapsedSeconds / 60;
    }
    
    // For display: always show accumulated time + current session time (whether active or paused)
    const displayWorkTime = accumulatedWorkTime + (timerState?.mode === 'pomodoro' ? currentSessionTime : 0);
    const displayBreakTime = accumulatedBreakTime + (timerState?.mode === 'break' ? currentSessionTime : 0);
    
    // Debug logging for display calculations
    console.log(`PersonalStats Display - WorkTime: ${displayWorkTime} (${accumulatedWorkTime} + ${timerState?.mode === 'pomodoro' ? currentSessionTime : 0}), BreakTime: ${displayBreakTime}`);
    
    return {
      totalWorkTime: formatDuration(displayWorkTime),
      totalBreakTime: formatDuration(displayBreakTime),
      completedSessions,
      currentSession,
      pomodoroLength,
      breakLength,
      isTimerActive: timerState?.isActive || false,
      currentMode: timerState?.mode || 'pomodoro'
    };
  };

  const renderSessionBars = (completedSessions, currentSession) => {
    // Only show bars up to current session, starting with 1 bar minimum
    const totalBars = Math.max(1, currentSession);
    const sessionHistory = currentUser?.sessionHistory || [];
    
    // Get timer settings
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

  const renderCurrentTimer = () => {
    if (!currentUser?.timerState) return null;

    const { timerState, name } = currentUser;
    
    return (
      <div className="partner-timer">
        <div className="partner-timer-header">
          <h4>Your Current Timer</h4>
          <div className={`timer-mode-display ${timerState.mode} ${timerState.isActive ? 'active' : 'paused'}`}>
            {timerState.mode === 'pomodoro' ? 'Focus Time' : 'Break Time'}
          </div>
        </div>
        
        <div className="partner-timer-display">
          <div className="timer-time">{formatTime(timerState.timeLeft)}</div>
          <div className={`timer-status ${timerState.isActive ? 'active' : 'paused'}`}>
            {timerState.isActive ? 'Running' : 'Paused'}
          </div>
        </div>
      </div>
    );
  };

  const personalStats = calculatePersonalStats();

  if (!personalStats) {
    return null;
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content personal-stats-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>📊 Your Study Statistics</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          <div className="partner-stats-section">




            <div className="stats-grid">
              <div className="stat-card work-time">
                <div className="stat-icon">📚</div>
                <div className="stat-content">
                  <div className="stat-value">{personalStats.totalWorkTime}</div>
                  <div className="stat-label">Total Work Time</div>
                </div>
              </div>

              <div className="stat-card break-time">
                <div className="stat-icon">☕</div>
                <div className="stat-content">
                  <div className="stat-value">{personalStats.totalBreakTime}</div>
                  <div className="stat-label">Total Break Time</div>
                </div>
              </div>

              <div className="stat-card sessions">
                <div className="stat-icon">🎯</div>
                <div className="stat-content">
                  <div className="stat-value">{personalStats.completedSessions}</div>
                  <div className="stat-label">Completed Sessions</div>
                </div>
              </div>
            </div>

            <div className="session-progress-section">
              <h4>Session Progress</h4>
              {renderSessionBars(personalStats.completedSessions, personalStats.currentSession)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PersonalStatsModal; 