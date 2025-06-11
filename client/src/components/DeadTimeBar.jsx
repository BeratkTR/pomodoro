import React, { useState } from 'react';

// DeadTimeBar component for displaying gaps between sessions
const DeadTimeBar = ({ duration, gapIndex }) => {
  const [showTooltip, setShowTooltip] = useState(false);
  
  const formatBubbleDuration = (minutes) => {
    if (minutes < 1) {
      const seconds = Math.round(minutes * 60);
      if (seconds === 0) return '0secs';
      if (seconds === 1) return '1sec';
      return `${seconds}secs`;
    }
    const roundedMinutes = Math.round(minutes);
    if (roundedMinutes === 1) return '1min';
    return `${roundedMinutes}mins`;
  };

  const calculateBarWidth = (durationMinutes) => {
    const minWidth = 15;
    const maxWidth = 40;
    const minDuration = 10;
    const maxDuration = 120;
    
    const clampedDuration = Math.max(minDuration, Math.min(maxDuration, durationMinutes));
    const normalizedDuration = (clampedDuration - minDuration) / (maxDuration - minDuration);
    
    return minWidth + (normalizedDuration * (maxWidth - minWidth));
  };

  const barWidth = calculateBarWidth(duration);

  return (
    <div 
      className="session-bar-container"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <div 
        className="session-bar dead-time"
        style={{ width: `${barWidth}px` }}
      >
        <div className="bar-fill" style={{ width: '100%' }}></div>
      </div>
      {showTooltip && (
        <div className="session-tooltip">
          {formatBubbleDuration(duration)}
        </div>
      )}
    </div>
  );
};

export default DeadTimeBar; 