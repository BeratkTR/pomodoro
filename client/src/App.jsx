import React from 'react'
import AuthWrapper from './components/AuthWrapper'
import MainApp from './components/MainApp'
import SimpleMusicPlayer from './components/SimpleMusicPlayer'
import SnowEffect from './components/SnowEffect'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import './App.css'

// Protected App Component that checks authentication
function ProtectedApp() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="app">
        <div className="loading-screen">
          <h2>Loading...</h2>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <AuthWrapper />;
  }

  return (
    <>
      <SnowEffect />
      <MainApp />
      <SimpleMusicPlayer />
    </>
  );
}

function App() {
  return (
    <AuthProvider>
      <ProtectedApp />
    </AuthProvider>
  );
}

export default App
