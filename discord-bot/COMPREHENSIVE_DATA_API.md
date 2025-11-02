# Comprehensive Data API Documentation

This document describes the comprehensive data tracking system and API endpoints for Collab Warz.

## Overview

The enhanced Collab Warz system now includes:
- **Normalized data storage** for Artists, Teams, Songs, and Weeks
- **Comprehensive tracking** of all competition data without redundancy  
- **Rich API endpoints** for frontend consumption
- **Historical analysis** and statistics
- **Artist career tracking** across all competitions

## Data Structure

### Artists Database (`artists_db`)
```json
{
  "user_id": {
    "name": "Display name",
    "suno_profile": "https://suno.com/@username",
    "discord_rank": "Seed|Sprout|Flower|Rosegarden|Eden",
    "stats": {
      "participations": 10,
      "victories": 3,
      "petals": 1250,
      "last_updated": "2024-01-15T10:30:00"
    },
    "team_history": [
      {
        "team_id": 123,
        "team_name": "Amazing Duo", 
        "week_key": "2024-W03",
        "won": true
      }
    ],
    "song_history": [456, 789, 101]
  }
}
```

### Teams Database (`teams_db`)
```json
{
  "team_id": {
    "name": "Team Name",
    "members": ["user_id_1", "user_id_2"],
    "stats": {
      "participations": 5,
      "victories": 2,
      "first_appearance": "2024-W01",
      "last_appearance": "2024-W05"
    },
    "songs_by_week": {
      "2024-W03": [456, 789],
      "2024-W05": [101]
    }
  }
}
```

### Songs Database (`songs_db`)
```json
{
  "song_id": {
    "title": "Song Title",
    "suno_url": "https://suno.com/song/abc123",
    "suno_song_id": "abc123def-456ghi-789jkl",
    "team_id": 123,
    "artists": ["user_id_1", "user_id_2"],
    "week_key": "2024-W03",
    "submission_date": "2024-01-15T10:30:00",
    "suno_metadata": {},
    "vote_stats": {
      "total_votes": 25,
      "final_position": 1,
      "won_week": true
    }
  }
}
```

### Weeks Database (`weeks_db`)
```json
{
  "week_key": {
    "theme": "Competition Theme",
    "start_date": "2024-01-15T00:00:00",
    "status": "active|voting|completed|cancelled",
    "teams": [123, 456],
    "songs": [789, 101],
    "total_votes": 150,
    "winner_team_id": 123,
    "winner_song_id": 789,
    "vote_breakdown": {"789": 25, "101": 15},
    "participants": ["user_id_1", "user_id_2", "user_id_3"]
  }
}
```

## API Endpoints

### Public Artist Endpoints

#### `GET /api/public/artists`
Get all artists with basic information.

**Response:**
```json
{
  "artists": [
    {
      "user_id": "123456789",
      "name": "Artist Name",
      "discord_rank": "Flower",
      "suno_profile": "https://suno.com/@artist",
      "stats": {
        "participations": 10,
        "victories": 3,
        "petals": 1250,
        "win_rate": 30.0
      },
      "member_info": {
        "username": "artist_user",
        "display_name": "Artist Name",
        "avatar_url": "https://cdn.discordapp.com/...",
        "is_online": "online"
      }
    }
  ],
  "total_count": 25,
  "timestamp": "2024-01-15T10:30:00Z"
}
```

#### `GET /api/public/artists/{user_id}`
Get detailed information for a specific artist.

**Response includes:**
- Complete team history with song details
- Full song discography with vote results
- Discord member information
- Career statistics

#### `GET /api/public/stats/artist/{user_id}`
Get comprehensive statistics for an artist.

**Response includes:**
- Advanced statistics (win rate, song count, etc.)
- Frequent teammates analysis
- Collaboration patterns
- Victory statistics by teammate

### Public Team Endpoints

#### `GET /api/public/teams`
Get all teams with basic information.

#### `GET /api/public/teams/{team_id}`
Get detailed information for a specific team including:
- Detailed member profiles
- Songs by week with vote results
- Team statistics and history

### Public Song Endpoints

#### `GET /api/public/songs`
Get all songs with basic information including:
- Team and artist details
- Vote statistics
- Week information

#### `GET /api/public/songs/{song_id}`
Get detailed information for a specific song including:
- Complete team and artist profiles
- Suno metadata
- Vote statistics and competition context

### Public Week Endpoints

#### `GET /api/public/weeks`
Get all competition weeks with basic information.

#### `GET /api/public/weeks/{week_key}`
Get detailed information for a specific week including:
- Complete team and song listings
- Vote breakdowns
- Winner information
- Participant details

### Statistics Endpoints

#### `GET /api/public/stats/leaderboard`
Get comprehensive leaderboards and statistics:
- Artists by victories, participations, petals
- Teams by victories
- Overall competition statistics

## Frontend Integration Examples

### React Hook for Artist Data
```javascript
import { useState, useEffect } from 'react';

function useArtist(userId) {
  const [artist, setArtist] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/public/artists/${userId}`)
      .then(res => res.json())
      .then(data => {
        setArtist(data.artist);
        setLoading(false);
      });
  }, [userId]);

  return { artist, loading };
}
```

### Artist Profile Component
```javascript
function ArtistProfile({ userId }) {
  const { artist, loading } = useArtist(userId);

  if (loading) return <div>Loading...</div>;

  return (
    <div className="artist-profile">
      <div className="artist-header">
        <img src={artist.member_info?.avatar_url} alt={artist.name} />
        <h1>{artist.name}</h1>
        <span className="rank">{artist.discord_rank}</span>
      </div>
      
      <div className="stats">
        <div>Victories: {artist.stats.victories}</div>
        <div>Participations: {artist.stats.participations}</div>
        <div>Win Rate: {(artist.stats.victories / artist.stats.participations * 100).toFixed(1)}%</div>
        <div>Petals: {artist.stats.petals}</div>
      </div>

      <div className="song-history">
        <h2>Songs</h2>
        {artist.song_history.map(song => (
          <div key={song.id} className="song-item">
            <a href={song.suno_url} target="_blank">
              {song.title}
            </a>
            <span>Week: {song.week_key}</span>
            <span>Votes: {song.votes}</span>
            {song.won_week && <span className="winner">🏆</span>}
          </div>
        ))}
      </div>

      <div className="team-history">
        <h2>Team History</h2>
        {artist.team_history.map(team => (
          <div key={`${team.team_id}-${team.week_key}`} className="team-item">
            <span>{team.team_name}</span>
            <span>Week: {team.week_key}</span>
            {team.won && <span className="winner">🏆</span>}
          </div>
        ))}
      </div>
    </div>
  );
}
```

### Leaderboard Component
```javascript
function Leaderboard() {
  const [leaderboard, setLeaderboard] = useState(null);

  useEffect(() => {
    fetch('/api/public/stats/leaderboard')
      .then(res => res.json())
      .then(data => setLeaderboard(data));
  }, []);

  if (!leaderboard) return <div>Loading...</div>;

  return (
    <div className="leaderboard">
      <h2>Top Artists by Victories</h2>
      {leaderboard.leaderboards.artists_by_wins.map((artist, index) => (
        <div key={artist.user_id} className="leaderboard-item">
          <span className="position">#{index + 1}</span>
          <img src={artist.member_info?.avatar_url} alt={artist.name} />
          <span className="name">{artist.name}</span>
          <span className="victories">{artist.stats.victories} wins</span>
          <span className="participations">{artist.stats.participations} entries</span>
        </div>
      ))}
    </div>
  );
}
```

## Integration with Existing Systems

### Bi-Weekly Mode Compatibility
The comprehensive data system works seamlessly with bi-weekly mode:
- Week data is only created during active competition weeks
- Artists and teams remain tracked across all weeks
- Statistics accurately reflect only competition weeks

### Automatic Data Population
- Artists are automatically created when they submit songs
- Teams are created dynamically based on submissions
- Songs are recorded with each Discord submission
- Week data is updated throughout competition lifecycle
- Winner declaration updates all related statistics

### Petal Integration
- Artist petal counts are synced from YAGPDB system
- Petal updates are tracked with timestamps
- API provides current petal standings for leaderboards

This comprehensive system provides complete visibility into Collab Warz competition data while maintaining efficient, normalized storage and rich API access for frontend applications.