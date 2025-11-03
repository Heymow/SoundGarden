import React from 'react';

export default function WinnerBanner({ winner, theme, onPlay, onNavigateToTeam }) {
  if (!winner) return null;

  const teamName = winner.participants.join(' & ');

  return (
    <div className='winner-container' style={{ backgroundImage: `url(${winner.imageUrl})`, backgroundSize: 'cover', transition: 'all 0.3s ease' }}
      onMouseEnter={e => {
        // e.currentTarget.style.transform = 'rotate3d(1, 2, 0, 5deg)';
        e.currentTarget.style.scale = '1.01';
      }}
      onMouseLeave={e => {
        // e.currentTarget.style.transform = 'rotate3d(1, 2, 0, -1deg)';
        e.currentTarget.style.scale = '1';
      }}
    >
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
          onClick={() => onPlay && onPlay(winner)}
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
          <img src={winner.imageUrl || 'https://via.placeholder.com/150'} alt={winner.title} style={{ width: "25%", height: "auto" }} />
          <button
            className="winner-play-overlay"
            onClick={(e) => {
              e.stopPropagation();
              onPlay && onPlay(winner);
            }}
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
            aria-label="Play winning song"
          >
            ▶
          </button>
        </div>
      </div>

    </div>
  );
}
