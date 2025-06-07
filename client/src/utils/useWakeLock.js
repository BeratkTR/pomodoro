import { useEffect, useRef, useState, useCallback } from 'react';

const useWakeLock = (isActive) => {
  const wakeLockRef = useRef(null);
  const [isSupported, setIsSupported] = useState(false);
  const [isWakeLockActive, setIsWakeLockActive] = useState(false);

  // Check if Wake Lock API is supported
  useEffect(() => {
    if ('wakeLock' in navigator) {
      setIsSupported(true);
    } else {
      console.log('Wake Lock API is not supported in this browser');
    }
  }, []);

  // Request wake lock (using useCallback to prevent recreation)
  const requestWakeLock = useCallback(async () => {
    if (!isSupported) return;

    try {
      // Don't request if we already have one
      if (wakeLockRef.current) {
        console.log('Wake lock already active');
        return;
      }

      wakeLockRef.current = await navigator.wakeLock.request('screen');
      setIsWakeLockActive(true);
      console.log('Wake lock activated - screen will stay on');

      // Listen for wake lock release
      wakeLockRef.current.addEventListener('release', () => {
        console.log('Wake lock released by system');
        setIsWakeLockActive(false);
        wakeLockRef.current = null;
      });
    } catch (err) {
      console.error('Failed to request wake lock:', err);
    }
  }, [isSupported]);

  // Release wake lock (using useCallback to prevent recreation)
  const releaseWakeLock = useCallback(async () => {
    if (wakeLockRef.current) {
      try {
        await wakeLockRef.current.release();
        wakeLockRef.current = null;
        setIsWakeLockActive(false);
        console.log('Wake lock released - screen can sleep again');
      } catch (err) {
        console.error('Failed to release wake lock:', err);
      }
    }
  }, []);

  // Handle visibility change (re-request wake lock when page becomes visible)
  useEffect(() => {
    const handleVisibilityChange = () => {
      console.log('Visibility changed:', document.visibilityState, 'Timer active:', isActive, 'Wake lock exists:', !!wakeLockRef.current);
      
      if (document.visibilityState === 'visible' && isActive && isSupported) {
        // If we don't have a wake lock when we should, request it
        if (!wakeLockRef.current) {
          console.log('Re-requesting wake lock after tab switch');
          requestWakeLock();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [isActive, isSupported, requestWakeLock]);

  // Main effect: request/release wake lock based on isActive
  useEffect(() => {
    if (isActive && isSupported) {
      requestWakeLock();
    } else {
      releaseWakeLock();
    }

    // Cleanup on unmount
    return () => {
      releaseWakeLock();
    };
  }, [isActive, isSupported, requestWakeLock, releaseWakeLock]);

  return {
    isSupported,
    isWakeLockActive,
    requestWakeLock,
    releaseWakeLock
  };
};

export default useWakeLock; 