import React from 'react';

const LogoutModal = ({ onClose, onConfirm, userName }) => {
  return (
    <div className="modal-overlay">
      <div className="modal-content logout-modal">
        <div className="modal-header">
          <h3>Confirm Logout</h3>
        </div>
        
        <div className="modal-body">
          <div className="logout-confirmation">
            <div className="logout-icon">👋</div>
            <p>Are you sure you want to logout, <strong>{userName}</strong>?</p>
            <p className="logout-warning">
              You will be disconnected from your current study session and will need to login again to continue.
            </p>
          </div>
        </div>
        
        <div className="modal-actions">
          <button 
            className="btn secondary"
            onClick={onClose}
          >
            Cancel
          </button>
          <button 
            className="btn danger"
            onClick={onConfirm}
          >
            Yes, Logout
          </button>
        </div>
      </div>
    </div>
  );
};

export default LogoutModal;
