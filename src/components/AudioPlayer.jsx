import React, { useState, useEffect } from 'react';
import { useAudioPlayer } from '../context/AudioPlayerContext';

export default function AudioPlayer() {
  const { currentSong, isPlaying, currentTime, duration, togglePlayPause, closeSong, seekTo } = useAudioPlayer();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (currentSong) {
      setIsVisible(true);
    } else {
      // Fade out then close
      const timeoutId = setTimeout(() => {
        setIsVisible(false);
      }, 300);
      return () => clearTimeout(timeoutId);
    }
  }, [currentSong]);

  const handleProgressClick = (e) => {
    const progressBar = e.currentTarget;
    const clickX = e.clientX - progressBar.getBoundingClientRect().left;
    const width = progressBar.offsetWidth;
    const newTime = (clickX / width) * duration;
    
    seekTo(newTime);
  };

  const formatTime = (time) => {
    if (isNaN(time)) return '0:00';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  if (!currentSong || !isVisible) return null;

  return (
    <div className={`audio-player ${isVisible ? 'visible' : ''}`}>
      <div className="audio-player-content">
        <div className="audio-player-info">
          <img 
            src={currentSong.imageUrl || 'https://via.placeholder.com/50'} 
            alt={currentSong.title}
            className="audio-player-thumbnail"
          />
          <div className="audio-player-details">
            <div className="audio-player-title">{currentSong.title}</div>
            <div className="audio-player-artist">
              {currentSong.participants.join(' & ')}
            </div>
          </div>
        </div>

        <div className="audio-player-controls">
          <button 
            className={`audio-player-play-btn ${isPlaying ? 'playing' : ''}`}
            onClick={togglePlayPause}
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? '⏸' : '▶'}
          </button>

          <div className="audio-player-progress-section">
            <span className="audio-player-time">{formatTime(currentTime)}</span>
            <div 
              className="audio-player-progress-bar"
              onClick={handleProgressClick}
            >
              <div 
                className="audio-player-progress-fill"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="audio-player-time">{formatTime(duration)}</span>
          </div>

          <button 
            className="audio-player-close-btn"
            onClick={() => closeSong()}
            aria-label="Close"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}
