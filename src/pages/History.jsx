import React from "react";
import { challengeHistory } from "../data/mockData";

export default function History({ onPlaySong, onNavigateToTeam }) {
  return (
    <section className="page history-page">
      <h2>Challenge History</h2>
      <p className="history-intro">
        Browse through past Collab Warz challenges and see who won each week!
      </p>

      <div className="history-grid">
        {challengeHistory.map(challenge => {
          const teamName = challenge.winner.participants.join(' & ');
          
          return (
            <div key={challenge.id} className="history-card">
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
                        onClick={() => onNavigateToTeam(teamName)}
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
                  className="history-play-btn"
                  onClick={() => onPlaySong && onPlaySong({
                    ...challenge.winner,
                    id: challenge.id,
                    imageUrl: challenge.winner.imageUrl || 'https://picsum.photos/seed/winner/200/200',
                    audioUrl: challenge.winner.audioUrl || '/test-audio/song-1.wav'
                  })}
                  aria-label={`Play ${challenge.winner.title}`}
                >
                  ▶
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}