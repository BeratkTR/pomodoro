import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import LogoutModal from './LogoutModal';

const UserDropdown = ({ userName, currentUser, onShowPersonalStats }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const dropdownRef = useRef(null);
  const { logout, isAuthenticated } = useAuth();

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    setShowLogoutModal(false);
    setIsOpen(false);
    logout();
  };

  const handleShowStats = () => {
    setIsOpen(false);
    onShowPersonalStats();
  };

  const handleShowLogoutModal = () => {
    setIsOpen(false);
    setShowLogoutModal(true);
  };

  return (
    <>
      <div className="user-dropdown" ref={dropdownRef}>
        <div 
          className="name-tag clickable" 
          onClick={() => setIsOpen(!isOpen)}
          title="User menu"
        >
          <span className="name-icon">👤</span>
          <span className="name-text">{userName}</span>
          <span className={`dropdown-arrow ${isOpen ? 'open' : ''}`}>▼</span>
        </div>

        {isOpen && (
          <div className="user-dropdown-menu">
            <div className="dropdown-header">
              <div className="user-avatar">👤</div>
              <div className="user-info">
                <div className="user-name">{userName}</div>
                {isAuthenticated && <div className="user-status">Authenticated</div>}
              </div>
            </div>
            
            <div className="dropdown-divider"></div>
            
            <button 
              className="dropdown-item"
              onClick={handleShowStats}
            >
              <span className="dropdown-icon">📊</span>
              View Statistics
            </button>
            
            {isAuthenticated && (
              <button 
                className="dropdown-item logout-item"
                onClick={handleShowLogoutModal}
              >
                <span className="dropdown-icon">🚪</span>
                Logout
              </button>
            )}
          </div>
        )}
      </div>

      {showLogoutModal && (
        <LogoutModal 
          onClose={() => setShowLogoutModal(false)}
          onConfirm={handleLogout}
          userName={userName}
        />
      )}
    </>
  );
};

export default UserDropdown;
