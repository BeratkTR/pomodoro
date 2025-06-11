import React, { useState, useEffect } from 'react';
import { formatLastActive } from '../utils/timeUtils';
import DeadTimeBar from './DeadTimeBar';
import { calculateDeadTimeGaps } from '../utils/deadTimeUtils';

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
  
  if (historyIndex < sessionHistory.length) {
    const sessionType = sessionHistory[historyIndex].type;
    const sessionData = sessionHistory[historyIndex];
    const isPartial = sessionData.isPartial;
    barClass += ` completed ${sessionType}${isPartial ? ' partial' : ''}`;
    
    // For completed sessions, use the actual duration that was completed
    // If duration is stored in session history, use that; otherwise fall back to current settings
    const sessionDuration = sessionData.duration || (sessionType === 'pomodoro' ? pomodoroLength : breakLength);
    tooltipText = `${formatBubbleDuration(sessionDuration)}`;
    barWidth = calculateBarWidth(sessionDuration);
    
    console.log(`✅ Completed session ${sessionNum}: type=${sessionType}, actualDuration=${sessionDuration}min, tier=${getTierDescription(sessionDuration)}, width=${barWidth}px, isPartial=${isPartial}`);
  } else if (sessionNum === currentSession) {
    // Current session - show as yellow/pending with pulse
    barClass += ' current';
    
    // Calculate elapsed time for current session
    if (currentTimerState) {
      const totalTime = currentTimerState.mode === 'pomodoro' ? pomodoroLength * 60 : breakLength * 60;
      const elapsedSeconds = totalTime - currentTimerState.timeLeft;
      // Cap elapsed time to not exceed expected duration
      const cappedElapsedSeconds = Math.min(elapsedSeconds, totalTime);
      const elapsedMinutes = Math.max(0, cappedElapsedSeconds / 60);
      
      tooltipText = `${formatBubbleDuration(elapsedMinutes)}`;
      barWidth = calculateBarWidth(elapsedMinutes);
      console.log(`⏱️ Current session ${sessionNum}: elapsed=${elapsedMinutes.toFixed(1)}min, tier=${getTierDescription(elapsedMinutes)}, width=${barWidth}px`);
    } else {
      tooltipText = `0m`;
      barWidth = calculateBarWidth(0.5); // Show very small bar for 0 time
      console.log(`⭕ Current session ${sessionNum}: not started, tier=${getTierDescription(0.5)}, width=${barWidth}px`);
    }
  } else {
    // Future sessions - show as grey pending
    barClass += ' pending';
    tooltipText = `Pending`;
    // Use a small default width for pending sessions
    const pendingDuration = pomodoroLength * 0.3;
    barWidth = calculateBarWidth(pendingDuration); // 30% of expected duration for pending
    console.log(`⏳ Pending session ${sessionNum}: expected=${pomodoroLength}min (30% = ${pendingDuration.toFixed(1)}min), tier=${getTierDescription(pendingDuration)}, width=${barWidth}px`);
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

const StudyPartners = ({ users = [], currentUserId, currentUser, currentRoom, onShowPartnerStats }) => {
  // State to force re-render for live updates
  const [, setUpdateTrigger] = useState(0);
  
  // Get partner (the other user that's not the current user)
  const partner = users.find(user => user.id !== currentUserId);
  
  // Debug logging
  if (partner) {
    console.log('Partner data:', {
      name: partner.name,
      status: partner.status,
      lastActivity: partner.lastActivity,
      hasLastActivity: !!partner.lastActivity
    });
  }

  // Update stats every second when any timer is active, or every minute to update "last active" times
  useEffect(() => {
    let intervalId;
    
    const anyTimerActive = users.some(user => user.timerState?.isActive);
    const hasOfflinePartners = users.some(user => user.id !== currentUserId && user.status === 'offline');
    
    if (anyTimerActive) {
      // Update every second when timers are active
      intervalId = setInterval(() => {
        setUpdateTrigger(prev => prev + 1);
      }, 1000);
    } else if (hasOfflinePartners) {
      // Update every minute to refresh "last active" times when there are offline partners
      intervalId = setInterval(() => {
        setUpdateTrigger(prev => prev + 1);
      }, 60000);
    }
    
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [users, currentUserId]);

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
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Calculate partner stats with live updates
  const calculatePartnerStats = (partner) => {
    if (!partner) return null;

    const completedSessions = partner.completedSessions || 0;
    const currentSession = partner.timerState?.currentSession || 1;
    const timerState = partner.timerState;
    
    // Get timer settings
    const pomodoroLength = partner.settings?.pomodoro || 50;
    const breakLength = partner.settings?.break || 10;
    
    // Get accumulated times from server (these persist across rooms)
    const accumulatedWorkTime = partner.totalWorkTime || 0;
    const accumulatedBreakTime = partner.totalBreakTime || 0;
    
    // Debug logging  
    console.log(`StudyPartners Debug - Partner: ${partner.name}, AccumulatedWork: ${accumulatedWorkTime}, AccumulatedBreak: ${accumulatedBreakTime}`);
    
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
    
    return {
      totalWorkTime: formatDuration(displayWorkTime),
      totalBreakTime: formatDuration(displayBreakTime),
      completedSessions,
      currentSession
    };
  };

  const renderSessionBars = (completedSessions, currentSession, partner) => {
    // Only show bars up to current session, starting with 1 bar minimum
    const totalBars = Math.max(1, currentSession);
    const sessionHistory = partner?.sessionHistory || [];
    const deadTimeGaps = calculateDeadTimeGaps(sessionHistory);
    
    // Get partner timer settings
    const pomodoroLength = partner?.settings?.pomodoro || 50;
    const breakLength = partner?.settings?.break || 10;
    
    // DEBUG: Log the settings being used
    console.log(`🔍 SETTINGS DEBUG - Pomodoro: ${pomodoroLength}min, Break: ${breakLength}min`);
    console.log(`🔍 SESSION HISTORY:`, sessionHistory);
    
    // Debug logging for dead time gaps
    if (deadTimeGaps.length > 0) {
      console.log('🔍 Partner dead time gaps found:', deadTimeGaps);
    }
    
    const elements = [];
    
    for (let index = 0; index < totalBars; index++) {
      const sessionNum = index + 1;
      const historyIndex = index;
      
      // Add session bar
      elements.push(
        <SessionBar 
          key={`session-${sessionNum}`}
          sessionNum={sessionNum}
          historyIndex={historyIndex}
          sessionHistory={sessionHistory}
          pomodoroLength={pomodoroLength}
          breakLength={breakLength}
          currentSession={currentSession}
          currentTimerState={partner?.timerState}
        />
      );
      
      // Check if there's a dead time gap after this session
      const gapAfterThisSession = deadTimeGaps.find(gap => gap.afterSessionIndex === historyIndex);
      if (gapAfterThisSession) {
        elements.push(
          <DeadTimeBar
            key={`deadtime-${historyIndex}`}
            duration={gapAfterThisSession.duration}
            gapIndex={historyIndex}
          />
        );
      }
    }
    
    return (
      <div className="session-progress-bars">
        {elements}
      </div>
    );
  };

  const renderPartnerTimer = (partner) => {
    if (!partner || !partner.timerState) return null;

    const { timerState, name, status } = partner;
    const isOffline = status === 'offline';
    
    // Get partner timer settings
    const pomodoroLength = partner.settings?.pomodoro || 50;
    const breakLength = partner.settings?.break || 10;
    
    // Check if partner's timer has been started (time left is less than full duration)
    const fullDuration = timerState.mode === 'pomodoro' 
      ? pomodoroLength * 60 
      : breakLength * 60;
    const sessionInProgress = timerState.timeLeft < fullDuration;
    
    // Determine if partner is doing "nothing" (timer not started in any mode)
    const isDoingNothing = !sessionInProgress;
    
    // Determine border color based on partner's timer state
    let borderStyle = '1px solid rgba(255, 255, 255, 0.1)'; // Default border
    let boxShadowStyle = '';
    
    if (!isOffline && sessionInProgress) {
      if (timerState.isActive) {
        // Partner's timer is running
        if (timerState.mode === 'pomodoro') {
          borderStyle = '1px solid #10b981'; // Green for working
          boxShadowStyle = '0 4px 20px rgba(16, 185, 129, 0.3)';
        } else if (timerState.mode === 'break') {
          borderStyle = '1px solid #3b82f6'; // Blue for break
          boxShadowStyle = '0 4px 20px rgba(59, 130, 246, 0.3)';
        }
      } else {
        // Partner's timer is paused/waiting
        borderStyle = '1px solid #f59e0b'; // Yellow for waiting/paused
        boxShadowStyle = '0 4px 20px rgba(245, 158, 11, 0.3)';
      }
    }
    
    return (
      <div 
        className={`partner-timer ${isOffline ? 'offline' : ''}`}
        style={{ 
          border: borderStyle,
          boxShadow: boxShadowStyle || undefined
        }}
      >
        <div className="partner-timer-header">
          <h4>{name}'s Timer</h4>
          <div className={`timer-mode-display ${timerState.mode} ${isOffline ? 'offline' : (isDoingNothing ? 'nothing' : (timerState.isActive ? 'active' : 'paused'))}`}>
            {timerState.mode === 'pomodoro' ? 'Focus' : 'Break'}
          </div>
        </div>
        
        <div className="partner-timer-display">
          <div className="timer-time">{formatTime(timerState.timeLeft)}</div>
          {!isOffline && (
            <div className={`timer-status ${timerState.isActive ? 'active' : (isDoingNothing ? 'waiting' : 'paused')}`}>
              {timerState.isActive ? 'Running' : (isDoingNothing ? 'Waiting' : 'Paused')}
            </div>
          )}
        </div>
      </div>
    );
  };

  const partnerStats = partner ? calculatePartnerStats(partner) : null;

  // Calculate current user's stats for solo mode
  const currentUserStats = currentUser ? calculatePartnerStats(currentUser) : null;

  return (
    <div className="study-partners">
      {partner ? (
        <div className={`partner-stats-section ${partner.status === 'offline' ? 'offline' : ''}`}>
          <div className="partner-header">
            <div 
              className="partner-name-display clickable" 
              onClick={() => onShowPartnerStats && onShowPartnerStats(partner)}
              title="View partner's statistics"
            >
              <span style={{marginRight: '6px'}}>👤</span>{partner.name}
            </div>
            <div className="partner-status-container">
              {partner.status === 'offline' ? (
                <div className="last-active-tag">
                  <span>Last active: </span>
                  <span className="last-active-time">
                    {partner.lastActivity ? 
                      formatLastActive(partner.lastActivity) : 
                      formatLastActive(Date.now() - 8 * 24 * 60 * 60 * 1000) // Test: 8 days ago (to show date format)
                    }
                  </span>
                </div>
              ) : (
                <div className={`partner-status online`}>
                  🟢 Online
                </div>
              )}
            </div>
          </div>

                     {/* Partner's Timer */}
           {renderPartnerTimer(partner)}

           <div className="stats-grid">
             <div className="stat-card work-time">
               <div className="stat-icon">📚</div>
               <div className="stat-content">
                 <div className="stat-value">{partnerStats.totalWorkTime}</div>
                 <div className="stat-label">Total Work Time</div>
               </div>
             </div>

             <div className="stat-card break-time">
               <div className="stat-icon">☕</div>
               <div className="stat-content">
                 <div className="stat-value">{partnerStats.totalBreakTime}</div>
                 <div className="stat-label">Total Break Time</div>
               </div>
             </div>

             <div className="stat-card sessions">
               <div className="stat-icon">🎯</div>
               <div className="stat-content">
                 <div className="stat-value">{partnerStats.completedSessions}</div>
                 <div className="stat-label">Completed Sessions</div>
               </div>
             </div>
           </div>

           <div className="session-progress-section">
             <h4>Session Progress</h4>
             {renderSessionBars(partnerStats.completedSessions, partnerStats.currentSession, partner)}
           </div>
        </div>
      ) : (
        <div className="partner-stats-section">
          <div className="partner-header">
            <div className="partner-name-display"><span style={{marginRight: '6px'}}>📊</span>Your Progress</div>
            <div className="partner-status-container">
              <div className="waiting-for-partner">
                <h4>Waiting for study partner...</h4>
                <p>Share the room ID with a friend!</p>
                {currentRoom && (
                  <div className="room-id-display">
                    <span className="room-id-label">Room ID:</span>
                    <span className="room-id">{currentRoom.id}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {currentUserStats && (
            <div className="stats-grid">
              <div className="stat-card work-time">
                <div className="stat-icon">📚</div>
                <div className="stat-content">
                  <div className="stat-value">{currentUserStats.totalWorkTime}</div>
                  <div className="stat-label">Total Work Time</div>
                </div>
              </div>

              <div className="stat-card break-time">
                <div className="stat-icon">☕</div>
                <div className="stat-content">
                  <div className="stat-value">{currentUserStats.totalBreakTime}</div>
                  <div className="stat-label">Total Break Time</div>
                </div>
              </div>

              <div className="stat-card sessions">
                <div className="stat-icon">🎯</div>
                <div className="stat-content">
                  <div className="stat-value">{currentUserStats.completedSessions}</div>
                  <div className="stat-label">Completed Sessions</div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default StudyPartners; 