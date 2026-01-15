import React from 'react'
import './SnowEffect.css'

function SnowEffect() {
  // Create multiple snowflakes
  const snowflakes = Array.from({ length: 50 }, (_, i) => i)

  return (
    <div className="snow-container">
      {snowflakes.map((flake) => {
        // Random delay so snowflakes start at different times (0-15 seconds)
        const delay = Math.random() * 15
        return (
          <div
            key={flake}
            className="snowflake"
            style={{
              left: `${Math.random() * 100}%`,
              animationDelay: `${delay}s`,
              animationDuration: `${10 + Math.random() * 10}s`,
              opacity: 0.3 + Math.random() * 0.7,
              transform: `scale(${0.5 + Math.random() * 0.5})`
            }}
          >
            ❄
          </div>
        )
      })}
    </div>
  )
}

export default SnowEffect
