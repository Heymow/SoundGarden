import React from 'react';

export default function WinnerBanner({ winner, theme, onPlay, onNavigateToTeam }) {
  if (!winner) return null;

  const teamName = winner.participants.join(' & ');

  return (
    <div className="winner-banner">
      <div className="winner-badge">🏆 Last Week's Winner</div>
      <div className="winner-content">
        <div className="winner-info">
          <h3 className="winner-title">{winner.title}</h3>
          <p className="winner-theme">Theme: {theme}</p>
          <p className="winner-team">
            Team: {onNavigateToTeam ? (
              <span 
                onClick={() => onNavigateToTeam(teamName)}
                style={{ cursor: 'pointer', textDecoration: 'underline', color: 'var(--accent)' }}
              >
                {teamName}
              </span>
            ) : (
              teamName
            )}
          </p>
          <p className="winner-votes">🎵 {winner.votes} votes</p>
        </div>

        <div 
          className="winner-image" 
          onClick={() => onPlay && onPlay(winner)}
          style={{ cursor: 'pointer' }}
        >
          <img src={winner.imageUrl || 'https://via.placeholder.com/150'} alt={winner.title} />
          <button 
            className="winner-play-overlay"
            onClick={(e) => {
              e.stopPropagation();
              onPlay && onPlay(winner);
            }}
            aria-label="Play winning song"
          >
            ▶
          </button>
        </div>
      </div>
    </div>
  );
}
