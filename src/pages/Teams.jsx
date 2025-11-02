import React, { useState } from 'react';
import { teamsData } from '../data/mockData';

export default function Teams() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [showDropdown, setShowDropdown] = useState(false);

  const filteredTeams = teamsData.filter(team =>
    team.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleTeamSelect = (team) => {
    setSelectedTeam(team);
    setSearchQuery('');
    setShowDropdown(false);
  };

  const handleBackToList = () => {
    setSelectedTeam(null);
  };

  // Group songs by week for the detail view
  const getSongsByWeek = (compositions) => {
    const grouped = {};
    compositions.forEach(song => {
      const key = `${song.year}-W${song.weekNumber}`;
      if (!grouped[key]) {
        grouped[key] = {
          week: song.week,
          weekNumber: song.weekNumber,
          year: song.year,
          songs: []
        };
      }
      grouped[key].songs.push(song);
    });
    
    // Sort by year and week number (descending)
    return Object.values(grouped).sort((a, b) => {
      if (a.year !== b.year) return b.year - a.year;
      return b.weekNumber - a.weekNumber;
    });
  };

  if (selectedTeam) {
    const songsByWeek = getSongsByWeek(selectedTeam.compositions || []);
    
    return (
      <section className="page teams-page">
        <button onClick={handleBackToList} className="btn-back">
          ← Back to Teams
        </button>
        
        <div className="team-detail">
          {/* Main Team Banner - matching main-banner style */}
          <div className="team-detail-banner">
            <h1 className="team-detail-banner-title">🎵 {selectedTeam.name}</h1>
          </div>

          {/* Team Statistics */}
          <div className="team-stats-section">
            <h3>Statistics</h3>
            <div className="team-stats-grid">
              <div className="stat-card">
                <div className="stat-value">{selectedTeam.participations}</div>
                <div className="stat-label">Participations</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{selectedTeam.victories}</div>
                <div className="stat-label">Victories</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{selectedTeam.petals}</div>
                <div className="stat-label">Petals</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">
                  <div className={`team-rank-badge rank-${selectedTeam.rank.toLowerCase()}`}>
                    {selectedTeam.rank}
                  </div>
                </div>
                <div className="stat-label">Rank</div>
              </div>
            </div>
          </div>

          {/* Member Tracking */}
          {selectedTeam.members && selectedTeam.members.length > 0 && (
            <div className="team-members-section">
              <h3>Team Members</h3>
              <div className="members-list">
                {selectedTeam.members.map((member, idx) => (
                  <div key={idx} className="member-card">
                    <span className="member-name">{member.name}</span>
                    {member.sunoProfile && (
                      <a 
                        href={member.sunoProfile} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="btn-suno-mini"
                      >
                        🎵 Profile
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Competition History & Songs by Week */}
          {songsByWeek.length > 0 && (
            <div className="team-songs-section">
              <h3>Competition History</h3>
              <p className="section-subtitle">Songs organized by week with results</p>
              {songsByWeek.map((weekData, weekIdx) => (
                <div key={weekIdx} className="week-section">
                  <h4 className="week-header">{weekData.week}</h4>
                  <div className="history-grid">
                    {weekData.songs.map((song, songIdx) => (
                      <div key={songIdx} className="history-card">
                        <div className="history-card-header">
                          <h4>{song.title}</h4>
                          {song.isWinner && <span className="winner-icon">🏆</span>}
                        </div>
                        <p className="history-theme">Theme: {song.theme}</p>
                        <div className="history-winner">
                          <div className="winner-details">
                            <p className="winner-team">Participants: {song.participants.join(', ')}</p>
                            <p className="winner-stats">
                              {song.votes} votes
                              {song.isWinner ? ' • Winner' : ''}
                            </p>
                          </div>
                        </div>
                        <a 
                          href={song.sunoUrl} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="btn-suno"
                        >
                          🎵 Listen on Suno
                        </a>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Total Compositions Summary */}
          <div className="team-summary">
            <p>
              <strong>{selectedTeam.compositions?.length || 0}</strong> total compositions • 
              <strong> {selectedTeam.victories}</strong> victories
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="page teams-page">
      <h2>Teams</h2>
      <p className="teams-intro">
        Explore the talented teams who have participated in Collab Warz challenges.
      </p>

      <div className="team-search-container">
        <input
          type="text"
          className="team-search"
          placeholder="Search for a team..."
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setShowDropdown(e.target.value.length > 0);
          }}
          onFocus={() => setShowDropdown(searchQuery.length > 0)}
        />
        
        {showDropdown && filteredTeams.length > 0 && (
          <div className="team-dropdown">
            {filteredTeams.slice(0, 10).map((team) => (
              <div
                key={team.id}
                className="team-dropdown-item"
                onClick={() => handleTeamSelect(team)}
              >
                <span className="team-dropdown-name">{team.name}</span>
                <span className={`team-dropdown-rank rank-${team.rank.toLowerCase()}`}>
                  {team.rank}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="teams-list">
        {teamsData.map((team) => (
          <div
            key={team.id}
            className="team-item"
            onClick={() => handleTeamSelect(team)}
          >
            <div className="team-item-info">
              <span className="team-item-name">{team.name}</span>
              <span className={`team-rank-badge rank-${team.rank.toLowerCase()}`}>
                {team.rank}
              </span>
            </div>
            <div className="team-item-stats">
              <span>{team.participations} participations</span>
              <span>{team.victories} victories</span>
              <span>{team.petals} petals</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
