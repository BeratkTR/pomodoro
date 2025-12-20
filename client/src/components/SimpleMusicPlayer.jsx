import React, { useState, useEffect, useRef } from 'react';

const SimpleMusicPlayer = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentUrl, setCurrentUrl] = useState('');
  const [volume, setVolume] = useState(0.5);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const [presetUrls] = useState([
    { name: 'Beethoven - Moonlight Sonata', url: './musics/Beethoven%20-%20Moonlight%20Sonata.mp3' },
    { name: 'Fire', url: './musics/Fire.mp3' },
    { name: 'Forest', url: './musics/Forest.mp3' },
    { name: 'Rain', url: './musics/Rain.mp3' },
    { name: 'White Noise', url: './musics/White%20Noise.mp3' }
  ]);

  const audioRef = useRef(null);

  // Initialize audio element
  useEffect(() => {
    if (typeof Audio !== 'undefined') {
      audioRef.current = new Audio();
      audioRef.current.volume = volume;
      audioRef.current.loop = true;
      
      // Event listeners
      audioRef.current.addEventListener('play', () => {
        console.log('🎵 Audio started playing');
        setIsPlaying(true);
      });
      
      audioRef.current.addEventListener('pause', () => {
        console.log('🎵 Audio paused');
        setIsPlaying(false);
      });
      
      audioRef.current.addEventListener('ended', () => {
        console.log('🎵 Audio ended');
        setIsPlaying(false);
      });
      
      audioRef.current.addEventListener('error', (e) => {
        console.error('🎵 Audio error:', e);
        setIsPlaying(false);
      });
      
      audioRef.current.addEventListener('timeupdate', () => {
        setCurrentTime(audioRef.current.currentTime);
      });
      
      audioRef.current.addEventListener('loadedmetadata', () => {
        setDuration(audioRef.current.duration);
      });
    }

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  // Update volume when it changes
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  const handlePlayPause = async () => {
    if (!currentUrl) {
      alert('Please select a sound first');
      return;
    }

    try {
      // Only set source if it's different from current or if there's no source
      const currentSrc = audioRef.current.src;
      if (!currentSrc || !currentSrc.includes(currentUrl.split('/').pop())) {
        audioRef.current.src = currentUrl;
        audioRef.current.load();
      }

      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false); // Manually set paused state
      } else {
        // Resume from where it was paused
        await audioRef.current.play();
        setIsPlaying(true); // Manually set playing state
      }
    } catch (error) {
      console.error('Play/Pause error:', error);
      alert('Error playing audio. Please try clicking a preset sound first.');
    }
  };

  const handlePresetClick = async (url) => {
    setCurrentUrl(url);
    
    try {
      audioRef.current.src = url;
      audioRef.current.load();
      await audioRef.current.play();
      setIsPlaying(true); // Manually set playing state
    } catch (error) {
      console.error('Play error:', error);
      alert('Error playing audio. Please try again.');
    }
  };

  const handleStop = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setCurrentTime(0);
      setIsPlaying(false); // Manually set stopped state
    }
  };

  const handleSeek = (e) => {
    if (audioRef.current && duration > 0) {
      const rect = e.currentTarget.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const newTime = (clickX / rect.width) * duration;
      audioRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };

  const formatTime = (time) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        style={{
          position: 'fixed',
          left: '20px',
          top: '50%',
          transform: 'translateY(-50%)',
          background: 'rgba(0, 0, 0, 0.9)',
          border: 'none',
          color: 'white',
          padding: '12px 8px',
          borderRadius: '8px',
          cursor: 'pointer',
          fontSize: '16px',
          fontWeight: '600',
          zIndex: 1000,
          backdropFilter: 'blur(15px)',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
          transition: 'background-color 0.2s ease, border-color 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease, opacity 0.2s ease',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          width: '40px',
          height: '60px'
        }}
        onMouseOver={(e) => {
          e.target.style.background = 'rgba(0, 0, 0, 1)';
        }}
        onMouseOut={(e) => {
          e.target.style.background = 'rgba(0, 0, 0, 0.9)';
        }}
      >
        <span style={{ fontSize: '18px' }}>▶</span>
      </button>
    );
  }

  return (
    <div
      style={{
        position: 'fixed',
        left: '20px',
        top: '50%',
        transform: 'translateY(-50%)',
        background: 'rgba(0, 0, 0, 0.95)',
        backdropFilter: 'blur(25px)',
        border: '1px solid rgba(255, 255, 255, 0.15)',
        borderRadius: '20px',
        padding: '25px',
        color: 'white',
        minWidth: '340px',
        zIndex: 1000,
        boxShadow: '0 12px 40px rgba(0, 0, 0, 0.4)',
        fontFamily: 'system-ui, -apple-system, sans-serif'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600', letterSpacing: '0.5px' }}>Music Player</h3>
        <button
          onClick={() => setIsOpen(false)}
          style={{
            background: 'rgba(255, 255, 255, 0.1)',
            border: 'none',
            color: 'white',
            cursor: 'pointer',
            fontSize: '20px',
            padding: '8px 12px',
            borderRadius: '50%',
            width: '36px',
            height: '36px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s ease'
          }}
          onMouseOver={(e) => {
            e.target.style.background = 'rgba(255, 255, 255, 0.2)';
          }}
          onMouseOut={(e) => {
            e.target.style.background = 'rgba(255, 255, 255, 0.1)';
          }}
        >
          ×
        </button>
      </div>

      {/* Preset Sounds */}
      <div style={{ marginBottom: '20px' }}>
        <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: '500', color: 'rgba(255, 255, 255, 0.8)' }}>Click any sound to play:</h4>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
          {presetUrls.map((preset, index) => (
            <button
              key={index}
              onClick={() => handlePresetClick(preset.url)}
              style={{
                background: currentUrl === preset.url ? 'rgba(220, 38, 38, 0.8)' : 'rgba(255, 255, 255, 0.1)',
                border: currentUrl === preset.url ? '1px solid rgba(220, 38, 38, 0.6)' : '1px solid rgba(255, 255, 255, 0.2)',
                color: 'white',
                padding: '10px 14px',
                borderRadius: '12px',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: '500',
                transition: 'background-color 0.2s ease, border-color 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease, opacity 0.2s ease',
                backdropFilter: 'blur(10px)'
              }}
              onMouseOver={(e) => {
                if (currentUrl !== preset.url) {
                  e.target.style.background = 'rgba(255, 255, 255, 0.15)';
                  e.target.style.transform = 'translateY(-1px)';
                }
              }}
              onMouseOut={(e) => {
                if (currentUrl !== preset.url) {
                  e.target.style.background = 'rgba(255, 255, 255, 0.1)';
                  e.target.style.transform = 'translateY(0)';
                }
              }}
            >
              {preset.name}
            </button>
          ))}
        </div>
      </div>

      {/* Custom URL Input */}
      <div style={{ marginBottom: '20px' }}>
        <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: '500', color: 'rgba(255, 255, 255, 0.8)' }}>Custom URL:</h4>
        <input
          type="text"
          value={currentUrl}
          onChange={(e) => setCurrentUrl(e.target.value)}
          placeholder="Enter audio URL..."
          style={{
            width: '100%',
            padding: '12px 16px',
            borderRadius: '12px',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            background: 'rgba(255, 255, 255, 0.08)',
            color: 'white',
            fontSize: '13px',
            backdropFilter: 'blur(10px)',
            transition: 'all 0.2s ease'
          }}
          onFocus={(e) => {
            e.target.style.border = '1px solid rgba(220, 38, 38, 0.5)';
            e.target.style.background = 'rgba(255, 255, 255, 0.12)';
          }}
          onBlur={(e) => {
            e.target.style.border = '1px solid rgba(255, 255, 255, 0.2)';
            e.target.style.background = 'rgba(255, 255, 255, 0.08)';
          }}
        />
      </div>

      {/* Controls */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '15px' }}>
          <button
            onClick={handlePlayPause}
            disabled={!currentUrl}
            style={{
              background: isPlaying ? 'rgba(220, 38, 38, 0.9)' : 'rgba(34, 197, 94, 0.9)',
              border: 'none',
              color: 'white',
              padding: '12px 24px',
              borderRadius: '12px',
              cursor: !currentUrl ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              fontWeight: '600',
              opacity: !currentUrl ? 0.6 : 1,
              transition: 'background-color 0.2s ease, border-color 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease, opacity 0.2s ease',
              backdropFilter: 'blur(10px)',
              boxShadow: isPlaying ? '0 4px 20px rgba(220, 38, 38, 0.3)' : '0 4px 20px rgba(34, 197, 94, 0.3)'
            }}
            onMouseOver={(e) => {
              if (currentUrl) {
                e.target.style.transform = 'translateY(-2px)';
                e.target.style.boxShadow = isPlaying ? '0 6px 25px rgba(220, 38, 38, 0.4)' : '0 6px 25px rgba(34, 197, 94, 0.4)';
              }
            }}
            onMouseOut={(e) => {
              if (currentUrl) {
                e.target.style.transform = 'translateY(0)';
                e.target.style.boxShadow = isPlaying ? '0 4px 20px rgba(220, 38, 38, 0.3)' : '0 4px 20px rgba(34, 197, 94, 0.3)';
              }
            }}
          >
            {isPlaying ? '⏸️ Pause' : '▶️ Play'}
          </button>
          
          <button
            onClick={handleStop}
            style={{
              background: 'rgba(220, 38, 38, 0.9)',
              border: 'none',
              color: 'white',
              padding: '12px 20px',
              borderRadius: '12px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '600',
              transition: 'background-color 0.2s ease, border-color 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease, opacity 0.2s ease',
              backdropFilter: 'blur(10px)',
              boxShadow: '0 4px 20px rgba(220, 38, 38, 0.3)'
            }}
            onMouseOver={(e) => {
              e.target.style.transform = 'translateY(-2px)';
              e.target.style.boxShadow = '0 6px 25px rgba(220, 38, 38, 0.4)';
            }}
            onMouseOut={(e) => {
              e.target.style.transform = 'translateY(0)';
              e.target.style.boxShadow = '0 4px 20px rgba(220, 38, 38, 0.3)';
            }}
          >
            ⏹️ Stop
          </button>
        </div>

        {/* Progress Bar */}
        {duration > 0 && (
          <div style={{ marginBottom: '15px' }}>
            <div
              style={{
                width: '100%',
                height: '8px',
                background: 'rgba(255, 255, 255, 0.15)',
                borderRadius: '4px',
                cursor: 'pointer',
                position: 'relative',
                backdropFilter: 'blur(10px)'
              }}
              onClick={handleSeek}
            >
              <div
                style={{
                  width: `${(currentTime / duration) * 100}%`,
                  height: '100%',
                  background: 'linear-gradient(90deg, rgba(220, 38, 38, 0.8), rgba(34, 197, 94, 0.8))',
                  borderRadius: '4px',
                  transition: 'width 0.1s ease'
                }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginTop: '8px', color: 'rgba(255, 255, 255, 0.7)' }}>
              <span style={{ fontWeight: '500' }}>{formatTime(currentTime)}</span>
              <span style={{ fontWeight: '500' }}>{formatTime(duration)}</span>
            </div>
          </div>
        )}
      </div>

      {/* Volume Control */}
      <div>
        <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: '500', color: 'rgba(255, 255, 255, 0.8)' }}>Volume:</h4>
        <input
          type="range"
          min="0"
          max="1"
          step="0.1"
          value={volume}
          onChange={(e) => setVolume(parseFloat(e.target.value))}
          style={{
            width: '100%',
            height: '8px',
            borderRadius: '4px',
            background: 'rgba(255, 255, 255, 0.15)',
            outline: 'none',
            accentColor: 'rgba(220, 38, 38, 0.8)',
            cursor: 'pointer'
          }}
        />
        <div style={{ textAlign: 'center', fontSize: '12px', marginTop: '8px', color: 'rgba(255, 255, 255, 0.7)', fontWeight: '500' }}>
          {Math.round(volume * 100)}%
        </div>
      </div>
    </div>
  );
};

export default SimpleMusicPlayer;