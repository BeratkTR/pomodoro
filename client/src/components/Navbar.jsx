import React, { useState} from 'react';
import SettingsModal from './SettingsModal';
import PersonalStatsModal from './PersonalStatsModal';

const Navbar = ({ setPomodoroSettings, userName, currentSettings, onLeaveRoom, onUpdateUserName, currentUser }) => {
  const [showSettings, setShowSettings] = useState(false);
  const [showPersonalStats, setShowPersonalStats] = useState(false);

  return (
    <>
      <nav className="navbar">
        <div className="navbar-brand">
          <span className="logo-text">Pomodoro App</span>
        </div>
        
        <div className="navbar-actions"> 
          <button 
            className="nav-btn settings-btn"
            onClick={() => setShowSettings(true)}
          >
            <span className="btn-icon">⚙️</span>
            Setting
          </button>

          {userName && (
            <div 
              className="name-tag clickable" 
              onClick={() => setShowPersonalStats(true)}
              title="View your statistics"
            >
              <span className="name-icon">👤</span>
              <span className="name-text">{userName}</span>
            </div>
          )}
          
          {/* <button className="nav-btn signin-btn">
            <span className="btn-icon">👤</span>
            Sign In
          </button> */}
        </div>
      </nav>

      {showSettings && (
        <SettingsModal 
          onClose={() => setShowSettings(false)}
          setPomodoroSettings={setPomodoroSettings}
          currentSettings={currentSettings}
          onLeaveRoom={onLeaveRoom}
          onUpdateUserName={onUpdateUserName}
        />
      )}

      {showPersonalStats && (
        <PersonalStatsModal 
          onClose={() => setShowPersonalStats(false)}
          currentUser={currentUser}
        />
      )}
    </>
  );
};

export default Navbar; 