import React, { useState, useEffect } from 'react'
import apiService from '../services/apiService'

function RoomJoinModal({ onJoinRoom, isConnected }) {
  const [activeTab, setActiveTab] = useState('join') // 'join' or 'create'
  const [userName, setUserName] = useState(localStorage.getItem('userName') || '')
  const [roomId, setRoomId] = useState('')
  const [roomName, setRoomName] = useState('')
  const [availableRooms, setAvailableRooms] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setUserName(localStorage.getItem('username'));

  }, [roomId, roomName])

  useEffect(() => {
    if (activeTab === 'join' && isConnected) {
      fetchAvailableRooms()
    }
  }, [activeTab, isConnected])

  const fetchAvailableRooms = async () => {
    try {
      const rooms = await apiService.getRooms()
      setAvailableRooms(rooms)
    } catch (error) {
      console.error('Failed to fetch rooms:', error)
      setError('Failed to load available rooms')
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    if (activeTab === 'join' && !roomId.trim()) {
      setError('Please enter a room ID or select a room')
      setLoading(false)
      return
    }

    if (activeTab === 'create' && !roomName.trim()) {
      setError('Please enter a room name')
      setLoading(false)
      return
    }

    try {
      // Use stored username or default name
      const defaultUserName = userName.trim() || 'Anonymous User'
      
      const roomData = {
        userName: defaultUserName,
        ...(activeTab === 'join' ? { roomId: roomId.trim() } : { roomName: roomName.trim() })
      }

      await onJoinRoom(roomData)
    } catch (error) {
      setError('Failed to join room. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleRoomSelect = (selectedRoomId, isRoomFull) => {
    if (isRoomFull) {
      return; // Don't allow selection of full rooms
    }
    setRoomId(selectedRoomId);
    document.querySelector("#roomId").focus();
  }

  return (
    <div className="modal-overlay">
      <div className="room-modal">
        <div className="room-modal-header">
          <h2>🍅 Join Pomodoro Study Session</h2>
          <p>Connect with others to study together!</p>
        </div>

        <div className="room-modal-tabs">
          <button 
            className={`tab-btn ${activeTab === 'join' ? 'active' : ''}`}
            onClick={() => setActiveTab('join')}
          >
            Join Room
          </button>
          <button 
            className={`tab-btn ${activeTab === 'create' ? 'active' : ''}`}
            onClick={() => setActiveTab('create')}
          >
            Create Room
          </button>
        </div>

        <form onSubmit={handleSubmit} className="room-form">
          {activeTab === 'join' ? (
            <>
              <div className="form-group">
                <label htmlFor="roomId">Room ID</label>
                <input
                  type="text"
                  id="roomId"
                  value={roomId}
                  onChange={(e) => setRoomId(e.target.value)}
                  placeholder="Enter room ID"
                  required
                />
              </div>

              {availableRooms.length > 0 && (
                <div className="available-rooms">
                  <h4>Available Rooms</h4>
                  <div className="rooms-list" >
                    {availableRooms.map((room) => {
                      const isRoomFull = room.userCount >= 2;
                      return (
                        <div 
                          key={room.id} 
                          className={`room-item ${roomId === room.id ? 'selected' : ''} ${isRoomFull ? 'disabled' : ''}`}
                          onClick={() => handleRoomSelect(room.id, isRoomFull)}
                          aria-disabled={isRoomFull}
                          title={isRoomFull ? 'Room is full (2/2 users)' : undefined}
                        >
                          <div className="room-info">
                            <div className="room-name">
                              {room.name}
                              {isRoomFull && <span className="full-badge">FULL</span>}
                            </div>
                            <div className="room-details">
                              {room.userCount}/2 users • 
                              {room.isActive ? ' Active' : ' Waiting'} • 
                              {room.mode}
                            </div>
                          </div>
                          <div className="room-status">
                            <span className={`status-dot ${isRoomFull ? 'full' : (room.isActive ? 'active' : 'waiting')}`}></span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="form-group">
              <label htmlFor="roomName">Room Name</label>
              <input
                type="text"
                id="roomName"
                value={roomName}
                onChange={(e) => setRoomName(e.target.value)}
                placeholder="Enter room name (e.g., 'Study Group 1')"
                required
                maxLength={50}
              />
            </div>
          )}

          {error && <div className="error-message">{error}</div>}

          <button 
            type="submit" 
            className="join-btn"
            disabled={loading || !isConnected}
          >
            {loading ? 'Connecting...' : activeTab === 'join' ? 'Join Room' : 'Create Room'}
          </button>
        </form>

        {!isConnected && (
          <div className="connection-status">
            <span className="status-dot offline"></span>
            Connecting to server...
          </div>
        )}
      </div>
    </div>
  )
}

export default RoomJoinModal 