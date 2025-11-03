import React, { useState } from 'react';
import { teamsData } from '../data/mockData';

export default function Teams({ selectedTeam, setSelectedTeam, onPlaySong, onNavigateToArtist }) {
  const [searchQuery, setSearchQuery] = useState('');
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
    const victoriousSongs = (selectedTeam.compositions || []).filter(song => song.isWinner);
    const allSongs = selectedTeam.compositions || [];

    // Sort all songs by date descending
    const sortedSongs = [...allSongs].sort((a, b) => {
      if (a.year !== b.year) return b.year - a.year;
      return b.weekNumber - a.weekNumber;
    });

    // Group songs by week for display
    const songsByWeek = {};
    sortedSongs.forEach(song => {
      if (!songsByWeek[song.week]) {
        songsByWeek[song.week] = [];
      }
      songsByWeek[song.week].push(song);
    });

    return (
      <section className="page teams-page">
        <button onClick={handleBackToList} className="btn-back">
          ← Back to Teams
        </button>

        <div className="team-detail">
          {/* Main Team Banner - Simplified without subtitle */}
          <div className="team-detail-banner">
            <h1 className="team-detail-banner-title">🌿 {selectedTeam.name}</h1>
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
            </div>
          </div>

          {/* Member Tracking */}
          {selectedTeam.members && selectedTeam.members.length > 0 && (
            <div className="team-members-section">
              <h3>Team Members</h3>
              <div className="members-list">
                {selectedTeam.members.map((member, idx) => (
                  <div
                    key={idx}
                    className="member-card"
                    onClick={() => onNavigateToArtist && onNavigateToArtist(member.name)}
                    style={{ cursor: onNavigateToArtist ? 'pointer' : 'default' }}
                  >
                    <span className="member-name">{member.name}</span>
                    {member.sunoProfile && (
                      <a
                        href={member.sunoProfile}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-suno-mini"
                        onClick={(e) => e.stopPropagation()}
                      >
                        🎵 Suno Profile
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Victorious Songs List */}
          {victoriousSongs.length > 0 && (
            <div className="victories-section">
              <h3>🏆 Victories</h3>
              <div className="victories-list">
                {victoriousSongs.map((song, idx) => (
                  <div key={idx} className="victory-item">
                    <div className="victory-info">
                      <div className="victory-title">{song.title}</div>
                      <div className="victory-meta">
                        {song.week} • Theme: {song.theme} • {song.votes} votes
                      </div>
                    </div>
                    <button
                      className="victory-play-btn"
                      onClick={() => onPlaySong && onPlaySong({
                        id: `victory-${idx}`,
                        title: song.title,
                        participants: song.participants,
                        imageUrl: 'https://via.placeholder.com/200',
                        audioUrl: 'https://cdn.suno.com/audio/mock.mp3',
                        sunoUrl: song.sunoUrl
                      })}
                      aria-label={`Play ${song.title}`}
                    >
                      ▶
                    </button>
                    <a
                      href={song.sunoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-suno"
                    >
                      🎵 Listen on Suno
                    </a>
                    <span className="victory-icon">🏆</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* All Songs in Grid View by Week */}
          {allSongs.length > 0 && (
            <div className="songs-grid-section">
              <h3>All Compositions</h3>
              <div className="songs-by-week">
                {Object.entries(songsByWeek).map(([week, songs], weekIdx) => (
                  <div key={weekIdx} className="week-songs-group">
                    <div className="week-date-header">{week}</div>
                    <div className="songs-grid">
                      {songs.map((song, songIdx) => (
                        <div key={songIdx} className="song-card-compact">
                          <div className="song-card-compact-header">
                            <div className="song-card-title">
                              {song.title}
                              {song.isWinner && <span> 🏆</span>}
                            </div>
                            <button
                              className="song-play-btn-compact"
                              onClick={() => onPlaySong && onPlaySong({
                                id: `song-${weekIdx}-${songIdx}`,
                                title: song.title,
                                participants: song.participants,
                                imageUrl: 'https://via.placeholder.com/200',
                                audioUrl: 'https://cdn.suno.com/audio/mock.mp3',
                                sunoUrl: song.sunoUrl
                              })}
                              aria-label={`Play ${song.title}`}
                            >
                              ▶
                            </button>
                          </div>
                          <div className="song-card-theme">Theme: {song.theme}</div>
                          <div className="song-card-votes">{song.votes} votes</div>
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
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="teams-tab-list">
        {teamsData.map((team) => (
          <div
            key={team.id}
            className="team-item"
            onClick={() => handleTeamSelect(team)}
          >
            <div className="team-item-info">
              <span className="team-item-name">{team.name}</span>
            </div>
            <div className="team-item-stats">
              <span>{team.participations} participations</span>
              <span>{team.victories} victories</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
