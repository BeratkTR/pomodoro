const API_BASE_URL = 'http://18.159.206.201:5001/api';

class ApiService {
  async request(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    };

    if (config.body && typeof config.body === 'object') {
      config.body = JSON.stringify(config.body);
    }

    try {
      const response = await fetch(url, config);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        return await response.json();
      }
      
      return await response.text();
    } catch (error) {
      console.error('API request failed:', error);
      throw error;
    }
  }

  // Health check
  async checkHealth() {
    return this.request('/health');
  }

  // Room operations
  async getRooms() {
    return this.request('/rooms');
  }

  async createRoom(name, createdBy) {
    return this.request('/rooms', {
      method: 'POST',
      body: { name, createdBy },
    });
  }

  async getRoomById(roomId) {
    return this.request(`/rooms/${roomId}`);
  }
}

// Create singleton instance
const apiService = new ApiService();
export default apiService; 