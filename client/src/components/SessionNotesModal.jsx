import React, { useState, useEffect } from 'react';
import './SessionNotesModal.css';

const SessionNotesModal = ({ session, sessionIndex, onClose, onSave, readOnly = false }) => {
  const [notes, setNotes] = useState(session?.notes || '');

  useEffect(() => {
    setNotes(session?.notes || '');
  }, [session]);

  // Handle ESC key press
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  const handleSave = () => {
    onSave(sessionIndex, notes);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="session-notes-modal" onClick={(e) => e.stopPropagation()}>
        <button className="close-modal-btn" onClick={onClose} title="Close (ESC)">
          ✕
        </button>
        <textarea
          className={`notes-textarea ${readOnly ? 'read-only' : ''}`}
          value={notes}
          onChange={(e) => !readOnly && setNotes(e.target.value)}
          placeholder={readOnly ? "No notes written..." : "Write your notes here..."}
          autoFocus={!readOnly}
          rows={12}
          readOnly={readOnly}
        />
        {!readOnly && (
          <button className="save-btn" onClick={handleSave}>
            Save
          </button>
        )}
      </div>
    </div>
  );
};

export default SessionNotesModal;

