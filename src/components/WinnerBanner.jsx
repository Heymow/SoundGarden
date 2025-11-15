import React from 'react';
import { useAudioPlayer } from '../context/AudioPlayerContext';
import LavaLamp from './LavaLamp';

export default function WinnerBanner({ winner, theme, onNavigateToTeam }) {
  const { currentSong, isPlaying, playSong, togglePlayPause } = useAudioPlayer();

  if (!winner) return null;

  const teamName = winner.participants.join(' & ');

  // Check if this is the current song
  const isThisSongPlaying = currentSong?.id === winner.id && isPlaying;
  const isThisSongCurrent = currentSong?.id === winner.id;

  const handlePlayClick = (e) => {
    e.stopPropagation();
    if (isThisSongCurrent) {
      // If this is the current song, toggle play/pause
      togglePlayPause();
    } else {
      // Otherwise, play this song
      playSong(winner);
    }
  };

  return (
    <div className='winner-container lava-lamp-container' style={{ backgroundImage: `url(${winner.imageUrl})`, backgroundSize: 'cover', transition: 'all 0.3s ease' }}
      onMouseEnter={e => {
        // e.currentTarget.style.transform = 'rotate3d(1, 2, 0, 5deg)';
        e.currentTarget.style.scale = '1.01';
      }}
      onMouseLeave={e => {
        // e.currentTarget.style.transform = 'rotate3d(1, 2, 0, -1deg)';
        e.currentTarget.style.scale = '1';
      }}
    >
      <LavaLamp
        blobCount={3}
        colors={['rgba(255, 255, 255, 0.3)', 'rgba(255, 215, 0, 0.4)', 'rgba(255, 165, 0, 0.3)']}
        size="medium"
        opacity={0.6}
        animationDuration="25s"
      />

      <div className="winner-banner">
        <div className="winner-details">
          <div className="winner-badge">🏆 Last Week's Winner</div>

          <div className="winner-content">
            <div className="winner-info">
              <h3 className="winner-title">{winner.title}</h3>
              <p className="winner-theme">Theme: {theme}</p>
              <p className="winner-team">
                Team: {onNavigateToTeam ? (
                  <span
                    className="team-chip clickable-chip"
                    onClick={() => onNavigateToTeam(teamName)}
                    style={{
                      cursor: 'pointer',
                      transition: 'all 0.3s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.transform = 'scale(1.05)';
                      e.target.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.transform = 'scale(1)';
                      e.target.style.backgroundColor = 'transparent';
                    }}
                  >
                    {teamName}
                  </span>
                ) : (
                  teamName
                )}
              </p>
              <p className="winner-votes">🎵 {winner.votes} votes</p>
            </div>
          </div>
        </div>

        <div
          className="winner-image"
          onClick={handlePlayClick}
          style={{
            cursor: 'pointer',
            transition: 'transform 0.3s ease, filter 0.3s ease',
            rotate: '-1deg',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'scale(1.14)';
            e.currentTarget.style.filter = 'brightness(1.16)';
            e.currentTarget.style.rotate = '3deg';
            e.currentTarget.style.transition = 'all 0.4s ease';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'scale(1)';
            e.currentTarget.style.filter = 'brightness(1)';
            e.currentTarget.style.rotate = '0deg';
          }}
        >
          <img src={winner.imageUrl || 'https://via.placeholder.com/150'} alt={winner.title} style={{ width: "25%", height: "auto", minWidth: "200px" }} />
          <button
            className={`winner-play-overlay ${isThisSongPlaying ? 'playing' : ''}`}
            onClick={handlePlayClick}
            style={{
              transition: 'all 0.3s ease'
            }}
            onMouseEnter={(e) => {
              // e.target.style.transform = 'scale(1.2)';
              e.target.style.backgroundColor = 'rgba(255, 255, 255, 0.9)';
              e.target.style.color = '#000';
            }}
            onMouseLeave={(e) => {
              // e.target.style.transform = 'scale(1)';
              e.target.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
              e.target.style.color = '#ffffffff';
            }}
            aria-label={isThisSongPlaying ? "Pause winning song" : "Play winning song"}
          >
            {isThisSongPlaying ? '⏸' : '▶'}
          </button>
        </div>
      </div>

    </div>
  );
}
