import React from 'react'
import soundService from '../services/soundService'

const SoundPermissionModal = ({ onClose, onRetry }) => {
  const handleAllowSounds = () => {
    // Request notification permission again
    if (Notification.permission === 'default') {
      Notification.requestPermission().then((permission) => {
        if (permission === 'granted') {
          onClose()
        }
      })
    } else {
      // If already denied, show instructions
      onRetry()
    }
  }

  return (
    <div className="modal-overlay">
      <div className="sound-permission-modal">
        <div className="modal-header">
          <h2>🔔 Enable Sound Notifications</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        
        <div className="modal-body">
          {/* <div className="sound-preview">
            <h4>Preview sounds:</h4>
            <div className="sound-test-buttons">
              <button 
                className="test-sound-btn"
                onClick={() => soundService.testSound('message')}
              >
                🔔 Test Message Sound
              </button>
              <button 
                className="test-sound-btn"
                onClick={() => soundService.testSound('timer')}
              >
                ⏰ Test Timer Sound
              </button>
            </div>
          </div> */}

          <div className="permission-instructions">
            <h4>How to enable notifications:</h4>
            <div className="browser-instructions">
              <div className="instruction-step">
                <span className="step-number">1</span>
                <div className="step-content">
                  <strong>Click the lock icon</strong> in your browser's address bar
                </div>
              </div>
              <div className="instruction-step">
                <span className="step-number">2</span>
                <div className="step-content">
                  <strong>Set Notifications to "Allow"</strong> in the dropdown
                </div>
              </div>
              <div className="instruction-step">
                <span className="step-number">3</span>
                <div className="step-content">
                  <strong>Refresh the page</strong> for changes to take effect
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="continue-btn" onClick={onClose}>
            Continue Without Sounds
          </button>
          <button className="allow-sounds-btn" onClick={handleAllowSounds}>
            Enable Notifications
          </button>
        </div>
      </div>
    </div>
  )
}

export default SoundPermissionModal 