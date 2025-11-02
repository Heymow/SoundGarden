import React from 'react';

export default function SongCard({ song, phase, onVote, hasVoted, isLoggedIn, onLoginRequired }) {
  const handleImageClick = () => {
    window.open(song.sunoUrl, '_blank');
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

  return (
    <div className="song-card">
      <div 
        className="song-image" 
        onClick={handleImageClick}
        style={{ cursor: 'pointer' }}
      >
        <img src={song.imageUrl || 'https://via.placeholder.com/200'} alt={song.title} />
        <div className="play-overlay">▶</div>
      </div>
      
      <div className="song-details">
        <h3 className="song-title">{song.title}</h3>
        <p className="song-participants">
          {song.participants.join(' & ')}
        </p>
        <div className="song-accounts">
          {song.sunoAccounts.map((account, idx) => (
            <span key={idx} className="suno-account">{account}</span>
          ))}
        </div>
        
        <div className="song-actions">
          <a 
            href={song.sunoUrl} 
            target="_blank" 
            rel="noopener noreferrer"
            className="btn-suno"
          >
            🎵 Listen on Suno
          </a>
          
          {phase === 'voting' && (
            <button 
              className={`btn-vote ${hasVoted ? 'voted' : ''}`}
              onClick={handleVoteClick}
              disabled={hasVoted}
            >
              {hasVoted ? '✓ Voted' : '🎤 Vote'}
            </button>
          )}
          
          {phase === 'voting' && song.votes !== undefined && (
            <span className="vote-count">{song.votes} votes</span>
          )}
        </div>
      </div>
    </div>
  );
}
