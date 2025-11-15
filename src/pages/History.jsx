import React, { useState } from "react";
import { useAudioPlayer } from "../context/AudioPlayerContext";
import { challengeHistory } from "../data/mockData";
import WeekDetails from "../components/WeekDetails";

export default function History({ onPlaySong, onNavigateToTeam, onNavigateToArtist }) {
  const { currentSong, isPlaying, togglePlayPause } = useAudioPlayer();
  const [selectedChallenge, setSelectedChallenge] = useState(null);

  // If a challenge is selected, show the details view
  if (selectedChallenge) {
    return (
      <WeekDetails 
        challenge={selectedChallenge}
        onBack={() => setSelectedChallenge(null)}
        onPlaySong={onPlaySong}
        onNavigateToTeam={onNavigateToTeam}
        onNavigateToArtist={onNavigateToArtist}
      />
    );
  }

  // Otherwise show the history list
  return (
    <section className="page history-page">
      <h2>Challenge History</h2>
      <p className="history-intro">
        Browse through past Collab Warz challenges and see who won each week!
      </p>

      <div className="history-grid">
        {challengeHistory.map(challenge => {
          const teamName = challenge.winner.participants.join(' & ');
          const songId = challenge.id;
          const isThisSongPlaying = currentSong?.id === songId && isPlaying;
          const isThisSongCurrent = currentSong?.id === songId;
          
          return (
            <div 
              key={challenge.id} 
              className="history-card"
              onClick={() => setSelectedChallenge(challenge)}
              style={{ cursor: 'pointer' }}
            >
              <div className="history-card-header">
                <h3>Week {challenge.weekNumber} - {challenge.year}</h3>
                <span className="history-date">{new Date(challenge.endDate).toLocaleDateString()}</span>
              </div>
              
              <div className="history-theme">
                <strong>Theme:</strong> {challenge.theme}
              </div>
              
              <div className="history-winner">
                <div className="winner-icon">🏆</div>
                <div className="winner-details">
                  <div className="winner-song">{challenge.winner.title}</div>
                  <div className="winner-team">
                    {onNavigateToTeam ? (
                      <span 
                        className="team-chip clickable-chip"
                        onClick={(e) => {
                          e.stopPropagation();
                          onNavigateToTeam(teamName);
                        }}
                      >
                        {teamName}
                      </span>
                    ) : (
                      teamName
                    )}
                  </div>
                  <div className="winner-stats">
                    {challenge.winner.votes} votes · {challenge.totalSubmissions} submissions
                  </div>
                </div>
                <button 
                  className={`history-play-btn ${isThisSongPlaying ? 'playing' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (isThisSongCurrent) {
                      togglePlayPause();
                    } else {
                      onPlaySong && onPlaySong({
                        ...challenge.winner,
                        id: challenge.id,
                        imageUrl: challenge.winner.imageUrl || 'https://picsum.photos/seed/winner/200/200',
                        audioUrl: challenge.winner.audioUrl || '/test-audio/song-1.wav'
                      });
                    }
                  }}
                  aria-label={isThisSongPlaying ? `Pause ${challenge.winner.title}` : `Play ${challenge.winner.title}`}
                >
                  {isThisSongPlaying ? '⏸' : '▶'}
                </button>
              </div>
              <div className="view-details-hint">Click to view all submissions →</div>
            </div>
          );
        })}
      </div>
    </section>
  );
}