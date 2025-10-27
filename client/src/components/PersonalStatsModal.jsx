import React, { useState, useEffect } from 'react';

// Session bar component with tooltip - memoized to prevent unnecessary re-renders
const SessionBar = React.memo(({ 
  sessionNum, 
  historyIndex, 
  sessionHistory, 
  pomodoroLength, 
  breakLength, 
  currentSession, 
  currentTimerState,
  onSessionClick,
  isHistorical 
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
  
  // Calculate the width based on duration (smooth scaling - consistent with SessionProgress)
  const calculateBarWidth = (durationMinutes) => {
    const minWidth = 20;
    const maxWidth = 60;
    const minDuration = 5;
    const maxDuration = 120;
    
    const clampedDuration = Math.max(minDuration, Math.min(maxDuration, durationMinutes));
    const normalizedDuration = (clampedDuration - minDuration) / (maxDuration - minDuration);
    
    return minWidth + (normalizedDuration * (maxWidth - minWidth));
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
  let hasNotes = false;
  let sessionInfo = null;
  let isCurrent = false;
  
  if (historyIndex < sessionHistory.length) {
    const sessionType = sessionHistory[historyIndex].type;
    const sessionData = sessionHistory[historyIndex];
    const isPartial = sessionData.isPartial;
    barClass += ` completed ${sessionType}${isPartial ? ' partial' : ''}`;
    
    // Check if this session has notes (only for pomodoro sessions)
    hasNotes = sessionData.type === 'pomodoro' && !!(sessionData.notes && sessionData.notes.trim().length > 0);
    sessionInfo = sessionData;
    
    // For completed sessions, use the actual duration that was completed
    // If duration is stored in session history, use that; otherwise fall back to current settings
    const sessionDuration = sessionData.duration || (sessionType === 'pomodoro' ? pomodoroLength : breakLength);
    tooltipText = `${formatBubbleDuration(sessionDuration)}`;
    barWidth = calculateBarWidth(sessionDuration);
    console.log(`✅ Personal Stats Completed session ${sessionNum}: type=${sessionType}, actualDuration=${sessionDuration}min, tier=${getTierDescription(sessionDuration)}, width=${barWidth}px, isPartial=${isPartial}`);
  } else if (sessionNum === currentSession) {
    isCurrent = true;
    // Current session - show as yellow/pending with pulse
    barClass += ' current';
    
    // Check if current session has notes (only for pomodoro mode)
    // Note: We can't access currentUser here, so hasNotes will be false for current session in this modal
    // This is okay since the modal is for historical/stats view, not for live editing
    
    // Calculate elapsed time for current session
    if (currentTimerState) {
      const totalTime = currentTimerState.mode === 'pomodoro' ? pomodoroLength * 60 : breakLength * 60;
      const elapsedSeconds = totalTime - currentTimerState.timeLeft;
      // Cap elapsed time to not exceed expected duration
      const cappedElapsedSeconds = Math.min(elapsedSeconds, totalTime);
      const elapsedMinutes = Math.max(0, cappedElapsedSeconds / 60);
      
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
  
  const handleClick = () => {
    // Only allow clicking on pomodoro sessions (not breaks) for notes
    const isPomodoro = sessionInfo?.type === 'pomodoro';
    
    if (!isPomodoro) {
      console.log('⏸️ Ignoring click on break session in PersonalStatsModal - notes only for pomodoros');
      return;
    }
    
    if (onSessionClick) {
      // Allow clicking on all pomodoro sessions (both today and historical)
      // Historical sessions will open as read-only in the parent
      if (historyIndex < sessionHistory.length) {
        // Completed pomodoro session
        console.log('📝 PersonalStatsModal - Opening session:', { historyIndex, sessionInfo, isHistorical });
        onSessionClick(historyIndex, sessionInfo, false, false);
      } else if (isCurrent && !isHistorical) {
        // Current session (only in today's view)
        onSessionClick(historyIndex, sessionInfo || {}, true, false);
      }
    }
  };

  // Pomodoro completed sessions are always clickable (even in history)
  const isClickableSession = sessionInfo?.type === 'pomodoro' && historyIndex < sessionHistory.length;
  
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
          maxWidth: `${barWidth}px`,
          cursor: isClickableSession ? 'pointer' : 'default'
        }}
        onClick={handleClick}
      >
        <div className="bar-fill"></div>
        {hasNotes && <div className="notes-indicator" title="Has notes">📝</div>}
      </div>
      {showTooltip && (
        <div className="session-tooltip">
          {tooltipText}
        </div>
      )}
    </div>
  );
});

const PersonalStatsModal = ({ onClose, currentUser, onSessionClick }) => {
  // State to force re-render for live updates
  const [, setUpdateTrigger] = useState(0);
  
  // State for tab switching
  const [activeTab, setActiveTab] = useState('today'); // 'today' or 'history'
  const [selectedHistoryDate, setSelectedHistoryDate] = useState(null);

  // Set the first available historical date when switching to history tab
  useEffect(() => {
    if (activeTab === 'history' && !selectedHistoryDate) {
      const dates = getHistoricalDates();
      if (dates.length > 0) {
        setSelectedHistoryDate(dates[0]); // Set to most recent date
      }
    }
  }, [activeTab]);

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

  // Format time function as hours:minutes:seconds (e.g., 1:45:12 for 1 hour 45 minutes 12 seconds)
  const formatDuration = (totalMinutes) => {
    const totalSeconds = Math.round(totalMinutes * 60);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    } else {
      return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }
  };

  // Format time for timer display
  const formatTime = (seconds) => {
    const totalSeconds = Math.floor(seconds); // Convert to whole seconds
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Format date for display
  const formatDate = (dateString) => {
    const date = new Date(dateString + 'T00:00:00');
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const dateStr = date.toISOString().split('T')[0];
    const todayStr = today.toISOString().split('T')[0];
    const yesterdayStr = yesterday.toISOString().split('T')[0];
    
    if (dateStr === todayStr) return 'Today';
    if (dateStr === yesterdayStr) return 'Yesterday';
    
    return date.toLocaleDateString('en-US', { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric',
      year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined
    });
  };

  // Get historical dates
  const getHistoricalDates = () => {
    if (!currentUser?.dailyHistory) return [];
    return Object.keys(currentUser.dailyHistory).sort().reverse(); // Most recent first
  };

  // Get stats for a specific historical date
  const getHistoricalStats = (dateString) => {
    if (!currentUser?.dailyHistory?.[dateString]) return null;
    
    const historyData = currentUser.dailyHistory[dateString];
    return {
      totalWorkTime: formatDuration(historyData.totalWorkTime || 0),
      totalBreakTime: formatDuration(historyData.totalBreakTime || 0),
      completedSessions: historyData.completedSessions || 0,
      sessionHistory: historyData.sessionHistory || []
    };
  };

  // Calculate personal stats with live updates
  const calculatePersonalStats = () => {
    if (!currentUser) return null;
    
    // Use today-only session history for counts shown in modal's Today tab
    const fullSessionHistory = currentUser.sessionHistory || [];
    const today = new Date();
    const todaysHistory = fullSessionHistory.filter(s => s?.completedAt && (new Date(s.completedAt)).getDate() === today.getDate() && (new Date(s.completedAt)).getMonth() === today.getMonth() && (new Date(s.completedAt)).getFullYear() === today.getFullYear());
    const completedSessions = todaysHistory.length;
    const currentSession = Math.max(1, completedSessions + 1);
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
      // Cap elapsed time to not exceed expected duration
      const cappedElapsedSeconds = Math.min(elapsedSeconds, totalTime);
      currentSessionTime = Math.max(0, cappedElapsedSeconds / 60);
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

  const renderSessionBars = (completedSessions, currentSession, sessionHistory = null, isHistorical = false) => {
    // Use provided sessionHistory or fall back to current user's TODAY-ONLY history
    const today = new Date();
    const baseHistory = sessionHistory || currentUser?.sessionHistory || [];
    const historyToUse = isHistorical
      ? baseHistory
      : baseHistory.filter(s => s?.completedAt && (new Date(s.completedAt)).getDate() === today.getDate() && (new Date(s.completedAt)).getMonth() === today.getMonth() && (new Date(s.completedAt)).getFullYear() === today.getFullYear());
    
    // Check if this is a fresh day (after daily reset) - only for current day view
    const isFreshDay = !isHistorical && historyToUse.length === 0 && completedSessions === 0;
    
    // For historical data, show all completed sessions; for current day, show up to current session
    const totalBars = isHistorical ? historyToUse.length : (isFreshDay ? 1 : Math.max(1, currentSession));
    
    // Get timer settings
    const pomodoroLength = currentUser?.settings?.pomodoro || 50;
    const breakLength = currentUser?.settings?.break || 10;
    
    if (totalBars === 0) {
      return (
        <div className="session-progress-bars">
          <div className="no-sessions-message">No sessions completed on this day</div>
        </div>
      );
    }
    
    return (
      <div className="session-progress-bars">
        {Array.from({ length: totalBars }, (_, index) => {
          const sessionNum = index + 1;
          const historyIndex = index;
          
          // For fresh day, force the first session to be treated as current session
          const effectiveCurrentSession = isHistorical 
            ? historyToUse.length + 1 
            : (isFreshDay ? 1 : currentSession);
          
          return (
            <SessionBar 
              key={sessionNum}
              sessionNum={sessionNum}
              historyIndex={historyIndex}
              sessionHistory={historyToUse}
              pomodoroLength={pomodoroLength}
              breakLength={breakLength}
              currentSession={effectiveCurrentSession}
              currentTimerState={isHistorical ? null : currentUser?.timerState}
              onSessionClick={onSessionClick}
              isHistorical={isHistorical}
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
          {/* Tab Navigation */}
          <div className="stats-tabs">
            <button 
              className={`tab-btn ${activeTab === 'today' ? 'active' : ''}`}
              onClick={() => setActiveTab('today')}
            >
              📅 Today
            </button>
            <button 
              className={`tab-btn ${activeTab === 'history' ? 'active' : ''}`}
              onClick={() => setActiveTab('history')}
            >
              📊 History
            </button>
          </div>

          {/* Today Tab Content */}
          {activeTab === 'today' && (
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
                <h4>Today's Session Progress</h4>
                {renderSessionBars(personalStats.completedSessions, personalStats.currentSession)}
              </div>
            </div>
          )}

          {/* History Tab Content */}
          {activeTab === 'history' && (
            <div className="partner-stats-section">
              <div className="history-section">
                {getHistoricalDates().length === 0 ? (
                  <div className="no-history-message">
                    <p>No historical data available yet.</p>
                    <p>Complete some sessions and check back tomorrow!</p>
                  </div>
                ) : (
                  <>
                    <div className="history-dates">
                      <h4>Select a Date</h4>
                      <div className="date-buttons">
                        {getHistoricalDates().map(dateString => (
                          <button
                            key={dateString}
                            className={`date-btn ${selectedHistoryDate === dateString ? 'active' : ''}`}
                            onClick={() => setSelectedHistoryDate(dateString)}
                          >
                            {formatDate(dateString)}
                          </button>
                        ))}
                      </div>
                    </div>

                    {selectedHistoryDate && (() => {
                      const histStats = getHistoricalStats(selectedHistoryDate);
                      return histStats ? (
                        <div className="historical-stats">
                          <h4>{formatDate(selectedHistoryDate)} - Statistics</h4>
                          
                          <div className="stats-grid">
                            <div className="stat-card work-time">
                              <div className="stat-icon">📚</div>
                              <div className="stat-content">
                                <div className="stat-value">{histStats.totalWorkTime}</div>
                                <div className="stat-label">Work Time</div>
                              </div>
                            </div>

                            <div className="stat-card break-time">
                              <div className="stat-icon">☕</div>
                              <div className="stat-content">
                                <div className="stat-value">{histStats.totalBreakTime}</div>
                                <div className="stat-label">Break Time</div>
                              </div>
                            </div>

                            <div className="stat-card sessions">
                              <div className="stat-icon">🎯</div>
                              <div className="stat-content">
                                <div className="stat-value">{histStats.completedSessions}</div>
                                <div className="stat-label">Sessions</div>
                              </div>
                            </div>
                          </div>

                          <div className="session-progress-section">
                            <h4>Session Progress</h4>
                            {renderSessionBars(
                              histStats.completedSessions,
                              histStats.sessionHistory.length,
                              histStats.sessionHistory,
                              true
                            )}
                          </div>
                        </div>
                      ) : null;
                    })()}
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PersonalStatsModal; 