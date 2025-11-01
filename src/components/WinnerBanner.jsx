import React from 'react';

export default function WinnerBanner({ winner, theme, onPlay }) {
  if (!winner) return null;

  return (
    <div className="winner-banner">
      <div className="winner-badge">🏆 Last Week's Winner</div>
      <div className="winner-content">
        <div className="winner-info">
          <h3 className="winner-title">{winner.title}</h3>
          <p className="winner-theme">Theme: {theme}</p>
          <p className="winner-team">
            Team: {winner.participants.join(' & ')}
          </p>
          <p className="winner-votes">🎵 {winner.votes} votes</p>
        </div>
        
        <div className="winner-middle">
          <button 
            className="winner-play-btn"
            onClick={() => onPlay && onPlay(winner)}
            aria-label="Play winning song"
          >
            ▶
          </button>
          <div className="winner-progress-bar">
            <div className="winner-progress-fill" style={{ width: '0%' }} />
          </div>
        </div>

        <div 
          className="winner-image" 
          onClick={() => window.open(winner.sunoUrl, '_blank')}
          style={{ cursor: 'pointer' }}
        >
          <img src={winner.imageUrl || 'https://via.placeholder.com/150'} alt={winner.title} />
          <div className="play-overlay">▶</div>
        </div>
      </div>
    </div>
  );
}
