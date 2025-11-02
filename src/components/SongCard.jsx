import React from 'react';

export default function SongCard({ song, phase, onVote, hasVoted, isLoggedIn, onLoginRequired, onPlaySong, onNavigateToTeam, onNavigateToArtist }) {
  const handleImageClick = () => {
    if (onPlaySong) {
      onPlaySong(song);
    } else {
      window.open(song.sunoUrl, '_blank');
    }
  };

  const handlePlayClick = (e) => {
    e.stopPropagation();
    if (onPlaySong) {
      onPlaySong(song);
    }
  };

  const handleVoteClick = () => {
    if (!isLoggedIn) {
      onLoginRequired && onLoginRequired();
      return;
    }
    if (phase === 'voting' && !hasVoted) {
      onVote(song.id);
    }
  };

  const handleParticipantClick = (participantName) => {
    if (onNavigateToArtist) {
      onNavigateToArtist(participantName);
    }
  };

  return (
    <div className="song-card">
      <div 
        className="song-image" 
        onClick={handleImageClick}
        style={{ cursor: 'pointer' }}
      >
        <img src={song.imageUrl || 'https://via.placeholder.com/200'} alt={song.title} />
        <div 
          className="play-overlay" 
          onClick={handlePlayClick}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handlePlayClick(e);
            }
          }}
          tabIndex={0}
          role="button"
          aria-label={`Play ${song.title}`}
        >
          ▶
        </div>
      </div>
      
      <div className="song-details">
        <h3 className="song-title">{song.title}</h3>
        <p className="song-participants">
          {song.participants.map((participant, idx) => (
            <React.Fragment key={participant}>
              {idx > 0 && ' & '}
              {onNavigateToArtist ? (
                <span 
                  className="participant-chip" 
                  onClick={() => handleParticipantClick(participant)}
                >
                  {participant}
                </span>
              ) : (
                <span>{participant}</span>
              )}
            </React.Fragment>
          ))}
        </p>
        {onNavigateToTeam && song.participants.length >= 2 && (
          <div className="song-team-chip-container">
            <span 
              className="team-chip clickable-chip" 
              onClick={() => onNavigateToTeam(song.participants.join(' & '))}
            >
              {song.participants.join(' & ')}
            </span>
          </div>
        )}
        <div className="song-accounts">
          {song.sunoAccounts.map((account, idx) => (
            <span key={idx} className="suno-account">{account}</span>
          ))}
        </div>
        
        <div className="song-actions">
          {phase === 'voting' && (
            <button 
              className={`btn-vote ${hasVoted ? 'voted' : ''}`}
              onClick={handleVoteClick}
              disabled={hasVoted}
            >
              {hasVoted ? '✓ Voted' : '🎤 Vote'}
            </button>
          )}
          
          <a 
            href={song.sunoUrl} 
            target="_blank" 
            rel="noopener noreferrer"
            className="btn-suno"
          >
            🎵 Listen on Suno
          </a>
          
          {phase === 'voting' && song.votes !== undefined && (
            <span className="vote-count">{song.votes} votes</span>
          )}
        </div>
      </div>
    </div>
  );
}
