const API_BASE_URL = 'https://api.beratkaragol.dev/api/auth';
// const API_BASE_URL = 'http://localhost:5001/api/auth';

class AuthService {
  constructor() {
    this.token = localStorage.getItem('authToken');
    this.user = this.token ? this.parseTokenData() : null;
  }

  parseTokenData() {
    try {
      if (!this.token) return null;
      const payload = JSON.parse(atob(this.token.split('.')[1]));
      return {
        id: payload.userId,
        name: payload.name,
        email: payload.email,
        isAuthenticated: true
      };
    } catch (error) {
      console.error('Error parsing token:', error);
      this.logout();
      return null;
    }
  }

  async register(name, email, password) {
    try {
      const response = await fetch(`${API_BASE_URL}/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Registration failed');
      }

      this.token = data.token;
      this.user = data.user;
      localStorage.setItem('authToken', this.token);
      
      // Update localStorage to maintain compatibility with existing code
      localStorage.setItem('userId', this.user.id);
      localStorage.setItem('username', this.user.name);

      return { success: true, user: this.user };
    } catch (error) {
      console.error('Registration error:', error);
      return { success: false, error: error.message };
    }
  }

  async login(email, password) {
    try {
      const response = await fetch(`${API_BASE_URL}/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Login failed');
      }

      this.token = data.token;
      this.user = data.user;
      localStorage.setItem('authToken', this.token);
      
      // Update localStorage to maintain compatibility with existing code
      localStorage.setItem('userId', this.user.id);
      localStorage.setItem('username', this.user.name);

      return { success: true, user: this.user };
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error: error.message };
    }
  }

  async verifyToken() {
    if (!this.token) return false;

    try {
      const response = await fetch(`${API_BASE_URL}/verify`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.token}`,
        },
      });

      if (!response.ok) {
        this.logout();
        return false;
      }

      const data = await response.json();
      this.user = data.user;
      return true;
    } catch (error) {
      console.error('Token verification error:', error);
      this.logout();
      return false;
    }
  }

  logout() {
    this.token = null;
    this.user = null;
    localStorage.removeItem('authToken');
    localStorage.removeItem('userId');
    localStorage.removeItem('username');
    localStorage.removeItem('currentRoomId');
    localStorage.removeItem('currentRoomName');
  }

  isAuthenticated() {
    return !!this.token && !!this.user;
  }

  getUser() {
    return this.user;
  }

  getToken() {
    return this.token;
  }

  // Check if token is expired
  isTokenExpired() {
    if (!this.token) return true;
    
    try {
      const payload = JSON.parse(atob(this.token.split('.')[1]));
      const currentTime = Date.now() / 1000;
      return payload.exp < currentTime;
    } catch (error) {
      return true;
    }
  }
}

export default new AuthService();
