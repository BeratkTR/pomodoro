import React, { useState, useEffect } from 'react';

const StudyPartners = ({ users = [], currentUserId, currentUser, currentRoom }) => {
  // State to force re-render for live updates
  const [, setUpdateTrigger] = useState(0);
  
  // Get partner (the other user that's not the current user)
  const partner = users.find(user => user.id !== currentUserId);

  // Update stats every second when any timer is active
  useEffect(() => {
    let intervalId;
    
    const anyTimerActive = users.some(user => user.timerState?.isActive);
    
    if (anyTimerActive) {
      intervalId = setInterval(() => {
        setUpdateTrigger(prev => prev + 1);
      }, 1000);
    }
    
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [users]);

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
      currentSessionTime = elapsedSeconds / 60;
    }
    
    // For display: always show accumulated time + current session time if timer is active
    const displayWorkTime = accumulatedWorkTime + (timerState?.mode === 'pomodoro' && timerState?.isActive ? currentSessionTime : 0);
    const displayBreakTime = accumulatedBreakTime + (timerState?.mode === 'break' && timerState?.isActive ? currentSessionTime : 0);
    
    return {
      totalWorkTime: formatDuration(displayWorkTime),
      totalBreakTime: formatDuration(displayBreakTime),
      completedSessions,
      currentSession
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

  const renderPartnerTimer = (partner) => {
    if (!partner || !partner.timerState) return null;

    const { timerState, name, status } = partner;
    const isOffline = status === 'offline';
    
    return (
      <div className={`partner-timer ${isOffline ? 'offline' : ''}`}>
        <div className="partner-timer-header">
          <h4>{name}'s Timer</h4>
          <div className={`timer-mode-display ${timerState.mode} ${isOffline ? 'offline' : (timerState.isActive ? 'active' : 'paused')}`}>
            {timerState.mode === 'pomodoro' ? 'Focus Time' : 'Break Time'}
          </div>
        </div>
        
        <div className="partner-timer-display">
          <div className="timer-time">{formatTime(timerState.timeLeft)}</div>
          <div className={`timer-status ${isOffline ? 'offline' : (timerState.isActive ? 'active' : 'paused')}`}>
            {isOffline ? 'Offline' : (timerState.isActive ? 'Running' : 'Paused')}
          </div>
        </div>
      </div>
    );
  };

  const partnerStats = partner ? calculatePartnerStats(partner) : null;

  return (
    <div className="study-partners">
      {partner ? (
        <div className={`partner-stats-section ${partner.status === 'offline' ? 'offline' : ''}`}>
          <div className="partner-header">
            <h3>Study Partner: {partner.name}</h3>
            <div className={`partner-status ${partner.status === 'offline' ? 'offline' : 'online'}`}>
              {partner.status === 'offline' ? '🔴 Offline' : '🟢 Online'}
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
             <div className="progress-info">
               <span>Session {partnerStats.currentSession} • {partnerStats.completedSessions} completed</span>
             </div>
             {renderSessionBars(partnerStats.completedSessions, partnerStats.currentSession)}
           </div>
        </div>
      ) : (
        <div className="no-partner">
          <div className="waiting-for-partner">
            <h4>Waiting for study partner...</h4>
            <p>Share the room ID with a friend to start studying together!</p>
            {currentRoom && (
              <div className="room-id-display">
                <span className="room-id-label">Room ID:</span>
                <span className="room-id">{currentRoom.id}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default StudyPartners; 