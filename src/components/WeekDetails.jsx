import React from "react";
import { useAudioPlayer } from "../context/AudioPlayerContext";

export default function WeekDetails({ challenge, onBack, onPlaySong, onNavigateToTeam, onNavigateToArtist }) {
  const { currentSong, isPlaying, togglePlayPause } = useAudioPlayer();

  if (!challenge) {
    return (
      <section className="page week-details-page">
        <button className="btn-back" onClick={onBack}>
          ← Back to History
        </button>
        <p>Challenge not found</p>
      </section>
    );
  }

  // Sort songs by votes (winner first)
  const sortedSongs = [...(challenge.songs || [])].sort((a, b) => b.votes - a.votes);

  return (
    <section className="page week-details-page">
      <button className="btn-back" onClick={onBack}>
        ← Back to History
      </button>

      <div className="week-details-header">
        <h2>Week {challenge.weekNumber} - {challenge.year}</h2>
        <div className="week-details-meta">
          <span className="week-date">{new Date(challenge.endDate).toLocaleDateString()}</span>
          <span className="week-theme"><strong>Theme:</strong> {challenge.theme}</span>
          <span className="week-submissions">{challenge.totalSubmissions} submissions</span>
        </div>
      </div>

      {/* Winner Section */}
      {challenge.winner && (
        <div className="week-winner-section">
          <h3 className="winner-section-title">🏆 Winner</h3>
          <div className="winner-card-large">
            <div 
              className="winner-image"
              onClick={() => {
                const winnerSong = sortedSongs.find(s => s.isWinner);
                if (winnerSong) {
                  onPlaySong && onPlaySong(winnerSong);
                }
              }}
              style={{ cursor: 'pointer' }}
            >
              <img src={challenge.winner.imageUrl} alt={challenge.winner.title} />
              <div 
                className={`play-overlay ${currentSong?.id === sortedSongs.find(s => s.isWinner)?.id && isPlaying ? 'playing' : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  const winnerSong = sortedSongs.find(s => s.isWinner);
                  if (winnerSong) {
                    if (currentSong?.id === winnerSong.id) {
                      togglePlayPause();
                    } else {
                      onPlaySong && onPlaySong(winnerSong);
                    }
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    const winnerSong = sortedSongs.find(s => s.isWinner);
                    if (winnerSong) {
                      if (currentSong?.id === winnerSong.id) {
                        togglePlayPause();
                      } else {
                        onPlaySong && onPlaySong(winnerSong);
                      }
                    }
                  }
                }}
                tabIndex={0}
                role="button"
                aria-label={currentSong?.id === sortedSongs.find(s => s.isWinner)?.id && isPlaying ? `Pause ${challenge.winner.title}` : `Play ${challenge.winner.title}`}
              >
                {currentSong?.id === sortedSongs.find(s => s.isWinner)?.id && isPlaying ? '⏸' : '▶'}
              </div>
            </div>
            <div className="winner-info">
              <h4>{challenge.winner.title}</h4>
              <div className="winner-participants">
                {challenge.winner.participants.map((participant, idx) => (
                  <React.Fragment key={participant}>
                    {idx > 0 && ' & '}
                    {onNavigateToArtist ? (
                      <span 
                        className="participant-chip" 
                        onClick={() => onNavigateToArtist(participant)}
                      >
                        {participant}
                      </span>
                    ) : (
                      <span>{participant}</span>
                    )}
                  </React.Fragment>
                ))}
              </div>
              {onNavigateToTeam && challenge.winner.participants.length >= 2 && (
                <div className="winner-team-chip-container">
                  <span 
                    className="team-chip clickable-chip" 
                    onClick={() => onNavigateToTeam(challenge.winner.participants.join(' & '))}
                  >
                    {challenge.winner.participants.join(' & ')}
                  </span>
                </div>
              )}
              <div className="winner-votes">🎵 {challenge.winner.votes} votes</div>
              <a 
                href={challenge.winner.sunoUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                className="btn-suno-large"
              >
                🎵 Listen on Suno
              </a>
            </div>
          </div>
        </div>
      )}

      {/* All Submissions Section */}
      <div className="week-submissions-section">
        <h3 className="submissions-section-title">All Submissions</h3>
        <div className="submissions-grid">
          {sortedSongs.map((song, index) => {
            const isThisSongPlaying = currentSong?.id === song.id && isPlaying;
            const isThisSongCurrent = currentSong?.id === song.id;
            
            return (
              <div key={song.id} className={`submission-card ${song.isWinner ? 'is-winner' : ''}`}>
                {song.isWinner && <div className="winner-badge">🏆 Winner</div>}
                <div className="submission-rank">#{index + 1}</div>
                
                <div 
                  className="submission-image"
                  onClick={() => onPlaySong && onPlaySong(song)}
                  style={{ cursor: 'pointer' }}
                >
                  <img src={song.imageUrl} alt={song.title} />
                  <div 
                    className={`play-overlay ${isThisSongPlaying ? 'playing' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (isThisSongCurrent) {
                        togglePlayPause();
                      } else {
                        onPlaySong && onPlaySong(song);
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        if (isThisSongCurrent) {
                          togglePlayPause();
                        } else {
                          onPlaySong && onPlaySong(song);
                        }
                      }
                    }}
                    tabIndex={0}
                    role="button"
                    aria-label={isThisSongPlaying ? `Pause ${song.title}` : `Play ${song.title}`}
                  >
                    {isThisSongPlaying ? '⏸' : '▶'}
                  </div>
                </div>
                
                <div className="submission-details">
                  <h4 className="submission-title">{song.title}</h4>
                  <div className="submission-participants">
                    {song.participants.map((participant, idx) => (
                      <React.Fragment key={participant}>
                        {idx > 0 && ' & '}
                        {onNavigateToArtist ? (
                          <span 
                            className="participant-chip" 
                            onClick={() => onNavigateToArtist(participant)}
                          >
                            {participant}
                          </span>
                        ) : (
                          <span>{participant}</span>
                        )}
                      </React.Fragment>
                    ))}
                  </div>
                  {onNavigateToTeam && song.participants.length >= 2 && (
                    <div className="submission-team-chip-container">
                      <span 
                        className="team-chip clickable-chip" 
                        onClick={() => onNavigateToTeam(song.participants.join(' & '))}
                      >
                        {song.participants.join(' & ')}
                      </span>
                    </div>
                  )}
                  <div className="submission-accounts">
                    {song.sunoAccounts.map((account, idx) => (
                      <span key={idx} className="suno-account">{account}</span>
                    ))}
                  </div>
                  
                  <div className="submission-actions">
                    <span className="submission-votes">🎵 {song.votes} votes</span>
                    <a 
                      href={song.sunoUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="btn-suno-small"
                    >
                      Listen on Suno
                    </a>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
