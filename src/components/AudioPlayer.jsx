import React, { useState, useRef, useEffect } from 'react';

export default function AudioPlayer({ currentSong, onClose }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const audioRef = useRef(null);

  useEffect(() => {
    if (currentSong) {
      setIsVisible(true);
      if (audioRef.current) {
        audioRef.current.src = currentSong.audioUrl;
        audioRef.current.play().catch(err => console.log('Autoplay prevented:', err));
        setIsPlaying(true);
      }
    } else {
      setIsPlaying(false);
      // Fade out then close
      setTimeout(() => {
        setIsVisible(false);
        if (onClose) onClose();
      }, 300);
    }
  }, [currentSong]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateTime = () => setCurrentTime(audio.currentTime);
    const updateDuration = () => setDuration(audio.duration);
    const handleEnded = () => {
      setIsPlaying(false);
      if (onClose) onClose();
    };

    audio.addEventListener('timeupdate', updateTime);
    audio.addEventListener('loadedmetadata', updateDuration);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', updateTime);
      audio.removeEventListener('loadedmetadata', updateDuration);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [onClose]);

  const togglePlayPause = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleProgressClick = (e) => {
    const progressBar = e.currentTarget;
    const clickX = e.clientX - progressBar.getBoundingClientRect().left;
    const width = progressBar.offsetWidth;
    const newTime = (clickX / width) * duration;
    
    if (audioRef.current) {
      audioRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
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
      <audio ref={audioRef} />
      
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
            className="audio-player-play-btn"
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
            onClick={() => {
              if (audioRef.current) {
                audioRef.current.pause();
              }
              if (onClose) onClose();
            }}
            aria-label="Close"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}
