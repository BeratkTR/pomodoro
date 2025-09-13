import React, { useState, useEffect } from 'react';
import socketService from '../services/socketService';
// import './MusicPlayer.css';

const MusicPlayer = ({ currentUser, roomUsers }) => {
  console.log('🎵 MusicPlayer rendering with:', { currentUser, roomUsers });
  
  const [isOpen, setIsOpen] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTrack, setCurrentTrack] = useState(null);
  const [volume, setVolume] = useState(0.5);
  const [isHost, setIsHost] = useState(false);
  const [roomMusicState, setRoomMusicState] = useState({
    isPlaying: false,
    currentTrack: null,
    volume: 0.5,
    hostId: null
  });
  const [audioElement, setAudioElement] = useState(null);

  // Safety check for required props
  if (!currentUser || !roomUsers) {
    console.warn('🎵 MusicPlayer: Missing required props', { currentUser, roomUsers });
    return null;
  }

  // Check if current user is the music host
  useEffect(() => {
    setIsHost(roomMusicState.hostId === currentUser?.id);
  }, [roomMusicState.hostId, currentUser?.id]);

  // Initialize audio element
  useEffect(() => {
    if (typeof Audio !== 'undefined') {
      const audio = new Audio();
      audio.loop = true; // Loop the track
      setAudioElement(audio);
      
      return () => {
        if (audio) {
          audio.pause();
          audio.src = '';
        }
      };
    }
  }, []);

  // Listen for room music updates
  useEffect(() => {
    const handleRoomMusicUpdate = (data) => {
      console.log('🎵 Room music update:', data);
      setRoomMusicState(data);
      setIsPlaying(data.isPlaying);
      setCurrentTrack(data.currentTrack);
      setVolume(data.volume);
      
      // Update audio element
      if (audioElement) {
        if (data.currentTrack) {
          audioElement.src = data.currentTrack.url;
        }
        audioElement.volume = data.volume;
        
        if (data.isPlaying) {
          audioElement.play().catch(console.error);
        } else {
          audioElement.pause();
        }
      }
    };

    const handleMusicControl = (data) => {
      console.log('🎵 Music control received:', data);
      if (data.action === 'play') {
        setIsPlaying(true);
        if (audioElement) {
          audioElement.play().catch(console.error);
        }
      } else if (data.action === 'pause') {
        setIsPlaying(false);
        if (audioElement) {
          audioElement.pause();
        }
      } else if (data.action === 'volume') {
        setVolume(data.volume);
        if (audioElement) {
          audioElement.volume = data.volume;
        }
      } else if (data.action === 'track_change') {
        setCurrentTrack(data.track);
        if (audioElement && data.track) {
          audioElement.src = data.track.url;
          if (isPlaying) {
            audioElement.play().catch(console.error);
          }
        }
      }
    };

    socketService.on('room_music_update', handleRoomMusicUpdate);
    socketService.on('music_control', handleMusicControl);

    // Request current music state when component mounts
    socketService.emit('get_music_state');

    return () => {
      socketService.off('room_music_update', handleRoomMusicUpdate);
      socketService.off('music_control', handleMusicControl);
    };
  }, [audioElement, isPlaying]);

  const toggleMusicPanel = () => {
    setIsOpen(!isOpen);
  };

  const handlePlayPause = () => {
    if (!isHost) return;

    const newPlayingState = !isPlaying;
    setIsPlaying(newPlayingState);
    
    // Emit to server
    socketService.emit('music_control', {
      action: newPlayingState ? 'play' : 'pause',
      userId: currentUser.id
    });
  };

  const handleVolumeChange = (newVolume) => {
    if (!isHost) return;

    setVolume(newVolume);
    
    // Emit to server
    socketService.emit('music_control', {
      action: 'volume',
      volume: newVolume,
      userId: currentUser.id
    });
  };

  const handleTrackSelect = (track) => {
    if (!isHost) return;

    setCurrentTrack(track);
    
    // Emit to server
    socketService.emit('music_control', {
      action: 'track_change',
      track: track,
      userId: currentUser.id
    });
  };

  const takeControl = () => {
    socketService.emit('music_control', {
      action: 'take_control',
      userId: currentUser.id
    });
  };

  // Sample tracks using existing assets
  const sampleTracks = [
    { id: 1, name: 'Focus Bell', url: '/src/assets/clock.mp3', duration: '0:05' },
    { id: 2, name: 'Notification Sound', url: '/src/assets/message.mp3', duration: '0:03' },
    { id: 3, name: 'Off Sound', url: '/src/assets/off.mp3', duration: '0:02' },
    { id: 4, name: 'On Sound', url: '/src/assets/on.mp3', duration: '0:02' }
  ];

  try {
    return (
      <>
        {/* Left Arrow Button */}
        <button 
          style={{
            position: 'fixed',
            left: '20px',
            top: '50%',
            transform: 'translateY(-50%)',
            zIndex: 1000,
            background: 'rgba(255, 255, 255, 0.1)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            borderRadius: '50px',
            padding: '12px 16px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            color: 'white',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)'
          }}
          onClick={toggleMusicPanel}
          title="Music Player"
        >
          <div className="arrow-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/>
            </svg>
          </div>
          <div className="music-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
            </svg>
          </div>
        </button>

      {/* Music Panel */}
      {isOpen && (
        <div style={{
          position: 'fixed',
          left: '80px',
          top: '50%',
          transform: 'translateY(-50%)',
          zIndex: 999,
          width: '350px',
          maxHeight: '80vh',
          background: 'rgba(255, 255, 255, 0.1)',
          backdropFilter: 'blur(40px)',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          borderRadius: '20px',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.4)',
          overflow: 'hidden'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '20px 24px 16px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
            background: 'rgba(255, 255, 255, 0.05)',
            backdropFilter: 'blur(10px)'
          }}>
            <h3 style={{ margin: 0, color: 'white', fontSize: '18px', fontWeight: 600 }}>Room Music</h3>
            <button style={{
              background: 'none',
              border: 'none',
              color: 'rgba(255, 255, 255, 0.7)',
              cursor: 'pointer',
              padding: '4px',
              borderRadius: '6px'
            }} onClick={toggleMusicPanel}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
              </svg>
            </button>
          </div>

          <div style={{ padding: '20px 24px 24px', maxHeight: 'calc(80vh - 80px)', overflowY: 'auto' }}>
            <div style={{ color: 'white', textAlign: 'center' }}>
              <h4>Music Player</h4>
              <p>Host: {isHost ? 'You' : 'Someone else'}</p>
              <p>Status: {isPlaying ? 'Playing' : 'Stopped'}</p>
              <button 
                style={{
                  background: 'rgba(99, 102, 241, 0.3)',
                  border: '1px solid rgba(99, 102, 241, 0.5)',
                  color: 'white',
                  padding: '8px 16px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  margin: '10px'
                }}
                onClick={handlePlayPause}
                disabled={!isHost}
              >
                {isPlaying ? 'Pause' : 'Play'}
              </button>
            </div>
          </div>
        </div>
      )}
      </>
    );
  } catch (error) {
    console.error('🎵 MusicPlayer error:', error);
    return (
      <div style={{ 
        position: 'fixed', 
        left: '20px', 
        top: '50%', 
        transform: 'translateY(-50%)',
        background: 'rgba(255, 0, 0, 0.1)',
        padding: '10px',
        borderRadius: '8px',
        color: 'white',
        zIndex: 1000
      }}>
        Music Player Error
      </div>
    );
  }
};

export default MusicPlayer;
