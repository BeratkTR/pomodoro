import React, { useState, useEffect  } from 'react';

const SettingsModal = ({ onClose, setPomodoroSettings, currentSettings, onLeaveRoom, onUpdateUserName }) => {
  const [settings, setSettings] = useState({
    pomodoro: currentSettings?.pomodoro || 50,
    break: currentSettings?.break || 10
  });
  const [name, setName] = useState(localStorage.getItem('username'));

  // Update settings when currentSettings prop changes
  useEffect(() => {
    if (currentSettings) {
      setSettings({
        pomodoro: currentSettings.pomodoro || 50,
        break: currentSettings.break || 10
      });
    }
  }, [currentSettings]);

  // Handle Enter key press to save settings
  useEffect(() => {
    const handleKeyPress = (e) => {
      if (e.key === 'Enter') {
        handleSave();
      }
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyPress);

    return () => {
      document.removeEventListener('keydown', handleKeyPress);
    };
  }, [settings]); // Include settings in dependency array so handleSave has current values

  const handleInputChange = (key, value) => {
    setSettings(prev => ({
      ...prev,
      [key]: parseInt(value) || 1
    }));
  };

  const handleSave = () => {
    setPomodoroSettings(settings);
    
    // Update name if it changed
    const currentName = localStorage.getItem('username');
    if (name !== currentName) {
      localStorage.setItem('username', name);
      if (onUpdateUserName) {
        onUpdateUserName(name);
      }
    }
    
    onClose();
  };

  const handleReset = () => {
    setSettings({
      pomodoro: 50,
      break: 10
    });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Settings</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          <div className="settings-section">
            <h3>Timer (minutes)</h3>  
            
            <div className="setting-group">
              <label>Pomodoro</label>
              <input
                type="number"
                min="1"
                max="120"
                value={settings.pomodoro}
                onChange={(e) => handleInputChange('pomodoro', e.target.value)}
              />
            </div>

            <div className="setting-group">
              <label>Break</label>
              <input
                type="number"
                min="1"
                max="60"
                value={settings.break}
                onChange={(e) => handleInputChange('break', e.target.value)}
              />
            </div>
          </div>


          <div className="settings-section">
            <h3>Name</h3>

            <div className="setting-group">
                <label>Username:</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
            </div>
          </div>

          <div className="settings-section">
            <h3>Room Actions</h3>
            <div className="setting-group">
              <button 
                className="leave-room-btn"
                onClick={() => {
                  onLeaveRoom();
                  onClose();
                }}
              >
                Leave Room
              </button>
              <p className="leave-room-description">
                Leave the current study room. You can always join another room later.
              </p>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="reset-btn" id='setting-reset-btn' onClick={handleReset}>
            Reset to Default
          </button>
          <div className="action-buttons">
            <button className="cancel-btn" onClick={onClose}>
              Cancel
            </button>
            <button className="save-btn" onClick={handleSave}>
              OK
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal; 