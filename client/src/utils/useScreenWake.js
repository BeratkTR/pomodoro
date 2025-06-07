import { useEffect, useRef, useState, useCallback } from 'react';
import NoSleep from 'nosleep.js';

const useScreenWake = (isActive) => {
  const noSleepRef = useRef(null);
  const [isScreenWakeActive, setIsScreenWakeActive] = useState(false);
  const [isSupported, setIsSupported] = useState(true);

  // Initialize NoSleep instance
  useEffect(() => {
    noSleepRef.current = new NoSleep();
    
    // Check if NoSleep is supported
    setIsSupported(true); // NoSleep.js handles cross-browser compatibility internally
    
    return () => {
      // Cleanup on unmount
      if (noSleepRef.current && isScreenWakeActive) {
        try {
          noSleepRef.current.disable();
        } catch (error) {
          console.error('Error disabling NoSleep on cleanup:', error);
        }
      }
    };
  }, []);

  // Start screen wake prevention
  const startScreenWake = useCallback(async () => {
    if (!noSleepRef.current) {
      console.log('NoSleep not initialized');
      return;
    }

    if (isScreenWakeActive) {
      console.log('Screen wake already active');
      return;
    }

    try {
      await noSleepRef.current.enable();
      setIsScreenWakeActive(true);
      console.log('NoSleep activated - screen will stay awake');
    } catch (error) {
      console.error('Failed to enable NoSleep:', error);
      // NoSleep requires user interaction to work, this is expected on first load
      if (error.name === 'NotAllowedError') {
        console.log('NoSleep requires user interaction to activate');
      }
    }
  }, [isScreenWakeActive]);

  // Stop screen wake prevention
  const stopScreenWake = useCallback(() => {
    if (!noSleepRef.current) {
      return;
    }

    if (!isScreenWakeActive) {
      console.log('Screen wake already inactive');
      return;
    }

    try {
      noSleepRef.current.disable();
      setIsScreenWakeActive(false);
      console.log('NoSleep deactivated - screen can sleep again');
    } catch (error) {
      console.error('Failed to disable NoSleep:', error);
    }
  }, [isScreenWakeActive]);

  // Handle visibility change (re-enable when page becomes visible)
  useEffect(() => {
    const handleVisibilityChange = () => {
      console.log('Visibility changed:', document.visibilityState, 'Timer active:', isActive);
      
      if (document.visibilityState === 'visible' && isActive) {
        // If we should be active but aren't, restart
        if (!isScreenWakeActive) {
          console.log('Re-enabling NoSleep after tab switch');
          startScreenWake();
        }
      }
      // Note: We don't disable on hidden because NoSleep.js handles this automatically
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [isActive, isScreenWakeActive, startScreenWake]);

  // Add user interaction handler to enable NoSleep when needed
  useEffect(() => {
    const handleUserInteraction = () => {
      if (isActive && !isScreenWakeActive && noSleepRef.current) {
        startScreenWake();
      }
    };

    // Listen for user interactions that can enable NoSleep
    const events = ['click', 'touchstart', 'keydown'];
    events.forEach(event => {
      document.addEventListener(event, handleUserInteraction, { once: false, passive: true });
    });

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, handleUserInteraction);
      });
    };
  }, [isActive, isScreenWakeActive, startScreenWake]);

  // Main effect: start/stop screen wake based on isActive
  useEffect(() => {
    if (isActive) {
      startScreenWake();
    } else {
      stopScreenWake();
    }
  }, [isActive, startScreenWake, stopScreenWake]);

  return {
    isSupported,
    isWakeLockActive: isScreenWakeActive, // Keep same interface for compatibility
    requestWakeLock: startScreenWake, // Keep same interface for compatibility
    releaseWakeLock: stopScreenWake // Keep same interface for compatibility
  };
};

export default useScreenWake; 