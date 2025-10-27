import React, { useEffect, useRef, useCallback } from 'react';
import SessionProgress from './SessionProgress';

const TimerSection = ({ timerState, settings, onStart, onPause, onReset, onModeChange, onSkipToBreak, onSkipToFocus, currentUser, timerActionInProgress, onSessionClick }) => {
  // Refs for timer buttons to fix cursor issue
  const startPauseBtnRef = useRef(null);
  const resetBtnRef = useRef(null);
  const skipBtnRef = useRef(null);

  // Safety check - prevent component from disappearing if timerState is corrupted
  if (!timerState) {
    console.error('❌ TimerSection: timerState is undefined/null!', { timerState, currentUser })
    return (
      <div className="timer-section">
        <div className="timer-container">
          <div className="timer-display">--:--</div>
          <div className="timer-error">Timer state corrupted - please refresh page</div>
        </div>
      </div>
    );
  }
  
  const formatTime = (seconds) => {
    const totalSeconds = Math.floor(seconds || 0); // Convert to whole seconds, default to 0
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Update document title with timer
  useEffect(() => {
    const timeString = formatTime(timerState.timeLeft);
    document.title = timeString;
  }, [timerState.timeLeft]);

  // Fix cursor issue by forcing cursor on timer buttons
  useEffect(() => {
    const fixCursor = () => {
      if (startPauseBtnRef.current) {
        startPauseBtnRef.current.style.cursor = 'pointer';
      }
      if (resetBtnRef.current) {
        resetBtnRef.current.style.cursor = 'pointer';
      }
      if (skipBtnRef.current) {
        skipBtnRef.current.style.cursor = 'pointer';
      }
    };

    // Fix cursor immediately
    fixCursor();

    // Fix cursor after any state change
    const timeoutId = setTimeout(fixCursor, 0);
    
    return () => clearTimeout(timeoutId);
  }, [timerState.isActive, timerState.timeLeft, timerState.mode]);

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
    
    // Check if there's progress in the current session (timer started but not at full time)
    const sessionInProgress = isSessionInProgress();
    
    // Add colored border based on timer state
    if (sessionInProgress) {
      if (timerState.isActive) {
        // Timer is running
        if (timerState.mode === 'pomodoro') {
          baseStyle.border = '1px solid #10b981'; // Green for working
          baseStyle.boxShadow = `0 8px 32px rgba(0, 0, 0, 0.1), 0 0 25px rgba(16, 185, 129, 0.4)`;
        } else if (timerState.mode === 'break') {
          baseStyle.border = '1px solid #3b82f6'; // Blue for break
          baseStyle.boxShadow = `0 8px 32px rgba(0, 0, 0, 0.1), 0 0 25px rgba(59, 130, 246, 0.4)`;
        }
      } else {
        // Timer is paused/waiting
        baseStyle.border = '1px   solid #f59e0b'; // Yellow for waiting/paused
        baseStyle.boxShadow = `0 8px 32px rgba(0, 0, 0, 0.1), 0 0 25px rgba(245, 158, 11, 0.4)`;
      }
    } else {
      // Timer hasn't been started - keep original border
      baseStyle.border = '1px solid rgba(255, 255, 255, 0.2)';
    }
    
    return baseStyle;
  };

  // Check if there's progress in the current session (timer started but not at full time)
  const isSessionInProgress = () => {
    const currentMode = timerState.mode;
    const timeLeft = timerState.timeLeft;
    
    // Get the full duration for the current mode
    const fullDuration = currentMode === 'pomodoro' 
      ? (settings?.pomodoro || 50) * 60 
      : (settings?.break || 10) * 60;
    
    // Session is in progress if time left is less than full duration
    // This means the timer has been started at some point (whether it's running or paused)
    const inProgress = timeLeft < fullDuration;
    
    console.log('🔍 TimerSection isSessionInProgress check:', {
      mode: currentMode,
      timeLeft,
      fullDuration,
      inProgress,
      settings
    });
    
    return inProgress;
  };

  console.log('🎯 TimerSection rendering with state:', {
    timerState,
    settings,
    currentUser: currentUser?.name
  });

  return (
    <div className="timer-section" style={getSectionStyle()}>
      <div className="timer-container">
        {/* Mode Tabs */}
        <div className="mode-tabs">
          <button 
            className={`mode-tab ${timerState.mode === 'pomodoro' ? 'active' : ''} ${isSessionInProgress() ? 'disabled' : ''}`}
            onClick={() => !isSessionInProgress() && onModeChange && onModeChange('pomodoro')}
            disabled={isSessionInProgress()}
            style={{ cursor: isSessionInProgress() ? 'not-allowed' : 'pointer' }}
          >
            Focus
          </button>
          <button 
            className={`mode-tab ${timerState.mode === 'break' ? 'active' : ''} ${isSessionInProgress() ? 'disabled' : ''}`}
            onClick={() => !isSessionInProgress() && onModeChange && onModeChange('break')}
            disabled={isSessionInProgress()}
            style={{ cursor: isSessionInProgress() ? 'not-allowed' : 'pointer' }}
          >
            Break
          </button>
        </div>



        <div 
          className="timer-display" 
          style={{ borderColor: getModeColor(timerState.mode, timerState.isActive) }}
        >
          {formatTime(timerState.timeLeft)}
        </div>

        <div className="timer-controls">
          <button 
            ref={startPauseBtnRef}
            className={`timer-btn ${timerState.isActive ? 'pause-btn' : 'start-btn'}`}
            onClick={timerState.isActive ? onPause : onStart}
            style={{ backgroundColor: getButtonColor(), cursor: 'pointer' }}
          >
            {timerState.isActive ? 'PAUSE' : 'START'}
          </button>
          
          <button 
            ref={resetBtnRef}
            className="timer-btn reset-btn"
            onClick={onReset}
            style={{ cursor: 'pointer' }}
          >
            RESET
          </button>

          {timerState.mode === 'pomodoro' && onSkipToBreak && (
            <button 
              ref={skipBtnRef}
              className={`timer-btn skip-btn ${!isSessionInProgress() ? 'disabled' : ''}`}
              onClick={isSessionInProgress() ? onSkipToBreak : undefined}
              disabled={!isSessionInProgress()}
              style={{ cursor: isSessionInProgress() ? 'pointer' : 'not-allowed' }}
              title={isSessionInProgress() ? "Skip to break (keeps accumulated work time)" : "Start the timer first to enable skip"}
            >
              →
            </button>
          )}

          {timerState.mode === 'break' && onSkipToFocus && (
            <button 
              ref={skipBtnRef}
              className={`timer-btn skip-to-focus-btn ${!isSessionInProgress() ? 'disabled' : ''}`}
              onClick={isSessionInProgress() ? onSkipToFocus : undefined}
              disabled={!isSessionInProgress()}
              style={{ cursor: isSessionInProgress() ? 'pointer' : 'not-allowed' }}
              title={isSessionInProgress() ? "Skip to focus (keeps accumulated break time)" : "Start the timer first to enable skip"}
            >
              →
            </button>
          )}
        </div>
      </div>
      
      {/* Session Progress Section */}
      <SessionProgress currentUser={currentUser} onSessionClick={onSessionClick} />
    </div>
  );
};

export default TimerSection; 