import React, { useState } from 'react';
import { artistsData } from '../data/mockData';

export default function Artists() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedArtist, setSelectedArtist] = useState(null);
  const [showDropdown, setShowDropdown] = useState(false);

  const filteredArtists = artistsData.filter(artist =>
    artist.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleArtistSelect = (artist) => {
    setSelectedArtist(artist);
    setSearchQuery('');
    setShowDropdown(false);
  };

  const handleBackToList = () => {
    setSelectedArtist(null);
  };

  if (selectedArtist) {
    return (
      <section className="page artists-page">
        <button onClick={handleBackToList} className="btn-back">
          ← Back to Artists
        </button>
        
        <div className="artist-detail">
          <div className="artist-detail-header">
            <div className={`artist-rank-badge rank-${selectedArtist.rank.toLowerCase()}`}>
              {selectedArtist.rank}
            </div>
            <h2 className="artist-detail-name">{selectedArtist.name}</h2>
            {selectedArtist.sunoProfile && (
              <a 
                href={selectedArtist.sunoProfile} 
                target="_blank" 
                rel="noopener noreferrer"
                className="btn-suno-profile"
              >
                🎵 Suno Profile
              </a>
            )}
          </div>

          <div className="artist-stats-grid">
            <div className="stat-card">
              <div className="stat-value">{selectedArtist.participations}</div>
              <div className="stat-label">Participations</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{selectedArtist.victories}</div>
              <div className="stat-label">Victories</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{selectedArtist.petals}</div>
              <div className="stat-label">Petals</div>
            </div>
          </div>

          {selectedArtist.teams && selectedArtist.teams.length > 0 && (
            <div className="artist-teams">
              <h3>Teams</h3>
              <div className="teams-list">
                {selectedArtist.teams.map((team, idx) => (
                  <span key={idx} className="team-tag">{team}</span>
                ))}
              </div>
            </div>
          )}

          {selectedArtist.songs && selectedArtist.songs.length > 0 && (
            <div className="artist-songs">
              <h3>Songs</h3>
              <div className="history-grid">
                {selectedArtist.songs.map((song, idx) => (
                  <div key={idx} className="history-card">
                    <div className="history-card-header">
                      <h4>{song.title}</h4>
                      <span className="history-date">{song.week}</span>
                    </div>
                    <p className="history-theme">Theme: {song.theme}</p>
                    <div className="history-winner">
                      <div className="winner-details">
                        <p className="winner-team">Team: {song.team}</p>
                        <p className="winner-stats">{song.votes} votes{song.isWinner ? ' • 🏆 Winner' : ''}</p>
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
          )}
        </div>
      </section>
    );
  }

  return (
    <section className="page artists-page">
      <h2>Artists</h2>
      <p className="artists-intro">
        Explore the talented artists who have participated in Collab Warz challenges.
      </p>

      <div className="artist-search-container">
        <input
          type="text"
          className="artist-search"
          placeholder="Search for an artist..."
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setShowDropdown(e.target.value.length > 0);
          }}
          onFocus={() => setShowDropdown(searchQuery.length > 0)}
        />
        
        {showDropdown && filteredArtists.length > 0 && (
          <div className="artist-dropdown">
            {filteredArtists.slice(0, 10).map((artist) => (
              <div
                key={artist.id}
                className="artist-dropdown-item"
                onClick={() => handleArtistSelect(artist)}
              >
                <span className="artist-dropdown-name">{artist.name}</span>
                <span className={`artist-dropdown-rank rank-${artist.rank.toLowerCase()}`}>
                  {artist.rank}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="artists-list">
        {artistsData.map((artist) => (
          <div
            key={artist.id}
            className="artist-item"
            onClick={() => handleArtistSelect(artist)}
          >
            <div className="artist-item-info">
              <span className="artist-item-name">{artist.name}</span>
              <span className={`artist-rank-badge rank-${artist.rank.toLowerCase()}`}>
                {artist.rank}
              </span>
            </div>
            <div className="artist-item-stats">
              <span>{artist.participations} participations</span>
              <span>{artist.victories} victories</span>
              <span>{artist.petals} petals</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
