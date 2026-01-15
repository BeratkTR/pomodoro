import React, { useState, useEffect } from 'react';
import authService from '../services/authService';

const AdminPanel = ({ onClose }) => {
  const [activeTab, setActiveTab] = useState('rooms');
  const [rooms, setRooms] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingItem, setEditingItem] = useState(null);

  useEffect(() => {
    fetchAdminData();
  }, []);

  // Helper function to get authentication token
  const getAuthToken = () => {
    let token = authService.getToken();
    if (!token) {
      token = localStorage.getItem('authToken');
    }
    return token;
  };

  const fetchAdminData = async () => {
    try {
      setLoading(true);
      console.log('Fetching admin data...');
      
      const token = getAuthToken();
      
      if (!token) {
        console.error('No authentication token found. Please log in first.');
        alert('Authentication required. Please log in to access admin panel.');
        setLoading(false);
        return;
      }
      
      console.log('Using token:', token.substring(0, 20) + '...');
      
      const response = await fetch('https://api.beratkaragol.dev/api/admin/data', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log('Admin data response status:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('Admin data received:', data);
        setRooms(data.rooms || []);
        setUsers(data.users || []);
        console.log('Set rooms:', data.rooms?.length, 'Set users:', data.users?.length);
      } else {
        const errorText = await response.text();
        console.error('Failed to fetch admin data - status:', response.status);
        console.error('Error response:', errorText);
        
        if (response.status === 401) {
          alert('Authentication failed. Please log in again.');
        } else if (response.status === 403) {
          alert('Access denied. You do not have admin privileges.');
        } else {
          alert(`Failed to load admin data: ${errorText}`);
        }
      }
    } catch (error) {
      console.error('Failed to fetch admin data:', error);
      alert('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const deleteRoom = async (roomId) => {
    if (!confirm('Are you sure you want to delete this room?')) return;
    
    try {
      const token = getAuthToken();
      if (!token) {
        alert('Authentication required. Please log in again.');
        return;
      }
      const response = await fetch(`https://api.beratkaragol.dev/api/admin/rooms/${roomId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      if (response.ok) {
        setRooms(rooms.filter(room => room.id !== roomId));
      } else {
        console.error('Failed to delete room - status:', response.status);
        const errorText = await response.text();
        console.error('Error response:', errorText);
      }
    } catch (error) {
      console.error('Failed to delete room:', error);
    }
  };

  const deleteUser = async (userId) => {
    if (!confirm('Are you sure you want to delete this user?')) return;
    
    try {
      const token = getAuthToken();
      if (!token) {
        alert('Authentication required. Please log in again.');
        return;
      }
      const response = await fetch(`https://api.beratkaragol.dev/api/admin/users/${userId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      if (response.ok) {
        setUsers(users.filter(user => user.id !== userId));
      } else {
        console.error('Failed to delete user - status:', response.status);
        const errorText = await response.text();
        console.error('Error response:', errorText);
      }
    } catch (error) {
      console.error('Failed to delete user:', error);
    }
  };

  const updateUser = async (userId, updates) => {
    try {
      console.log('Updating user:', userId, 'with data:', updates);
      const token = getAuthToken();
      if (!token) {
        alert('Authentication required. Please log in again.');
        return;
      }
      const response = await fetch(`https://api.beratkaragol.dev/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(updates)
      });
      
      console.log('Update response status:', response.status);
      
      if (response.ok) {
        const updatedUser = await response.json();
        console.log('Updated user data received:', updatedUser);
        setUsers(users.map(user => user.id === userId ? updatedUser : user));
        setEditingItem(null);
        // Refresh data to ensure sync
        fetchAdminData();
      } else {
        const errorText = await response.text();
        console.error('Update failed:', errorText);
      }
    } catch (error) {
      console.error('Failed to update user:', error);
    }
  };

  const formatTime = (minutes) => {
    const totalSeconds = Math.round(minutes * 60);
    const hours = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    
    if (hours > 0) {
      return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    } else {
      return `${mins}:${secs.toString().padStart(2, '0')}`;
    }
  };

  const EditUserForm = ({ user, onSave, onCancel }) => {
    console.log('EditUserForm rendered for user:', user);
    const [formData, setFormData] = useState({
      name: user.name
    });

    const handleSubmit = (e) => {
      e.preventDefault();
      console.log('Form submitted for user:', user.id, 'with name:', formData.name);
      if (formData.name.trim() === '') {
        alert('Name cannot be empty');
        return;
      }
      console.log('Calling onSave with:', user.id, formData);
      onSave(user.id, formData);
    };

    return (
      <tr className="edit-row">
        <td colSpan="7">
          <form onSubmit={handleSubmit} className="edit-form">
            <div className="form-group">
              <label>Rename User:</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                placeholder="Enter new username"
                autoFocus
              />
            </div>
            <div className="form-actions">
              <button type="submit" className="save-btn">Save</button>
              <button type="button" onClick={onCancel} className="cancel-btn">Cancel</button>
            </div>
          </form>
        </td>
      </tr>
    );
  };

  return (
    <div className="modal-overlay">
      <div className="admin-panel-modal">
        <div className="modal-header">
          <h2>🛡️ Admin Panel</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="admin-tabs">
          <button 
            className={`tab-btn ${activeTab === 'rooms' ? 'active' : ''}`}
            onClick={() => setActiveTab('rooms')}
          >
            Rooms ({rooms.length})
          </button>
          <button 
            className={`tab-btn ${activeTab === 'users' ? 'active' : ''}`}
            onClick={() => setActiveTab('users')}
          >
            Users ({users.length})
          </button>
        </div>

        <div className="admin-content">
          {loading ? (
            <div className="loading">Loading admin data...</div>
          ) : (
            <>
              {activeTab === 'rooms' && (
                <div className="rooms-section">
                  <h3>Rooms Management</h3>
                  {rooms.length === 0 ? (
                    <p>No rooms found</p>
                  ) : (
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th>Room ID</th>
                          <th>Room Name</th>
                          <th>Users Count</th>
                          <th>Created</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rooms.map(room => (
                          <tr key={room.id}>
                            <td>{room.id}</td>
                            <td>{room.name}</td>
                            <td>{room.userCount || 0}</td>
                            <td>{new Date(room.createdAt).toLocaleString()}</td>
                            <td>
                              <button 
                                className="delete-btn"
                                onClick={() => deleteRoom(room.id)}
                              >
                                Delete
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}

              {activeTab === 'users' && (
                <div className="users-section">
                  <h3>Users Management</h3>
                  {users.length === 0 ? (
                    <p>No users found</p>
                  ) : (
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th>User ID</th>
                          <th>Name</th>
                          <th>Status</th>
                          <th>Work Time</th>
                          <th>Break Time</th>
                          <th>Sessions</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {users.map(user => (
                          <React.Fragment key={user.id}>
                            <tr>
                              <td>{user.id}</td>
                              <td>{user.name}</td>
                              <td>
                                <span className={`status-badge ${user.status}`}>
                                  {user.status}
                                </span>
                              </td>
                              <td>{formatTime(user.totalWorkTime || 0)}</td>
                              <td>{formatTime(user.totalBreakTime || 0)}</td>
                              <td>{user.completedSessions || 0}</td>
                              <td>
                                <button 
                                  className="edit-btn"
                                  onClick={() => {
                                    console.log('Opening edit form for user:', user.id, user.name);
                                    setEditingItem(user.id);
                                  }}
                                >
                                  Rename
                                </button>
                                <button 
                                  className="delete-btn"
                                  onClick={() => deleteUser(user.id)}
                                >
                                  Delete
                                </button>
                              </td>
                            </tr>
                            {editingItem === user.id && (
                              <EditUserForm
                                user={user}
                                onSave={updateUser}
                                onCancel={() => setEditingItem(null)}
                              />
                            )}
                          </React.Fragment>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        <div className="admin-footer">
          <button onClick={fetchAdminData} className="refresh-btn">
            🔄 Refresh Data
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdminPanel; 