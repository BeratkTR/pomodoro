import React, { useEffect } from 'react';

const TimerSection = ({ timerState, settings, onStart, onPause, onReset, onModeChange }) => {
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Update document title with timer
  useEffect(() => {
    const timeString = formatTime(timerState.timeLeft);
    document.title = timeString;
  }, [timerState.timeLeft]);

  const getModeDisplayName = (mode) => {
    switch (mode) {
      case 'pomodoro':
        return 'Focus Time';
      case 'break':
        return 'Break Time';
      default:
        return mode;
    }
  };

  const getModeColor = (mode, isActive = false) => {
    if (mode === 'pomodoro') {
      return isActive ? '#10b981' : '#f59e0b'; // Green when working, yellow when paused
    } else if (mode === 'break') {
      return isActive ? '#3b82f6' : '#f59e0b'; // Blue when on break, yellow when paused
    }
    return '#f59e0b'; // Default yellow for waiting
  };

  const getButtonColor = () => {
    // Use subtle white-based colors like the focus/break tabs
    if (timerState.isActive) {
      // When running, use a subtle pause color
      return 'rgba(255, 255, 255, 0.25)'; // Slightly more opaque for pause
    } else {
      // When paused, use a subtle start color  
      return 'rgba(255, 255, 255, 0.3)'; // Same as active mode tabs
    }
  };

  const getSectionStyle = () => {
    const baseStyle = {};
    const color = getModeColor(timerState.mode, timerState.isActive);
    
    // Add subtle box shadow to indicate current state
    baseStyle.boxShadow = `0 8px 32px rgba(0, 0, 0, 0.1), 0 0 20px ${color}20`;
    
    return baseStyle;
  };

  return (
    <div className="timer-section" style={getSectionStyle()}>
      <div className="timer-container">
        {/* Mode Tabs */}
        <div className="mode-tabs">
          <button 
            className={`mode-tab ${timerState.mode === 'pomodoro' ? 'active' : ''} ${timerState.isActive ? 'disabled' : ''}`}
            onClick={() => !timerState.isActive && onModeChange && onModeChange('pomodoro')}
            disabled={timerState.isActive}
          >
            Focus
          </button>
          <button 
            className={`mode-tab ${timerState.mode === 'break' ? 'active' : ''} ${timerState.isActive ? 'disabled' : ''}`}
            onClick={() => !timerState.isActive && onModeChange && onModeChange('break')}
            disabled={timerState.isActive}
          >
            Break
          </button>
        </div>

        <div 
          className="session-indicator"
          style={{ 
            color: getModeColor(timerState.mode, timerState.isActive),
            fontWeight: timerState.isActive ? '700' : '500'
          }}
        >
          {timerState.isActive 
            ? (timerState.mode === 'pomodoro' ? '🟢 Working - Session ' : '🔵 Break - Session ')
            : '🟡 Waiting - Session '
          }
          {timerState.currentSession}
        </div>

        <div 
          className="timer-display" 
          style={{ borderColor: getModeColor(timerState.mode, timerState.isActive) }}
        >
          {formatTime(timerState.timeLeft)}
        </div>

        <div className="timer-controls">
          <button 
            className={`timer-btn ${timerState.isActive ? 'pause-btn' : 'start-btn'}`}
            onClick={timerState.isActive ? onPause : onStart}
            style={{ backgroundColor: getButtonColor() }}
          >
            {timerState.isActive ? 'PAUSE' : 'START'}
          </button>
          
          <button 
            className="timer-btn reset-btn"
            onClick={onReset}
          >
            RESET
          </button>
        </div>
      </div>
    </div>
  );
};

export default TimerSection; 