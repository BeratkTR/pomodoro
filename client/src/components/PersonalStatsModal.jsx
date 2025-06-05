import React, { useState, useEffect } from 'react';

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
    
    // Calculate current session elapsed time (just the current session, not total)
    let currentSessionTime = 0;
    
    if (timerState) {
      // Calculate elapsed time in current session
      const totalTime = timerState.mode === 'pomodoro' ? pomodoroLength * 60 : breakLength * 60;
      const elapsedSeconds = totalTime - timerState.timeLeft;
      currentSessionTime = elapsedSeconds / 60;
    }
    
    // For display: show current session time for the active mode, accumulated time for the other
    const displayWorkTime = timerState?.mode === 'pomodoro' ? currentSessionTime : accumulatedWorkTime;
    const displayBreakTime = timerState?.mode === 'break' ? currentSessionTime : accumulatedBreakTime;
    
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
    const totalBars = Math.max(8, currentSession); // Show at least 8 bars
    
    return (
      <div className="session-progress-bars">
        {Array.from({ length: totalBars }, (_, index) => {
          const sessionNum = index + 1;
          let barClass = 'session-bar';
          
          if (sessionNum <= completedSessions) {
            barClass += ' completed';
          } else if (sessionNum === currentSession) {
            barClass += ' current';
          } else {
            barClass += ' pending';
          }
          
          return (
            <div key={sessionNum} className={barClass}>
              <div className="bar-fill"></div>
            </div>
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
              <div className="progress-info">
                <span>Session {personalStats.currentSession} • {personalStats.completedSessions} completed</span>
              </div>
              {renderSessionBars(personalStats.completedSessions, personalStats.currentSession)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PersonalStatsModal; 