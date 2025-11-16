# 🎵 Collab Warz Bot - Complete Documentation

## Table of Contents
1. [Overview](#overview)
2. [Installation & Configuration](#installation--configuration)
3. [Automatic Operation](#automatic-operation)
4. [Automatic Voting System](#automatic-voting-system)
5. [API System](#api-system)
   - [Public Frontend API](#public-frontend-api)
   - [Admin Panel API](#admin-panel-api)
   - [Members Directory API](#members-directory-api)
6. [Comprehensive Data API](#comprehensive-data-api)
   - [Data Structure](#data-structure)
   - [Comprehensive Data API Endpoints](#comprehensive-data-api-endpoints)
   - [Data Management Commands](#data-management-commands)
7. [Frontend Development Guide](#frontend-development-guide)
8. [Admin Commands](#admin-commands)
9. [Competition Phase Management](#competition-phase-management)
10. [Message Moderation System](#message-moderation-system)
11. [Confirmation System](#confirmation-system)
12. [AI Theme Generation](#ai-theme-generation)
13. [Week Management](#week-management)
14. [Testing & Debugging](#testing--debugging)
15. [Troubleshooting](#troubleshooting)

---

> 📚 **Complete Documentation**: This README contains all documentation including API guides, frontend examples, and implementation details previously in separate files (`PUBLIC_API.md`, `ADMIN_API.md`, `FRONTEND_CONFIG.md`).

## Overview

The **Collab Warz Bot** fully automates the management of a weekly music collaboration competition on Discord. It handles announcements, phases (submission/voting), reminders, and can even generate creative themes using AI. **Submissions are restricted to Suno.com URLs only.**

### Competition Cycles

#### 📅 **Weekly Mode** (Default)
- **Monday 9:00 AM** : 🎵 Submissions start + new theme
- **Thursday evening** : 🔔 Submission reminder  
- **Friday 12:00 PM** : 🗳️ Voting starts (submissions end) *OR* ⚠️ Week cancelled if insufficient teams
- **Saturday evening** : 🔔 Voting reminder
- **Sunday evening** : 🏆 Winner announcement
- **Sunday 9 PM+** : 🤖 AI theme generation for next week

#### 🗓️ **Bi-Weekly Mode** (Optional)
- **Week 1 (Odd weeks)** : Normal Collab Warz (Mon-Fri submissions, Fri-Sun voting, Sun winner)
- **Week 2 (Even weeks)** : � Off week (no competition, phase set to inactive)
- **Week 3 (Odd weeks)** : 🎵 Competition resumes with new theme
- **Week 4 (Even weeks)** : 💤 Off week (no competition)
- **Pattern continues** : Alternating active/inactive weeks

### Key Features
- ✅ **Complete automation** of competition cycle
- ✅ **Flexible scheduling** - Weekly or bi-weekly competition modes
- ✅ **Admin confirmations** for total control
- ✅ **AI generation** of creative themes
- ✅ **Smart management** of interruptions
- ✅ **Separate test channel** functionality
- ✅ **Adaptive timeouts** based on context
- ✅ **Configurable @everyone pings** for announcements
- ✅ **Discord timestamps** showing relative time in user's timezone
- ✅ **Automatic week cancellation** when insufficient teams participate
- ✅ **Suno.com URL validation** with restriction to Suno platform only
- ✅ **Public user commands** (!info and !status) for easy access to help
- ✅ **JWT security system** for secure admin panel authentication
- ✅ **Admin moderation endpoints** for complete back office management
- ✅ **Enhanced user messaging** with submission format guidance and command visibility

---

## Quick Start for Users

### 🎵 Public Commands (Anyone Can Use)
These commands are available to **all users** without admin permissions:

```bash
!info     # Competition guide & submission format help
!status   # Current competition status & detailed information
```

### 🎯 How to Participate
1. **Join during submission phase** (Monday to Friday noon)
2. **Submit your collaboration** in ONE Discord message:
   ```
   Team name: Amazing Duo
   @YourPartner check out our collab!
   https://suno.com/song/your-song-id
   ```
3. **Vote during voting phase** (Friday noon to Sunday): **https://collabwarz.soundgarden.app**
4. **Only Suno.com links are accepted** - other platforms and file attachments are not allowed

### ⚠️ Platform Restrictions
- ✅ **Accepted**: Suno.com URLs only
- ❌ **Rejected**: SoundCloud, YouTube, Bandcamp, Spotify, Google Drive links, file attachments

---

## Admin Installation & Configuration

### 1. Prerequisites
```bash
# Install Red-DiscordBot
pip install Red-DiscordBot

# Additional dependencies
pip install aiohttp
```

### 2. Cog Installation

#### Option A: Install from GitHub Repository (Recommended)

This is the easiest way to install and will allow for easy updates:

```bash
# Add the SoundGarden cogs repository
[p]repo add soundgarden https://github.com/Heymow/SoundGarden

# Install the Collab Warz cog
[p]cog install soundgarden collabwarz

# Load the cog
[p]load collabwarz
```

To update to the latest version:
```bash
[p]cog update collabwarz
[p]reload collabwarz
```

#### Option B: Manual Installation

If you prefer manual installation:
```bash
# 1. Clone or download the repository
git clone https://github.com/Heymow/SoundGarden.git

# 2. Copy the collabwarz folder to your Red-DiscordBot cogs directory
# Example path: ~/.local/share/Red-DiscordBot/data/<instance_name>/cogs/

# 3. Load the cog in Discord
[p]load collabwarz
```

### 3. Minimal Configuration (Required)
```bash
# Set announcement channel
[p]cw setchannel #collab-warz

# Set initial theme
[p]cw settheme Cosmic Dreams

# Enable automation
[p]cw toggle
```

### Advanced Configuration (Recommended)
```bash
# Set admin for confirmations
[p]cw setadmin @YourName

# Enable confirmation system
[p]cw confirmation

# Configure @everyone pings
[p]cw everyone

# Set test channel (optional)
[p]cw settestchannel #bot-test

# Configure AI (optional)
[p]cw setai https://api.openai.com/v1/chat/completions your_api_key gpt-4
[p]cw aitemp 0.8      # Set creativity level
[p]cw aitokens 200    # Set response length
```

---

## Automatic Operation

### Smart Scheduler
The bot checks **every hour** if it should post an announcement based on:
- The **day of the week** (Monday = submissions, Friday = voting, etc.)
- The **current phase** vs **expected phase**
- The **last announcement** posted to avoid duplicates

### Phase Detection
```
Monday-Thursday (0-3)     → "submission" phase
Friday-Sunday (4-6)       → "voting" phase
```

### Automatic Announcements
1. **Monday 9:00 AM** - New week start
2. **Thursday evening** - Submission reminder (if enabled)  
3. **Friday 12:00 PM** - Voting start + submissions end
4. **Saturday evening** - Voting reminder (if enabled)
5. **Sunday evening** - Winner announcement
6. **Sunday 9 PM+** - AI theme generation (if configured)

### @everyone Ping Settings
Announcements can optionally include @everyone pings:
- **Disabled by default** to avoid spam
- **Toggle with**: `[p]cw everyone`
- **Shows in status**: Current ping setting displayed
- **Applies to all** automatic and manual announcements

### Interruption Management
If you **restart the bot** or **manually change** the phase:
- Scheduler automatically detects the discrepancy
- Posts missing announcements if necessary
- Resynchronizes with the normal schedule

---

## Automatic Voting System

### Overview
Winners are **automatically determined** based on votes from your frontend website, eliminating manual admin decisions and ensuring complete transparency.

### How It Works
1. **Sunday 8:00 PM**: Bot checks internal voting results from integrated API
2. **Clear Winner**: Immediate announcement with vote counts and rep rewards
3. **Tie Detected**: Automatic 24-hour face-off between tied teams
4. **Face-off End**: Final winner determined, or random selection if still tied
5. **Next Week**: Automatically starts Monday (or Tuesday if face-off occurred)

### Frontend Integration
```bash
# Start integrated API server
[p]cw apiserver start

# Test all endpoints
[p]cw testpublicapi

# Check current voting results
[p]cw checkvotes
```

### Integrated API Architecture
Your frontend connects directly to the bot's built-in API:

**Vote Submission (POST):**
```javascript
POST /api/public/vote
{
  "team_name": "Team Alpha",
  "voter_id": "discord_user_id"
}

// Simple Security System:
// ✅ Discord session token validation (OAuth)
// ✅ Guild membership validation
// ✅ Individual vote tracking (prevent double voting)

Response (Success): {"message": "Vote recorded successfully"}
Response (Error): {"error": "User not found in server"}
Response (Error): {"error": "User has already voted"}
Response (Error): {"error": "Authentication required"}
```

**Get Voting Results (GET):**
```javascript
GET /api/public/voting
Response: {
  "results": [
    {
      "team_name": "Team Alpha",
      "votes": 127,
      "track_url": "https://suno.com/song/abc123",
      "members": [...],
      "song": {
        "title": "Starlight Journey",
        "audio_url": "https://cdn.suno.ai/abc123.mp3",
        "image_url": "https://cdn.suno.ai/abc123_cover.jpg",
        "duration": 185,
        "author_name": "CoolArtist",
        "author_handle": "coolartist",
        "author_profile_url": "https://suno.com/@coolartist",
        "suno_url": "https://suno.com/song/abc123"
      }
    }
  ],
  "total_votes": 292,
  "week": "2025-W44"
}
```

### Face-off System
When multiple teams tie for first place:

1. **Tie Detection**: Bot automatically detects equal vote counts
2. **24-Hour Face-off**: Special voting period begins immediately
3. **Delayed Schedule**: Next week starts Tuesday instead of Monday
4. **Final Determination**: Winner from face-off, or random if still tied

### Winner Announcements
**Normal Winner:**
```
🏆 WINNER ANNOUNCEMENT! 🏆

🎵 Winning Team: Amazing Duo
👥 Members: @Alice & @Bob

📊 Final Results:
🏆 Amazing Duo: 127 votes
• Digital Dreams: 89 votes
• Beat Masters: 45 votes

🌸 Rep Rewards:
• @Alice: +2 petals (Total: 15 petals)
• @Bob: +2 petals (Total: 8 petals)
```

**Face-off Winner:**
```
⚔️ FACE-OFF WINNER! ⚔️

🏆 Amazing Duo wins the 24-hour tie-breaker! 🏆

📊 Face-off Results:
🏆 Amazing Duo: 156 votes
• Digital Dreams: 134 votes
```

### Error Handling
- **API Offline**: Week cancelled with explanation
- **No Votes**: Week cancelled, new cycle starts
- **Face-off Timeout**: Random selection from tied teams
- **AutoReputation Offline**: Winner announced, rep distribution flagged for manual handling

### Manual Override
For emergencies only:
```bash
[p]cw declarewinner "Team Name" @user1 @user2  # 🚨 MANUAL OVERRIDE
```

---

## API System

The Collab Warz bot provides a comprehensive REST API ecosystem enabling both **public user frontends** and **secure admin panels**. This allows complete separation between Discord functionality and web interfaces while maintaining real-time synchronization.

### Quick Setup
```bash
[p]cw apiserver start                    # Start the API server
[p]cw apiconfig cors https://yoursite.com # Configure CORS
[p]cw admintoken generate               # Generate legacy admin token (sent via DM)
[p]cw admintoken generate-jwt           # Generate secure JWT token (RECOMMENDED)
[p]cw testpublicapi                    # Test all endpoints
```

## Public Frontend API

### Overview
Provides comprehensive competition data access for building user frontends **without authentication required**.

### Available Data
- 📊 **Competition Status**: Current phase, theme, timeline, team count
- 🎵 **Live Submissions**: Real-time submission list with member details
- 🗳️ **Voting Results**: Live vote counts during voting phases
- 📚 **Competition History**: Paginated historical data and winners
- 🏆 **Leaderboard**: Member statistics, win rates, all-time rankings
- 👥 **Member Directory**: Guild member list for team formation

### API Endpoints

#### GET `/api/public/status`
Get current competition status and timeline

**Response:**
```json
{
    "competition": {
        "phase": "submission",
        "theme": "Synthwave Dreams", 
        "week_cancelled": false,
        "team_count": 12,
        "week_start": "2025-10-28T00:00:00",
        "week_end": "2025-11-03T20:00:00",
        "voting_deadline": "2025-11-03T20:00:00"
    },
    "voting": {
        "results": {"Team Alpha": 127, "Team Beta": 89},
        "total_votes": 216
    },
    "next_events": {
        "event": "voting_results",
        "time": "2025-11-03T20:00:00", 
        "description": "Voting results and winner announcement"
    },
    "guild_info": {
        "name": "SoundGarden",
        "member_count": 150
    }
}
```

#### GET `/api/public/submissions`
Get current week submissions with member details

**Response:**
```json
{
    "competition": {
        "theme": "Synthwave Dreams",
        "phase": "submission",
        "week": "2025-W44"
    },
    "submissions": [
        {
            "team_name": "Digital Dreams",
            "track_url": "https://suno.com/song/abc123",
            "members": [
                {
                    "id": "123456789",
                    "username": "alice", 
                    "display_name": "Alice Producer",
                    "avatar_url": "https://cdn.discordapp.com/avatars/..."
                }
            ],
            "submitted_at": "2025-11-01T14:22:00",
            "vote_count": 45,
            "suno_metadata": {
                "id": "2619926b-bbb6-449d-9072-bded6177f3a0",
                "title": "Neon Waves",
                "audio_url": "https://example.com/audio.mp3",
                "image_url": "https://example.com/image.jpg", 
                "duration": 244.84,
                "author_name": "John Doe",
                "author_handle": "johndoe",
                "author_avatar": "https://example.com/avatar.jpg",
                "play_count": 1000,
                "upvote_count": 100,
                "tags": "synthwave, electronic, ambient"
            }
        }
    ],
    "count": 12
}
```

#### GET `/api/public/voting`
Get live voting results (available during voting phase)

**Response:**
```json
{
    "voting_available": true,
    "phase": "voting",
    "results": [
        {
            "team_name": "Digital Dreams",
            "votes": 127,
            "track_url": "https://suno.com/song/abc123", 
            "members": [/* member details */],
            "submitted_at": "2025-11-01T14:22:00"
        }
    ],
    "total_votes": 423,
    "voting_closed": false,
    "week": "2025-W44"
}
```

#### POST `/api/public/vote`
Submit a vote for a team (during voting phase)

**Request Body:**
```json
{
    "team_name": "Digital Dreams",
    "voter_id": "12345678901234567"
}
```

**Response:**
```json
{
    "success": true,
    "message": "Vote recorded for Digital Dreams",
    "team_name": "Digital Dreams", 
    "new_vote_count": 128,
    "week": "2025-W44",
    "timestamp": "2025-11-01T15:30:00"
}
```

#### GET `/api/public/history?page=1&per_page=10`
Get competition history with pagination and song details

**Response:**
```json
{
    "history": {
        "2025-W44": {
            "theme": "Ambient Soundscapes",
            "start_date": "2025-10-28T00:00:00",
            "end_date": "2025-11-03T20:00:00",
            "winner": {
                "team_name": "Ethereal Echoes",
                "members": ["Alice Producer", "Bob Beats"],
                "votes": 156,
                "track_url": "https://suno.com/song/def456",
                "song": {
                    "title": "Celestial Drift",
                    "audio_url": "https://cdn.suno.ai/def456.mp3",
                    "image_url": "https://cdn.suno.ai/def456_cover.jpg",
                    "duration": 201,
                    "author_name": "EtherealEchoes",
                    "author_handle": "ethereal_echoes",
                    "author_profile_url": "https://suno.com/@ethereal_echoes",
                    "suno_url": "https://suno.com/song/def456"
                }
            },
            "all_submissions": [
                {
                    "team_name": "Ethereal Echoes",
                    "song": { /* Same song object structure */ },
                    "members": [...],
                    "votes": 156
                }
                // ... other submissions
            ],
            "total_teams": 15,
            "total_votes": 423,
            "was_faceoff": false
        }
    },
    "pagination": {
        "page": 1, "per_page": 10, "total": 45, "pages": 5
    }
}
```

#### GET `/api/public/leaderboard` 
Get member statistics and all-time rankings with Suno profile integration

**Response:**
```json
{
    "leaderboard": [
        {
            "member_name": "Alice Producer",
            "wins": 8,
            "participations": 15, 
            "win_rate": 53.33,
            "average_votes": 156.25,
            "suno_handle": "alicebeats",
            "suno_profile_url": "https://suno.com/@alicebeats",
            "all_suno_handles": ["alicebeats", "alice_music"],
            "winning_songs": [
                {
                    "week": "2024-W45",
                    "title": "Epic Journey", 
                    "suno_url": "https://suno.com/song/xyz123",
                    "votes": 127
                }
            ],
            "member_info": {
                "id": "123456789",
                "display_name": "Alice Producer",
                "avatar_url": "https://cdn.discordapp.com/avatars/..."
            }
        }
    ],
    "statistics": {
        "total_competitions": 45,
        "total_participants": 89,
        "average_teams_per_week": 12.4
    }
}
```

## Admin Panel API

### Overview
Secure administrative API for building admin panels with **Bearer token authentication**.

### Security Features
- 🔐 **Bearer Token Authentication** - Secure 32-byte random tokens
- � **Discord Admin Validation** - Only configured Discord admins can generate/use tokens
- �📧 **DM Token Delivery** - Tokens sent privately via Discord
- 🔄 **Token Management** - Generate, revoke, check status anytime
- � **JWT Security** - Cryptographically signed tokens with expiration (RECOMMENDED)
- �🛡️ **CORS Protection** - Configurable allowed origins
- � **Admin Tracking** - Tokens tied to specific Discord admin users
- ⚠️ **Auto-Validation** - Revoked admin status automatically blocks API access

### Authentication Setup
```bash
# Set up Discord admin first (required)
[p]cw setadmin @YourDiscordUser

# Generate JWT token (RECOMMENDED - cryptographically signed with expiration)
[p]cw admintoken generate-jwt

# OR generate legacy token (32-byte random token)
[p]cw admintoken generate

# Check token status and ownership
[p]cw admintoken status

# Revoke access
[p]cw admintoken revoke
```

### Enhanced Security Model
1. **Discord Admin Configuration Required**: Only users configured via `[p]cw setadmin` or `[p]cw addadmin` can generate admin tokens
2. **JWT Token Generation**: Self-contained JSON Web Tokens with embedded expiration and user data
3. **Cryptographic Signatures**: HMAC-SHA256 signatures prevent token tampering
4. **Token Ownership Tracking**: Each token contains user ID and guild validation
5. **Automatic Validation**: If a user loses admin status, their token becomes invalid immediately
6. **Zero Storage Security**: No sensitive token data stored - only metadata for audit trails
7. **Expiration Handling**: Built-in 1-year expiration with timestamp validation

**Usage in requests:**
```javascript
headers: {
    'Authorization': 'Bearer YOUR_TOKEN_HERE'
}
```

### Admin Endpoints

#### GET `/api/admin/config`
Get current bot configuration

**Response:**
```json
{
    "guild": {"id": "123456789", "name": "SoundGarden"},
    "config": {
        "current_theme": "Synthwave Dreams",
        "current_phase": "submission", 
        "automation_enabled": true,
        "auto_delete_messages": true,
        "api_server_enabled": true,
        "cors_origins": ["https://yoursite.com"]
    }
}
```

#### POST `/api/admin/config`
Update bot configuration

**Request:**
```json
{
    "updates": {
        "current_theme": "New Theme",
        "auto_delete_messages": false,
        "everyone_ping": true
    }
}
```

#### POST `/api/admin/actions`
Supported actions (via backend queueing):
- `set_phase` - Immediately set phase (submission, voting, ended)
- `set_theme` - Set current theme
- `start_new_week` - Start a new week with a theme and reset submissions
- `clear_submissions` - Clear all submissions
- `cancel_week` - Cancel current week
- `next_phase` - Move to next phase
- `reset_week` - Reset week state
- `force_voting` - Force voting phase
- `announce_winners` - Force compute and announce winners
- `toggle_automation` - Toggle automated announcements

Execute administrative actions

**Available Actions:**
```json
{"action": "set_phase", "params": {"phase": "voting"}}
{"action": "set_theme", "params": {"theme": "New Theme"}}
{"action": "start_new_week", "params": {"theme": "Fresh Start"}}
{"action": "cancel_week", "params": {"reason": "Technical issues"}}
{"action": "clear_submissions", "params": {}}
{"action": "toggle_automation", "params": {}}
```

### Admin Moderation Endpoints

#### DELETE `/api/admin/submissions/{team_name}`
Remove a submission from a specific team

**Parameters:**
- `team_name`: The team name whose submission to remove

**Response:**
```json
{
    "success": true,
    "message": "Submission from TeamName removed",
    "timestamp": "2024-01-15T10:30:00.000Z"
}
```

#### DELETE `/api/admin/votes/{week}/{user_id}`
Remove a vote from a user for a specific week

**Parameters:**
- `week`: Week identifier (e.g., "2024-01-15")
- `user_id`: Discord user ID

**Response:**
```json
{
    "success": true,
    "message": "Vote from user 123456789 for week 2024-01-15 removed",
    "timestamp": "2024-01-15T10:30:00.000Z"
}
```

#### DELETE `/api/admin/weeks/{week}`
Remove an entire week record from competition history

**Parameters:**
- `week`: Week identifier to completely remove

**Response:**
```json
{
    "success": true,
    "message": "Week 2024-01-15 record completely removed",
    "timestamp": "2024-01-15T10:30:00.000Z"
}
```

#### GET `/api/admin/votes/{week}/details`
Get detailed voting information for audit purposes

**Parameters:**
- `week`: Week identifier to examine

**Response:**
```json
{
    "week": "2024-01-15",
    "theme": "Synthwave Dreams",
    "total_votes": 25,
    "vote_details": [
        {
            "user_id": "123456789",
            "username": "alice",
            "voted_for": "TeamAlpha",
            "voted_at": "2024-01-21T18:45:00"
        }
    ],
    "submissions": {
        "TeamAlpha": {
            "url": "https://suno.com/song/abc123",
            "submitted_by": "alice",
            "submitted_at": "2024-01-18T14:30:00",
            "song_metadata": {
                "title": "Neon Nights",
                "audio_url": "https://cdn1.suno.ai/audio123.mp3",
                "image_url": "https://cdn2.suno.ai/image123.jpeg",
                "author_profile_url": "https://suno.com/@alice",
                "duration": 180,
                "tags": ["synthwave", "electronic", "80s"]
            }
        }
    },
    "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### Admin Usage Examples

**Remove problematic submission:**
```bash
curl -X DELETE "http://localhost:8080/api/admin/submissions/TeamSpam" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

**Audit votes for specific week:**
```bash
curl "http://localhost:8080/api/admin/votes/2024-01-15/details" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

**Remove duplicate vote:**
```bash
curl -X DELETE "http://localhost:8080/api/admin/votes/2024-01-15/123456789" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

**Clean up corrupted week:**
```bash
curl -X DELETE "http://localhost:8080/api/admin/weeks/2024-01-08" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

## Members Directory API

### Overview
Provides Discord guild member list for team formation and validation.

#### GET `/api/members`
Get guild member directory (optional authentication)

**Response:**
```json
{
    "guild": {
        "id": "123456789",
        "name": "SoundGarden", 
        "member_count": 150
    },
    "members": [
        {
            "id": "987654321",
            "username": "alice",
            "display_name": "Alice Producer", 
            "avatar_url": "https://cdn.discordapp.com/avatars/...",
            "joined_at": "2024-01-15T10:30:00"
        }
    ]
}
```

## Comprehensive Data API

### Overview

The enhanced Collab Warz system includes a comprehensive data tracking system that provides:
- **Normalized data storage** for Artists, Teams, Songs, and Weeks
- **Comprehensive tracking** of all competition data without redundancy  
- **Rich API endpoints** for frontend consumption
- **Historical analysis** and statistics
- **Artist career tracking** across all competitions

### Data Structure

#### Artists Database (`artists_db`)
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

#### Teams Database (`teams_db`)
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

#### Songs Database (`songs_db`)
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

#### Weeks Database (`weeks_db`)
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

### Comprehensive Data API Endpoints

#### Public Artist Endpoints

**`GET /api/public/artists`** - Get all artists with basic information.

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

**`GET /api/public/artists/{user_id}`** - Get detailed information for a specific artist.

**Response includes:**
- Complete team history with song details
- Full song discography with vote results
- Discord member information
- Career statistics

**`GET /api/public/stats/artist/{user_id}`** - Get comprehensive statistics for an artist.

**Response includes:**
- Advanced statistics (win rate, song count, etc.)
- Frequent teammates analysis
- Collaboration patterns
- Victory statistics by teammate

#### Public Team Endpoints

**`GET /api/public/teams`** - Get all teams with basic information.

**`GET /api/public/teams/{team_id}`** - Get detailed information for a specific team including:
- Detailed member profiles
- Songs by week with vote results
- Team statistics and history

#### Public Song Endpoints

**`GET /api/public/songs`** - Get all songs with basic information including:
- Team and artist details
- Vote statistics
- Week information

**`GET /api/public/songs/{song_id}`** - Get detailed information for a specific song including:
- Complete team and artist profiles
- Suno metadata
- Vote statistics and competition context

#### Public Week Endpoints

**`GET /api/public/weeks`** - Get all competition weeks with basic information.

**`GET /api/public/weeks/{week_key}`** - Get detailed information for a specific week including:
- Complete team and song listings
- Vote breakdowns
- Winner information
- Participant details

#### Statistics Endpoints

**`GET /api/public/stats/leaderboard`** - Get comprehensive leaderboards and statistics:
- Artists by victories, participations, petals
- Teams by victories
- Overall competition statistics

#### User Membership Endpoints

**`GET /api/public/user/{user_id}/membership`** - Check if a user is a member of the Discord server.

**Response for members:**
```json
{
  "user_id": "123456789",
  "is_member": true,
  "member_info": {
    "username": "artist_user",
    "display_name": "Artist Name",
    "avatar_url": "https://cdn.discordapp.com/...",
    "joined_at": "2024-01-15T10:30:00",
    "status": "online",
    "roles": ["Sprout", "Active Member"]
  },
  "collab_warz_profile": {
    "name": "Artist Name",
    "discord_rank": "Sprout",
    "suno_profile": "https://suno.com/@artist",
    "stats": {
      "participations": 5,
      "victories": 2,
      "petals": 850
    }
  },
  "timestamp": "2024-01-15T10:30:00Z"
}
```

**Response for non-members:**
```json
{
  "user_id": "987654321",
  "is_member": false,
  "historical_participant": true,
  "note": "User has participated in Collab Warz but is no longer in the server",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### Data Management Commands

**`[p]cw syncdata`** - Migrate existing competition data into the comprehensive tracking system
- Safe operation that doesn't modify existing data
- Converts historical teams, songs, and winners
- Creates artist profiles from past participation

### Integration Features

**Bi-Weekly Mode Compatible**: Works seamlessly with alternating week competitions

**Real-Time Updates**: 
- Artist profiles updated with each submission
- Team statistics tracked automatically
- Song metadata recorded with vote results
- Week data compiled throughout competition lifecycle

**Winner Declaration Integration**: 
- Automatically updates all related statistics
- Tracks victory counts and patterns
- Updates artist and team records

## Frontend Development Guide

### React Hooks Examples

#### Competition Status Hook
```javascript
import { useState, useEffect } from 'react';

const useCompetitionStatus = () => {
    const [status, setStatus] = useState(null);
    const [loading, setLoading] = useState(true);
    
    const fetchStatus = async () => {
        try {
            const response = await fetch('/api/public/status');
            const data = await response.json();
            setStatus(data);
        } catch (error) {
            console.error('Status fetch failed:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStatus();
        const interval = setInterval(fetchStatus, 30000); // Poll every 30s
        return () => clearInterval(interval);
    }, []);

    return { status, loading, refetch: fetchStatus };
};

// Usage
const CompetitionBanner = () => {
    const { status, loading } = useCompetitionStatus();
    
    if (loading) return <div>Loading...</div>;
    if (!status) return null;

    const { competition, next_events } = status;
    
    return (
        <div className="competition-banner">
            <h2>🎵 {competition.theme}</h2>
            <p>Phase: <strong>{competition.phase}</strong></p>
            <p>Teams: <strong>{competition.team_count}</strong></p>
            {next_events && (
                <p>Next: <strong>{next_events.description}</strong></p>
            )}
        </div>
    );
};
```

#### Submissions Hook
```javascript
const useSubmissions = () => {
    const [submissions, setSubmissions] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchSubmissions = async () => {
            try {
                const response = await fetch('/api/public/submissions');
                const data = await response.json();
                setSubmissions(data.submissions || []);
            } catch (error) {
                console.error('Submissions fetch failed:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchSubmissions();
    }, []);

    return { submissions, loading };
};

// Usage
const SubmissionsList = () => {
    const { submissions, loading } = useSubmissions();

    if (loading) return <div>Loading submissions...</div>;

    return (
        <div className="submissions-grid">
            {submissions.map((submission, index) => (
                <div key={index} className="submission-card">
                    <h3>{submission.team_name}</h3>
                    
                    <div className="members">
                        {submission.members.map(member => (
                            <div key={member.id} className="member">
                                <img 
                                    src={member.avatar_url}
                                    alt={member.display_name}
                                    className="avatar"
                                />
                                <span>{member.display_name}</span>
                            </div>
                        ))}
                    </div>
                    
                    <a href={submission.track_url} target="_blank" rel="noopener noreferrer">
                        🎧 Listen on Suno
                    </a>
                    
                    {submission.vote_count && (
                        <div className="votes">❤️ {submission.vote_count} votes</div>
                    )}
                </div>
            ))}
        </div>
    );
};
```

#### Admin Panel Hook
```javascript
const useAdminAPI = (token) => {
    const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
    };

    const executeAction = async (action, params = {}) => {
        const response = await fetch('/api/admin/actions', {
            method: 'POST',
            headers,
            body: JSON.stringify({ action, params })
        });
        return await response.json();
    };

    const updateConfig = async (updates) => {
        const response = await fetch('/api/admin/config', {
            method: 'POST',
            headers, 
            body: JSON.stringify({ updates })
        });
        return await response.json();
    };

    return { executeAction, updateConfig };
};

// Usage
const AdminPanel = ({ token }) => {
    const api = useAdminAPI(token);

    const handlePhaseChange = async (newPhase) => {
        try {
            await api.executeAction('set_phase', { phase: newPhase });
            alert(`Phase changed to ${newPhase}`);
        } catch (error) {
            alert(`Error: ${error.message}`);
        }
    };

    return (
        <div className="admin-panel">
            <button onClick={() => handlePhaseChange('voting')}>
                Start Voting
            </button>
            <button onClick={() => handlePhaseChange('paused')}>
                Pause Competition
            </button>
        </div>
    );
};
```

### Environment Configuration
```bash
# .env file
REACT_APP_BOT_API_URL=http://localhost:8080/api/public
REACT_APP_MEMBERS_API_URL=http://localhost:8080/api/members
REACT_APP_ADMIN_API_URL=http://localhost:8080/api/admin
REACT_APP_ADMIN_TOKEN=your-admin-token-here

# Polling intervals (milliseconds)
REACT_APP_STATUS_POLL_INTERVAL=30000
REACT_APP_VOTING_POLL_INTERVAL=15000
```

### Error Handling
```javascript
const handleAPIError = async (response) => {
    if (!response.ok) {
        const error = await response.json();
        
        switch (response.status) {
            case 401:
                // Redirect to login
                window.location.href = '/login';
                break;
            case 403:
                alert('Access denied. Check your token.');
                break;
            case 500:
                alert('Server error. Please try again.');
                break;
            default:
                alert(error.message || 'Unknown error occurred');
        }
        
        throw new Error(error.message);
    }
    
    return response.json();
};
```

---

## 🎵 Suno.com Integration

### Overview
The bot automatically enriches submissions with **song metadata** from Suno.com, providing rich information for the frontend including titles, artwork, audio URLs, and author details.

### Features
- ✅ **Automatic ID extraction** from Suno.com URLs
- ✅ **Rich metadata** including title, duration, artwork, author info
- ✅ **Graceful fallback** if API unavailable or disabled
- ✅ **Configurable** per-guild integration

### Configuration
```bash
[p]cw sunoconfig enable           # Enable Suno integration
[p]cw sunoconfig disable          # Disable integration  
[p]cw sunoconfig url <api-url>    # Change API base URL
[p]cw testsuno <suno-url>         # Test metadata extraction with specific song
[p]cw testsunourl <suno-url>      # Test URL validation
```

### Metadata Provided
The following data is automatically fetched and included in API responses:

| Field | Description | Example |
|-------|-------------|---------|
| `title` | Song title | "Neon Waves" |
| `audio_url` | Direct MP3 link | "https://example.com/audio.mp3" |
| `image_url` | Cover artwork | "https://example.com/image.jpg" |
| `duration` | Song length (seconds) | 244.84 |
| `author_name` | Creator's display name | "John Doe" |
| `author_handle` | Creator's username | "johndoe" |
| `author_avatar` | Creator's profile picture | "https://example.com/avatar.jpg" |
| `play_count` | Total plays on Suno | 1000 |
| `upvote_count` | Likes/upvotes | 100 |
| `tags` | Musical genre tags | "synthwave, electronic" |

### Frontend Integration
**Clean Song Object**: All endpoints now include a `song` object for easy frontend integration:

```javascript
// Available in ALL endpoints: /api/public/submissions, /api/public/voting, /api/public/history
const submission = {
    "team_name": "Digital Dreams",
    "track_url": "https://suno.com/song/abc123",
    "song": {
        "title": "Neon Waves",
        "audio_url": "https://cdn.suno.ai/abc123.mp3",
        "image_url": "https://cdn.suno.ai/abc123_cover.jpg",
        "duration": 244.84,
        "author_name": "John Doe",
        "author_handle": "johndoe",
        "author_profile_url": "https://suno.com/@johndoe",
        "suno_url": "https://suno.com/song/abc123"
    },
    "suno_metadata": { /* Raw API data - for backward compatibility */ }
};

// Use in your React components
const SongCard = ({ submission }) => (
    <div className="song-card">
        <img src={submission.song?.image_url} alt="Cover" />
        <h3>{submission.song?.title || 'Unknown Track'}</h3>
        <p>by <a href={submission.song?.author_profile_url} target="_blank">
            {submission.song?.author_name}
        </a></p>
        <audio src={submission.song?.audio_url} controls />
        <a href={submission.song?.suno_url} target="_blank">View on Suno</a>
    </div>
);
```

### API Configuration
Default Suno API endpoint: `https://api.suno-proxy.click`

For custom deployments, update the base URL:
```bash
[p]cw sunoconfig url https://your-suno-proxy.com
```

---

## Message Moderation System

### Overview
The bot automatically moderates the submission channel to ensure clean, organized competition participation.

### Automatic Actions

#### ✅ **Valid Submissions**
- **Thumbs up reaction** (👍) added to message
- **Confirmation message** with team registration details
- **Message preserved** in channel

#### ❌ **Invalid Submissions** 
- **Message deleted** (if auto-delete enabled)
- **Error explanation** with specific guidance
- **Resubmission instructions** provided

#### 🚫 **Non-Submissions**
- **Off-topic messages deleted** during submission phase  
- **Explanation provided** about channel purpose
- **Direction to appropriate channels**

#### ⏰ **Wrong Phase Messages**
- **Messages deleted** when submissions are closed
- **Phase information** provided (voting/inactive)
- **Clear timeline** for next submission window

### 🎵 Suno-Only Policy (Platform Restrictions)

#### ✅ **Accepted Platforms**
- **Suno.com URLs only** - Both short format (`/s/...`) and full song format (`/song/...`)

#### ❌ **Rejected Platforms**
- **SoundCloud** - Not accepted
- **YouTube** - Not accepted  
- **Bandcamp** - Not accepted
- **Spotify** - Not accepted
- **Google Drive** - Not accepted
- **File attachments** - Not accepted
- **Any other platform** - Only Suno.com allowed

#### 🛡️ **Automatic Enforcement**
- **Immediate rejection** of forbidden platforms with clear error messages
- **URL validation** ensures proper Suno.com format
- **User guidance** provided for correct submission format
- **Website alternative** (https://collabwarz.soundgarden.app) always offered

### Admin Exemptions
**Admins bypass all restrictions:**
- ✅ Can post any message anytime
- ✅ Messages never deleted
- ✅ No moderation applied

### Configuration
```bash
[p]cw autodeletemsgs          # Toggle message deletion on/off
[p]cw toggle                  # Enable/disable bot automation
```

**Default**: Auto-deletion enabled for clean channel management

### Benefits
- **Clean submission channel**: Only valid submissions remain
- **Clear feedback**: Users get immediate guidance  
- **Reduced admin work**: Automatic moderation and cleanup

---

## Competition Phase Management

### Normal Competition Phases

#### 📝 **Submission Phase**
- Users can submit their collaborations
- Valid song URLs accepted and processed
- Team formation and registration available
- All submission rules enforced

#### 🗳️ **Voting Phase**  
- Submissions closed, voting open on frontend
- Late submissions may be accepted but not eligible for voting
- Users directed to website for vote casting
- Results processing begins

#### 💤 **Inactive Phase**
- No competition currently running (default state)
- All submissions blocked
- Users informed about next competition start
- Configuration and setup can be performed

### Competition Interruption Phases

#### ⏸️ **Paused Phase**
**When to use:** Technical issues, temporary admin absence, need to make adjustments
- Competition temporarily halted
- All progress and submissions preserved  
- Can resume at any time with `[p]cw resume`
- Clear communication about temporary nature

#### ❌ **Cancelled Phase**  
**When to use:** Major problems, unfair advantage discovered, insufficient participation
- Current week completely cancelled
- All submissions for the week are void
- No voting or winner announcement
- Fresh start available with `[p]cw nextweek`

#### 🏁 **Ended Phase**
**When to use:** Time constraints, early conclusion desired, manual intervention needed  
- Week manually concluded by admin
- Results finalized in current state
- No more submissions or voting accepted
- Can proceed to winner announcement or new week

### What Happens During "Wrong Phase"

When users try to submit outside the submission phase, their messages are automatically deleted with specific feedback:

#### 🗳️ **During Voting Phase**
```
❌ Message deleted: Submissions are closed!
🗳️ Voting is currently in progress
⏰ New submissions open Monday
🌐 Cast your vote at: [website]
```

#### ❌ **During Cancelled Phase**  
```
❌ Message deleted: Week cancelled!  
🚫 This week's competition has been cancelled by admins
📅 New competition starts next Monday
💬 Check announcements for details
```

#### ⏸️ **During Paused Phase**
```
❌ Message deleted: Competition paused!
⏸️ The competition is temporarily paused  
⏰ Will resume soon - stay tuned!
💬 Check announcements for updates
```

#### 🏁 **During Ended Phase**
```
❌ Message deleted: Week ended!
🏁 This week's competition has concluded
🏆 Results will be announced soon
📅 New week starts Monday
```

#### 💤 **During Inactive Phase**
```
❌ Message deleted: No competition running!
💤 No active competition at the moment
📅 Competitions run Monday-Sunday  
🔔 Follow announcements for next start
```

### Interruption Management Commands

```bash
[p]cw pause [reason]           # Pause competition temporarily
[p]cw resume                   # Resume paused competition
[p]cw cancelweek [reason]      # Cancel current week completely  
[p]cw endweek [message]        # Manually end current week
[p]cw setphase <phase>         # Set specific phase manually
```

### Phase Transition Examples

**Temporary Technical Issue:**
```bash
[p]cw pause Server maintenance in progress
# ... fix issues ...
[p]cw resume
```

**Unfair Advantage Discovered:**  
```bash
[p]cw cancelweek Collaboration rules violated - restarting fair competition
[p]cw nextweek
```

**Early Week Conclusion:**
```bash  
[p]cw endweek Amazing participation this week! Moving to voting early
[p]cw setphase voting
```

### Admin Communication

Each phase change includes:
- 🎯 **Clear status announcement** with appropriate emoji
- 📋 **Specific reason** (if provided)  
- ⏭️ **Next steps information** for users
- 📅 **Timeline expectations** when applicable

## Bi-Weekly Competition Mode

### Overview
The bot supports **bi-weekly mode** for communities that prefer longer, 2-week competition cycles instead of the default weekly format.

### Bi-Weekly Schedule
**🗓️ Alternating Pattern:** Competition week, then off week

#### Active Weeks (Odd weeks: 1, 3, 5, etc.)
- **Monday 9:00 AM**: 🎵 Competition starts, submissions open + new theme
- **Thursday Evening**: 🔔 Submission reminder ("Submissions end Friday noon")
- **Friday 12:00 PM**: 🗳️ Voting opens (submissions close)
- **Saturday Evening**: 🔔 Voting reminder ("Voting ends tomorrow")
- **Sunday Evening**: 🏆 Winner announcement
- **Sunday 9 PM+**: 🤖 AI theme generation for next competition

#### Off Weeks (Even weeks: 2, 4, 6, etc.)
- **Entire week**: 💤 No competition running (phase set to "inactive")
- **No submissions**: Users informed competition is paused
- **No voting**: Break period for community
- **Preparation time**: For next week's competition

### Enabling Bi-Weekly Mode

```bash
# Toggle between weekly and bi-weekly modes
[p]cw biweekly

# Check current mode in status
[p]cw status
```

### Key Differences from Weekly Mode

| Feature | Weekly Mode | Bi-Weekly Mode |
|---------|-------------|----------------|
| **Active Weeks** | Every week | Odd weeks only (1, 3, 5, etc.) |
| **Off Weeks** | None | Even weeks (2, 4, 6, etc.) |
| **Submission Time** | Mon-Fri noon (4.5 days) | Mon-Fri noon (4.5 days) |
| **Voting Time** | Fri noon-Sun (2.5 days) | Fri noon-Sun (2.5 days) |
| **Competition ID** | `2024-W42` | `2024-W43` (same format) |
| **Break Between** | None | 1 week off |

### Benefits of Bi-Weekly Mode

**🎵 For Creators:**
- Regular break weeks prevent burnout
- More time to prepare between competitions
- Better work-life balance for participants

**👥 For Communities:**
- Sustainable for smaller, busy communities
- Higher quality participation when active
- Less admin overhead with regular breaks

**🗓️ For Planning:**
- Predictable schedule (odd weeks = competition)
- Easier to coordinate with other events
- More sustainable long-term engagement

### Switching Between Modes

**⚠️ Important Notes:**
- Active competitions continue under their original mode
- New mode takes effect immediately for phase management
- Off weeks will be set to "inactive" phase automatically
- Historical data remains intact under original format

**Example Transition:**
```bash
# Currently in Week 42 (weekly mode) - even week
[p]cw biweekly                  # Enable bi-weekly mode
# Week 42 becomes inactive (even week = off week)
# Week 43 will start normally (odd week = competition week)
```

## Members API Server

### Overview
The bot can run a built-in HTTP API server to provide your frontend with the Discord guild member list. This enables:
- **Member validation**: Verify users are on the Discord server
- **Autocomplete dropdowns**: Easy partner selection in submission forms
- **Real-time sync**: Always up-to-date member information

### Configuration
```bash
# Start the API server
[p]cw apiserver start

# Configure server settings
[p]cw apiconfig port 8080
[p]cw apiconfig host 0.0.0.0
[p]cw apiconfig token your-secret-token
[p]cw apiconfig cors https://yoursite.com,*

# Test the server
[p]cw testapi
```

### API Endpoint
```
GET http://your-server:8080/api/members
Authorization: Bearer your-secret-token  (if configured)
```

**Response Format:**
```json
{
  "guild": {
    "id": "123456789012345678",
    "name": "SoundGarden",
    "member_count": 150
  },
  "members": [
    {
      "id": "987654321098765432",
      "username": "alice",
      "display_name": "Alice Producer",
      "discriminator": null,
      "avatar_url": "https://cdn.discordapp.com/avatars/...",
      "joined_at": "2024-01-15T10:30:00"
    }
  ],
  "timestamp": "2025-11-01T15:30:00"
}
```

### Security Features
- **Optional authentication**: Bearer token support
- **CORS configuration**: Control allowed origins
- **Member filtering**: Excludes bots, includes real users only
- **Rate limiting**: Built-in protection against abuse

### Frontend Integration
Use this API to:
1. **Populate dropdowns**: Show all server members for partner selection
2. **Validate submissions**: Check if mentioned users exist on server
3. **Real-time updates**: Sync member changes automatically

### Docker/Hosting
If running the bot in Docker, expose the API port:
```bash
docker run -p 8080:8080 your-bot-image
```

---

## Song Metadata & Audio Integration

### 🎵 Enhanced API Responses
All endpoints now include comprehensive song metadata for rich frontend experiences:

**Key Features:**
- 🎧 **Direct Audio Playback** - `audio_url` for embedded players
- 🖼️ **Cover Art Display** - `image_url` for visual elements  
- 👤 **Artist Profiles** - Suno profile links and handles
- 📊 **Leaderboard Integration** - Artist info in rankings
- 🎵 **Song Titles** - Proper track names everywhere

**Available in ALL endpoints:**
- `/api/public/submissions` - Current week songs
- `/api/public/voting` - Real-time voting with audio
- `/api/public/history` - Historical competitions with playback
- `/api/public/leaderboard` - Artist profiles and winning songs

```javascript
// Every submission now includes a clean song object
const song = submission.song; // Clean, frontend-ready format
const metadata = submission.suno_metadata; // Raw API data (backward compatibility)

// Build audio players, galleries, artist pages etc.
<audio src={song.audio_url} controls />
<img src={song.image_url} alt={song.title} />
<a href={song.author_profile_url}>@{song.author_handle}</a>
```

## Frontend Integration

### Overview
The Members API enables seamless integration between Discord and your website frontend, providing member validation and enhanced user experience.

### Use Cases

#### 1. Partner Selection Dropdown
Create an autocomplete dropdown for partner selection:

```javascript
// Fetch Discord members
async function loadMembers() {
    const response = await fetch('http://bot-server:8080/api/members', {
        headers: {
            'Authorization': 'Bearer your-secret-token'
        }
    });
    
    const data = await response.json();
    const members = data.members;
    
    // Populate dropdown
    const dropdown = document.getElementById('partner-select');
    dropdown.innerHTML = '<option>Select your partner...</option>';
    
    members.forEach(member => {
        const option = document.createElement('option');
        option.value = member.id;
        option.textContent = `${member.display_name} (@${member.username})`;
        dropdown.appendChild(option);
    });
}
```

#### 2. Real-time Validation
Validate partner selection before submission:

```javascript
function validatePartner(partnerId) {
    const member = members.find(m => m.id === partnerId);
    if (!member) {
        showError('Partner not found on Discord server!');
        return false;
    }
    return true;
}
```

#### 3. Form Integration
Complete form with validation:

```html
<form id="collaboration-form">
    <label for="team-name">Team Name:</label>
    <input type="text" id="team-name" required>
    
    <label for="partner-select">Choose Partner:</label>
    <select id="partner-select" required>
        <option value="">Loading members...</option>
    </select>
    
    <label for="track-url">Track URL:</label>
    <input type="url" id="track-url" required>
    
    <button type="submit">Submit Collaboration</button>
</form>
```

### Benefits

#### User Experience
- ✅ **Autocomplete**: No need to type Discord usernames manually
- ✅ **Visual selection**: Avatars and display names for easy identification  
- ✅ **Real-time validation**: Immediate feedback on partner availability
- ✅ **Error prevention**: Stops invalid submissions before they happen

#### Administration
- ✅ **Reduced errors**: Fewer invalid submissions to handle manually
- ✅ **Consistent data**: Same member validation on frontend and Discord
- ✅ **Better tracking**: Know which members are active collaborators

#### Technical
- ✅ **Live sync**: Always up-to-date member list
- ✅ **Secure**: Optional authentication and CORS protection
- ✅ **Lightweight**: Minimal data transfer, fast responses
- ✅ **Cross-platform**: Works with any frontend framework

### Integration Workflow

1. **Bot Setup**: Configure and start Members API server
2. **Frontend Fetch**: Load member list on page initialization  
3. **User Selection**: Present dropdown with server members
4. **Validation**: Check partner exists before form submission
5. **Discord Verification**: Bot validates @mentions against same data
6. **Consistency**: Both systems use identical member validation

### Error Handling
Handle common API scenarios:

```javascript
async function fetchMembers() {
    try {
        const response = await fetch('/api/members');
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        return data.members;
        
    } catch (error) {
        console.error('Failed to load members:', error);
        showError('Unable to load Discord members. Please try again.');
        return [];
    }
}
```

---

## Public Commands (Everyone Can Use)

These commands are available to **all users** without requiring admin permissions:

### User Help Commands
```bash
!info     # Competition guide & detailed submission format help
!status   # Current competition status & detailed information
```

### Key Features
- ✅ **No admin permissions required** - Anyone can use these commands
- ✅ **Always available** - Work in any channel, any time
- ✅ **Comprehensive help** - Complete submission format guidance
- ✅ **Real-time status** - Current theme, phase, deadlines, and team count
- ✅ **Website integration** - Direct links to https://collabwarz.soundgarden.app
- ✅ **Command discovery** - All error messages and announcements promote these commands

### Usage Examples
```bash
# Get help with submission format
!info

# Check current competition status
!status

# These work anywhere, anytime - no special permissions needed!
```

### Comprehensive Data React Examples

#### Artist Profile Hook and Component
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

#### Leaderboard Component
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

#### Song Browser Component
```javascript
function SongBrowser() {
  const [songs, setSongs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/public/songs')
      .then(res => res.json())
      .then(data => {
        setSongs(data.songs);
        setLoading(false);
      });
  }, []);

  if (loading) return <div>Loading songs...</div>;

  return (
    <div className="song-browser">
      <h2>All Songs</h2>
      <div className="songs-grid">
        {songs.map(song => (
          <div key={song.id} className="song-card">
            <h3>{song.title}</h3>
            <div className="artists">
              by {song.artist_names.join(' & ')}
            </div>
            <div className="team">Team: {song.team_name}</div>
            <div className="week">Week: {song.week_key}</div>
            <div className="votes">Votes: {song.votes}</div>
            {song.won_week && <div className="winner-badge">🏆 Winner</div>}
            <a href={song.suno_url} target="_blank" className="listen-btn">
              Listen on Suno
            </a>
          </div>
        ))}
      </div>
    </div>
  );
}
```

#### Week Detail Component
```javascript
function WeekDetail({ weekKey }) {
  const [week, setWeek] = useState(null);

  useEffect(() => {
    fetch(`/api/public/weeks/${weekKey}`)
      .then(res => res.json())
      .then(data => setWeek(data.week));
  }, [weekKey]);

  if (!week) return <div>Loading...</div>;

  return (
    <div className="week-detail">
      <h1>Week {weekKey}</h1>
      <h2>Theme: {week.theme}</h2>
      
      <div className="week-stats">
        <span>Status: {week.status}</span>
        <span>Teams: {week.teams.length}</span>
        <span>Songs: {week.songs.length}</span>
        <span>Total Votes: {week.total_votes}</span>
      </div>

      {week.winner_team_id && (
        <div className="winner-section">
          <h3>🏆 Winner</h3>
          {week.songs.find(s => s.is_winner) && (
            <div className="winning-song">
              <h4>{week.songs.find(s => s.is_winner).title}</h4>
              <p>by {week.songs.find(s => s.is_winner).artist_names.join(' & ')}</p>
            </div>
          )}
        </div>
      )}

      <div className="songs-results">
        <h3>All Submissions</h3>
        {week.songs.map(song => (
          <div key={song.id} className={`song-result ${song.is_winner ? 'winner' : ''}`}>
            <span className="title">{song.title}</span>
            <span className="artists">{song.artist_names.join(' & ')}</span>
            <span className="votes">{song.votes} votes</span>
            <a href={song.suno_url} target="_blank">Listen</a>
          </div>
        ))}
      </div>
    </div>
  );
}
```

#### User Membership Check Component
```javascript
function useUserMembership(userId) {
  const [membership, setMembership] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }
    
    fetch(`/api/public/user/${userId}/membership`)
      .then(res => res.json())
      .then(data => {
        setMembership(data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Error checking membership:', err);
        setLoading(false);
      });
  }, [userId]);

  return { membership, loading };
}

function UserMembershipStatus({ userId }) {
  const { membership, loading } = useUserMembership(userId);

  if (loading) return <div>Checking membership...</div>;
  if (!membership) return <div>Unable to check membership</div>;

  return (
    <div className="user-membership">
      {membership.is_member ? (
        <div className="member-info">
          <div className="status-badge member">✅ Server Member</div>
          <div className="member-details">
            <img src={membership.member_info.avatar_url} alt={membership.member_info.display_name} />
            <div>
              <h3>{membership.member_info.display_name}</h3>
              <p>@{membership.member_info.username}</p>
              <p>Joined: {new Date(membership.member_info.joined_at).toLocaleDateString()}</p>
              <p>Status: {membership.member_info.status}</p>
              {membership.member_info.roles.length > 0 && (
                <div className="roles">
                  Roles: {membership.member_info.roles.join(', ')}
                </div>
              )}
            </div>
          </div>
          
          {membership.collab_warz_profile && (
            <div className="collab-warz-info">
              <h4>Collab Warz Profile</h4>
              <p>Rank: {membership.collab_warz_profile.discord_rank}</p>
              <p>Participations: {membership.collab_warz_profile.stats.participations}</p>
              <p>Victories: {membership.collab_warz_profile.stats.victories}</p>
              <p>Petals: {membership.collab_warz_profile.stats.petals}</p>
              {membership.collab_warz_profile.suno_profile && (
                <a href={membership.collab_warz_profile.suno_profile} target="_blank">
                  Suno Profile
                </a>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="non-member-info">
          <div className="status-badge non-member">❌ Not a Server Member</div>
          {membership.historical_participant && (
            <div className="historical-note">
              <p>📜 Former participant - has competition history but left the server</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Usage in user profiles or team formation
function TeamFormation() {
  const [partnerUserId, setPartnerUserId] = useState('');
  const { membership: partnerMembership } = useUserMembership(partnerUserId);

  const canFormTeam = partnerMembership?.is_member;

  return (
    <div className="team-formation">
      <input 
        type="text" 
        placeholder="Enter partner's Discord user ID"
        value={partnerUserId}
        onChange={(e) => setPartnerUserId(e.target.value)}
      />
      
      {partnerUserId && (
        <UserMembershipStatus userId={partnerUserId} />
      )}
      
      {partnerUserId && partnerMembership && (
        <div className="team-status">
          {canFormTeam ? (
            <button className="form-team-btn" disabled={false}>
              ✅ Can Form Team
            </button>
          ) : (
            <button className="form-team-btn" disabled={true}>
              ❌ Cannot Form Team - User not in server
            </button>
          )}
        </div>
      )}
    </div>
  );
}
```

---

## Admin Commands

### Admin Management
The bot supports **multiple administrator levels** for flexible team management:

**Admin Access Levels:**
- **🔑 Primary Admin**: Receives confirmation DMs, manages main settings
- **👥 Additional Admins**: Full bot control without confirmation DMs
- **🛡️ Permission-Based**: Discord users with Administrator/Manage Messages/Manage Guild permissions

```bash
# Primary admin configuration  
[p]cw setadmin @user            # Set primary admin (confirmation DMs)

# Multiple admin management
[p]cw addadmin @user            # Add additional admin
[p]cw removeadmin @user         # Remove additional admin
[p]cw listadmins                # Shows primary, additional, and permission-based admins
```

**Example Multi-Admin Setup:**
```bash
[p]cw setadmin @owner           # Owner gets confirmation DMs
[p]cw addadmin @moderator1      # Mod can manage competitions  
[p]cw addadmin @moderator2      # Another mod with full access
[p]cw listadmins                # Verify setup
```

### Basic Configuration
```bash
[p]cw setchannel #channel       # Set announcement channel
[p]cw settheme New Theme        # Change current theme  
[p]cw setphase submission       # Force phase (submission/voting)
[p]cw toggle                    # Enable/disable automation
[p]cw everyone                  # Toggle @everyone ping in announcements
[p]cw biweekly                  # Toggle bi-weekly mode (2-week cycles)
[p]cw status                    # View current configuration
```

### Integrated Voting System
```bash
[p]cw checkvotes               # Check current voting results
# Voting handled via integrated API - no external configuration needed!
# Votes submitted via POST /api/public/vote endpoint
```

### Vote Security & Monitoring
```bash
[p]cw votestats                # Show detailed voting statistics
[p]cw clearvotes [user_id]     # Remove duplicate/fraudulent votes (all or specific user)
[p]cw adjustvotes team amount  # Manually adjust team vote count (+/-)

# Simple Security Commands
[p]cw sessionauth              # Configure Discord session authentication
[p]cw sessionauth enable       # Require Discord OAuth tokens for voting
[p]cw sessionauth disable      # Allow direct API access (testing only)
[p]cw sessionauth status       # Show current authentication status

# Examples:
[p]cw votestats                        # View voting statistics and results
[p]cw clearvotes 123456789012345678    # Clear specific user's duplicate votes
[p]cw clearvotes                       # Clean all duplicate votes automatically
[p]cw adjustvotes "Team Alpha" -2      # Remove 2 votes from Team Alpha
[p]cw adjustvotes "Team Beta" +1       # Add 1 vote to Team Beta
[p]cw sessionauth enable              # Enable Discord session validation
```

**� SIMPLE SECURITY APPROACH:**
- 🌐 **WEB INTERFACE PREFERRED**: Votes through official voting website with Discord OAuth
- � **SESSION TOKEN VALIDATION**: Frontend handles Discord authentication, bot validates tokens
- 🔒 **Guild membership validation**: Only server members can vote
- ⚡ **ONE-SHOT VOTING**: Users get exactly one vote attempt (no retries tolerated)
- 🛡️ **INSTANT IP BLOCKING**: Any failed attempt = immediate location ban
- 🕵️ **SCRIPT DETECTION**: Multiple users from same IP = automated attack blocked
- 👤 **INDIVIDUAL TRACKING**: One vote per user per week maximum
- 📊 **FRAUD DETECTION**: Automatic detection of all suspicious patterns
- 🧹 **VOTE CLEANUP**: Admin tools to remove fraudulent votes and adjust counts
- 📈 **DETAILED REPORTING**: Comprehensive security analysis and monitoring

**🎯 ZERO-TOLERANCE PHILOSOPHY:**
Web interface voting eliminates ALL legitimate reasons for errors:
- ❌ No typos possible (graphical interface)
- ❌ No invalid IDs (automatic user selection)  
- ❌ No network retries needed (proper error handling)
- ❌ No multiple attempts justified (one vote per week policy)
- ✅ Any deviation from normal flow = security threat = blocked

### API Server Configuration
```bash
[p]cw apiserver start/stop/status # Control API server
[p]cw apiconfig port 8080        # Configure server port
[p]cw apiconfig host 0.0.0.0     # Configure server host  
[p]cw apiconfig token secret     # Set authentication token
[p]cw apiconfig cors origins     # Set CORS allowed origins
[p]cw testapi                   # Test members API and show sample data
[p]cw testpublicapi             # Test public API endpoints
```

### Admin Web Panel
```bash
[p]cw admintoken generate        # Generate secure admin token (sent via DM)
[p]cw admintoken status          # Check current token status
[p]cw admintoken revoke          # Revoke admin access
```

### URL Validation Testing
```bash
[p]cw testsunourl [url]         # Test Suno.com URL format validation
```

### AI Configuration
```bash
[p]cw setai endpoint key [model]  # Configure AI API with optional model
[p]cw aimodel gpt-4              # Set AI model (gpt-4, claude-3, llama3, etc.)
[p]cw aitemp 0.8                 # Set creativity (0.0-2.0)
[p]cw aitokens 150               # Set max response length (50-500)
```

### Confirmation Management  
```bash
[p]cw setadmin @user            # Set admin for confirmations
[p]cw confirmation              # Enable/disable confirmations
[p]cw timeout 30                # Confirmation timeout (minutes)
[p]cw confirm [guild_id]        # Approve pending announcement
[p]cw deny [guild_id]           # Cancel pending announcement
```

### Manual Announcements
```bash
[p]cw announce submission_start    # Force manual announcement
[p]cw announce voting_start       # Types: submission_start, voting_start,
[p]cw announce reminder           #        reminder, winner
[p]cw announce winner
```

### Week Management
```bash
[p]cw nextweek [theme]          # Start new week
[p]cw reset                     # Reset announcement cycle
[p]cw schedule                  # View weekly schedule
```

### Testing & Debug
```bash
[p]cw settestchannel #test      # Set test channel
[p]cw test                      # Test all announcements
[p]cw help                      # Detailed help
```

---

## Confirmation System

### Principle
- **Without confirmation**: Announcements posted immediately
- **With confirmation**: Admin receives DM before each announcement

### Configuration
```bash
[p]cw setadmin @admin           # Required for confirmations
[p]cw confirmation              # Enable the system
[p]cw timeout 30                # Auto-post delay if no response
```

### Confirmation Workflow

1. **Bot detects** an announcement should be posted
2. **Admin receives DM** with preview and options
3. **Admin can**:
   - ✅ **Approve** (reaction or command)
   - ❌ **Cancel** (reaction or command)  
   - 🔄 **Change theme** then approve
   - ⏱️ **Do nothing** → auto-post after timeout

### Smart Timeouts
- **Submissions**: Timeout until next Monday 9 AM
- **Other announcements**: Configured timeout (default 30min)
- **Weekends**: No auto-post on weekends for submissions

### DM Controls
```
✅ Approve immediately
❌ Cancel announcement  
🔄 Change theme → Reply "newtheme: New Theme"
```

### Alternative Commands
```bash
[p]cw confirm [guild_id]        # Approve from anywhere
[p]cw deny [guild_id]           # Deny from anywhere
```

---

## AI Theme Generation

### Configuration
```bash
# Basic setup (uses default gpt-3.5-turbo)
[p]cw setai https://api.openai.com/v1/chat/completions your_api_key

# Advanced setup with specific model
[p]cw setai https://api.openai.com/v1/chat/completions your_api_key gpt-4
```

### AI Model Configuration
```bash
[p]cw aimodel gpt-4              # Set AI model
[p]cw aitemp 0.8                 # Set creativity (0.0-2.0)
[p]cw aitokens 150               # Set max response length (50-500)
```

### Compatible AI Providers
- ✅ **OpenAI** (GPT-3.5, GPT-4, GPT-4o) - Native support
- ✅ **LocalAI** - Full compatibility with local models
- ✅ **Ollama** (with OpenAI plugin) - Local LLM hosting
- ✅ **Anthropic Claude** (via OpenAI-compatible proxy)
- ✅ **Google Gemini** (via OpenAI-compatible proxy)
- ✅ **Any OpenAI-compatible API** - Universal support

### Configuration Examples

**OpenAI GPT-4:**
```bash
[p]cw setai https://api.openai.com/v1/chat/completions sk-proj-... gpt-4
[p]cw aitemp 0.7
```

**Local Ollama:**
```bash
[p]cw setai http://localhost:11434/v1/chat/completions ollama llama3
[p]cw aitemp 0.9
```

**Claude via Proxy:**
```bash
[p]cw setai https://your-proxy.com/v1/chat/completions api_key claude-3-sonnet
[p]cw aitemp 0.6
```

### Provider-Specific Setup

#### OpenAI
```bash
[p]cw setai https://api.openai.com/v1/chat/completions sk-proj-... gpt-4
# Works with: gpt-3.5-turbo, gpt-4, gpt-4o, gpt-4-turbo
```

#### LocalAI (Self-hosted)
```bash
[p]cw setai http://localhost:8080/v1/chat/completions local-key llama3
# Adjust URL to your LocalAI instance
```

#### Ollama (Local)
```bash
# First install Ollama OpenAI compatibility
# ollama serve --host 0.0.0.0:11434
[p]cw setai http://localhost:11434/v1/chat/completions ollama llama3
```

#### Anthropic (via Proxy)
```bash
# Use a proxy service that converts Anthropic to OpenAI format
[p]cw setai https://proxy.example.com/v1/chat/completions your_key claude-3-sonnet
```

#### Google Gemini (via Proxy)
```bash
# Use a proxy service that converts Gemini to OpenAI format
[p]cw setai https://proxy.example.com/v1/chat/completions your_key gemini-pro
```

### Model Performance Tips
- **GPT-4**: Best quality, slower, more expensive
- **GPT-3.5-turbo**: Good balance of speed/quality/cost
- **Claude-3**: Excellent for creative tasks
- **Local models**: Free but require local setup
- **Temperature 0.6-0.8**: Good for announcements
- **Temperature 0.8-1.2**: Better for creative themes

### Automatic Generation

#### Timing
- **Sunday 9 PM+**: Automatic generation for following week
- **Condition**: Winner announced + no existing theme

#### Workflow
1. **AI generates** a creative theme (e.g., "Ocean Depths")
2. **Admin receives DM** with preview
3. **Admin chooses**:
   - ✅ **Approve** the AI theme
   - ❌ **Keep** current theme  
   - 🎨 **Customize** → `nexttheme: My Theme`
4. **Monday 9:00 AM**: Theme applied automatically

### Manual Generation
```bash
[p]cw generatetheme             # Generate AI theme for next week
[p]cw setnexttheme "Theme"      # Manually set next week's theme
[p]cw confirmtheme [guild_id]   # Approve AI theme
[p]cw denytheme [guild_id]      # Reject AI theme
```

### AI Parameters
- **Temperature**: Controls creativity (0.0 = very focused, 2.0 = very creative)
  - Themes: Default 0.9 (creative)
  - Announcements: Default 0.8 (balanced)
- **Max Tokens**: Maximum response length (50-500)
  - Themes: Fixed 20 tokens (short responses)
  - Announcements: Default 150 tokens
- **Model**: Any OpenAI-compatible model name
  - Examples: `gpt-4`, `gpt-3.5-turbo`, `claude-3-sonnet`, `llama3`

### Manual Theme Setting
```bash
[p]cw setnexttheme "Underwater Adventure"  # Set theme for next week
[p]cw status                               # Check next week's theme
```

**Benefits of Manual Themes:**
- **Immediate**: Set theme anytime during the week
- **Override**: Replaces any AI-generated themes
- **Flexibility**: Change multiple times before Monday
- **No confirmation**: Applied directly without DM workflow

**When Applied:**
- **Monday 9:00 AM UTC**: Manual theme becomes active
- **Visible in status**: Shows in `[p]cw status` command
- **Survives restarts**: Persisted until applied or replaced

### Smart Logic
- **Admin priority**: Manual theme > automatic theme
- **No duplicates**: If theme exists, no auto-generation
- **Replacement**: Manual generation can replace existing theme
- **Failsafe**: If admin doesn't respond, AI theme applied anyway

### DM Theme Controls
```
✅ Approve AI theme
❌ Keep current theme
🎨 Custom theme → Reply "nexttheme: Your Theme"
```

### Fallback Without Admin Response
If admin **never** responds:
- **Monday 9:00 AM**: AI theme applied automatically
- **Admin notified**: Message about which theme was used
- **Competition continues** without interruption

---

## Week Management

### Week Interruption
```bash
[p]cw nextweek New Theme        # Restart immediately with new theme
[p]cw nextweek                  # Restart with current theme
```

**Effects**:
- Reset announcement cycle
- New "submission" phase 
- New theme if specified
- Immediate start announcement

### Theme Change Only
```bash
[p]cw settheme New Theme        # Change only theme, keep phase
```

### Reset Cycle
```bash
[p]cw reset                     # Reset announcement flags only
```

### Weekly Schedule
```bash
[p]cw schedule                  # Display complete schedule
```

**Shows**:
- Current vs expected phase
- Next scheduled announcements  
- Reminder status
- Timing information

---

## Discord Timestamps

### Timezone-Aware Deadlines
The bot automatically uses Discord's native timestamp formatting to show deadlines in each user's local timezone.

**Discord Timestamp Formats**:
- `<t:1234567890:R>` → "in 2 days" (relative time)
- `<t:1234567890:F>` → "Friday, December 31, 2024 at 12:00 PM" (full date/time)

### Automatic Generation
All deadline messages include:
- **Relative timestamps**: Shows "in X hours/days" 
- **Full timestamps**: Shows exact date and time
- **Automatic conversion**: Users see their local timezone

### Example Output
```
⏰ Submissions deadline: Friday, January 3, 2025 at 12:00 PM
⏰ Voting ends in 2 days
```

**Benefits**:
- No confusion about UTC times
- Works globally across all timezones
- Automatic daylight saving adjustments
- Native Discord functionality

---

## Team Participation Management

### Automatic Week Cancellation
The bot monitors team participation and automatically cancels weeks with insufficient submissions.

**How it works**:
1. **Friday noon**: Bot checks for minimum required teams
2. **Count submissions**: Messages with Suno.com links
3. **Cancel if insufficient**: Announces cancellation and schedules restart
4. **Monday restart**: Automatic restart with new theme

### Configuration Commands
```bash
[p]cw minteams 2                    # Set minimum teams required (default: 2)
[p]cw setsubmissionchannel #channel # Set channel to monitor for submissions
[p]cw countteams                    # Manually count current teams
```

### Submission Detection
The bot counts teams based on messages containing:
- **Suno.com URLs only** (other music platforms and file attachments are forbidden)

**⚠️ Forbidden Platforms**: SoundCloud, YouTube, Bandcamp, Spotify, Google Drive, file attachments
**✅ Allowed**: Suno.com URLs only

### Suno.com URL Validation
For Suno.com submissions, URLs must follow valid formats:
- **Short format**: `https://suno.com/s/kFacPCnBlw9n9oEP`
- **Song format**: `https://suno.com/song/3b172539-fc21-4f37-937c-a641ed52da26`

Invalid Suno URLs will be rejected with format guidance.

### Cancellation Process
When insufficient teams are detected:
```
⚠️ WEEK CANCELLED - INSUFFICIENT PARTICIPATION ⚠️

🎵 Theme: Digital Dreams

Unfortunately, we didn't receive enough submissions this week.

📅 Competition restarts: Monday, January 6, 2025 at 9:00 AM
🔄 New theme will be announced when we restart
```

### Benefits
- **Prevents empty voting phases**: No pointless votes with 1 submission
- **Maintains engagement**: Ensures competitive atmosphere
- **Automatic recovery**: Seamlessly restarts next Monday
- **Clear communication**: Users understand why and when restart happens

---

## Discord Submission Validation

### Automatic Format Checking
The bot can validate Discord submissions to ensure proper team formation and prevent duplicate submissions.

**Required format for Discord submissions**:
```
Team name: Amazing Duo
@YourPartner check out our track!
[Suno.com link only]
```

### Validation Rules
1. **Team Name Required**: Must include `Team name: YourTeamName`
2. **Partner Mention Required**: Must @mention collaboration partner  
3. **One Submission Per Team**: Each team name can only be used once per week
4. **One Team Per Person**: Each person can only be in one team per week
5. **Content Required**: Must have valid Suno.com link

### Error Messages
Invalid submissions receive automatic error messages:
```
❌ Team name missing: Please include `Team name: YourTeamName`
❌ Partner mention missing: Please mention your collaboration partner with @username  
❌ Team name already used: `Amazing Duo` has already submitted this week
❌ You're already in a team: You're part of team `Previous Team` this week
```

### Management Commands
```bash
[p]cw togglevalidation        # Enable/disable validation system
[p]cw autodeletemsgs          # Toggle automatic message deletion
[p]cw listteams              # Show all registered teams this week
[p]cw clearteams [week]      # Clear team registrations for week
[p]cw countteams            # Count both registered and raw submissions
```

### Website Integration
- **Preferred method**: Users should use the website form for submissions
- **Discord fallback**: Discord submissions with proper format are accepted
- **Hybrid counting**: Bot counts both registered teams and raw message detection

---

## Team History & Statistics

### Permanent Record Keeping
All team registrations are permanently stored for historical analysis and community insights.

**Historical Data Includes**:
- Team names and member compositions for each week
- Participation patterns and frequency
- Individual and server-wide statistics
- Searchable archives of all competitions

### History Commands
```bash
[p]cw history [weeks]           # Show recent team participation (default: 4 weeks)
[p]cw teamstats [@user]         # Individual stats or server overview  
[p]cw searchteams "query"       # Search teams by name or member
[p]cw listteams                # Current week teams only
```

### Example Output

**Team History**:
```
📊 Team Participation History

Week 2025-W44 (3 teams)
**Amazing Duo**: Alice & Bob
**Sonic Boom**: Charlie & David  
**Beat Masters**: Eve & Frank

Week 2025-W43 (2 teams)
**Dynamic Duo**: Bob & Grace
**Solo Artists**: Alice & Henry
```

**Individual Statistics**:
```
📊 Participation Stats: Alice

2025-W44: Amazing Duo (with Bob)
2025-W43: Solo Artists (with Henry)  
2025-W42: Night Owls (with Charlie)

Summary: Total participations: 3
```

**Search Results**:
```
🔍 Search Results for 'Alice'

👤 2025-W44: Amazing Duo (Alice & Bob)
👤 2025-W43: Solo Artists (Alice & Henry)
📋 2025-W41: Alice in Wonderland (Alice & Eve)

Legend: 📋 = Team name match • 👤 = Member name match
```

### Data Management
```bash
[p]cw clearteams [week]        # PERMANENT deletion with confirmation
                               # ⚠️ Use with extreme caution
```

**Safety Features**:
- Confirmation dialog with team preview
- 30-second timeout for safety
- Clear warnings about permanent deletion
- Historical data is preserved by default

### Benefits
- **Community insights**: Track participation trends and popular collaborations
- **Recognition**: Identify most active community members
- **Nostalgia**: Browse past competitions and memorable team names
- **Analytics**: Understand community engagement patterns

---

## AutoReputation Rep Rewards System

### Automatic Winner Rewards
Winners of each weekly competition automatically receive rep points (petals) through integration with the AutoReputation cog.

**Integration Features**:
- **Automatic rep distribution**: Winners get petals without manual intervention
- **Real-time totals**: Winner announcements show gained and total petals
- **Internal API calls**: Direct communication with AutoReputation cog
- **Flexible amounts**: Configurable reward amounts per winner

### Configuration Commands
```bash
[p]cw setrepamount 2                     # Set petals per winner (default: 2)
[p]cw declarewinner "Team Name" @user1 @user2  # Manually declare winner
[p]cw winners [weeks]                    # Show recent winners and rep status
```

### How It Works
1. **Admin declares winner** using `[p]cw declarewinner` or automatic voting system
2. **Bot uses AutoReputation API** to distribute rewards:
   - Calls `auto_rep.api_add_points()` for each winner
   - Calls `auto_rep.api_get_points()` to get updated totals
3. **Enhanced winner announcement** posted with rep information
4. **Winners recorded** in permanent history

### Example Winner Announcement
```
🏆 **WINNER ANNOUNCEMENT!** 🏆

🎉 Congratulations to the champions of **Digital Dreams**! 🎉

**🎵 Winning Team:** `Amazing Duo`
**👥 Members:** @Alice & @Bob
**🎧 Winning Song:** https://suno.com/song/3b172539-fc21-4f37-937c-a641ed52da26
**� Title:** "Neon Cityscape"
**⏱️ Duration:** 185.3s

**📊 Final Results:**
🏆 **Amazing Duo**: 45 votes
• **Digital Warriors**: 38 votes
• **Synth Masters**: 22 votes
• **Beat Collective**: 18 votes
• **Sound Architects**: 12 votes

**�🌸 Rep Rewards:**
• @Alice: +2 petals (Total: 15 petals)
• @Bob: +2 petals (Total: 8 petals)

🔥 Incredible collaboration and amazing music! 🎵✨

🌐 **Listen to all tracks:** https://collabwarz.soundgarden.app
💡 **Commands:** Use `!info` for competition guide or `!status` for details

🔥 Get ready for next week's challenge!

*New theme drops Monday morning!* 🚀
```

### Requirements
**Prerequisites**:
- AutoReputation cog must be loaded on the same Redbot instance
- No channel configuration needed - uses internal API calls

**API Methods Used**:
- `api_add_points(guild, user_id, amount, reason, source_cog)`: Add petals to user
- `api_get_points(guild, user_id)`: Get user's current petal count

### Winner Management
```bash
[p]cw winners 4             # Show last 4 weeks of winners
```

**Winner History Display**:
```
🏆 Recent Winners

Week 2025-W44
**Amazing Duo**
Alice & Bob
Rep: ✅ ✅

Week 2025-W43  
**Dynamic Duo**
Charlie & David
Rep: ✅ ❌

Legend: ✅ = Rep given • ❌ = Failed • ❓ = Unknown
```

### Error Handling
- **AutoReputation cog not loaded**: Rep distribution fails gracefully
- **API errors**: Tracked in winner history with failed status
- **Missing users**: Graceful fallback with user ID display

### Benefits
✅ **Automated rewards**: No manual rep distribution needed  
✅ **Transparent totals**: Users see their current rep in announcements  
✅ **Audit trail**: Complete history of all rep distributions  
✅ **Flexible configuration**: Adjustable reward amounts
✅ **Integration**: Seamless AutoReputation cog integration via internal API

---

## Testing & Debugging

### Test Channel
```bash
[p]cw settestchannel #bot-test  # Set separate test channel
[p]cw test                      # Test ALL announcements in test channel
```

**Benefits**:
- Test without spamming main channel
- Verify announcement templates
- Test AI generation
- Debug configurations

### Force Announcements
```bash
[p]cw announce submission_start # Immediate post (bypass confirmations)
[p]cw announce voting_start     # Available types:
[p]cw announce reminder         # - submission_start
[p]cw announce winner           # - voting_start  
                                # - reminder
                                # - winner
```

### Complete Status Command
```bash
[p]cw status                    # Shows EVERYTHING:
```
- Current configuration (channel, theme, phase)
- Automation and confirmation status
- Configured admin and timeouts
- Pending announcements
- AI configuration (model, temperature, tokens)
- @everyone ping setting
- Next week theme status
- Upcoming scheduled events

### Debug Logs
The bot displays in console:
- Theme generation/application
- Confirmation sending
- Configuration errors
- Scheduler status

---

## Complete Implementation Examples

### Full Voting System Workflow

This example demonstrates a complete integration from frontend submission to Discord winner announcement.

#### 1. Frontend Submission Form
```html
<!DOCTYPE html>
<html>
<head>
    <title>Collab Warz Submission</title>
</head>
<body>
    <form id="collab-form">
        <h2>🎵 Submit Your Collaboration</h2>
        
        <label for="team-name">Team Name:</label>
        <input type="text" id="team-name" required 
               placeholder="Enter your team name...">
        
        <label for="partner-select">Choose Partner:</label>
        <select id="partner-select" required>
            <option value="">Loading Discord members...</option>
        </select>
        
        <label for="track-url">Track URL:</label>
        <input type="url" id="track-url" required 
               placeholder="Suno.com URL only (e.g., https://suno.com/s/...)">
        
        <button type="submit">Submit Collaboration</button>
        <div id="status"></div>
    </form>

    <script>
        let discordMembers = [];
        
        // Load Discord members on page load
        window.addEventListener('load', loadDiscordMembers);
        
        async function loadDiscordMembers() {
            try {
                const response = await fetch('http://bot-server:8080/api/members', {
                    headers: {
                        'Authorization': 'Bearer your-secret-token'
                    }
                });
                
                if (!response.ok) {
                    throw new Error('Failed to fetch members');
                }
                
                const data = await response.json();
                discordMembers = data.members;
                
                populatePartnerDropdown();
                
            } catch (error) {
                document.getElementById('status').innerHTML = 
                    '<div style="color: red;">⚠️ Could not load Discord members</div>';
            }
        }
        
        function populatePartnerDropdown() {
            const select = document.getElementById('partner-select');
            select.innerHTML = '<option value="">Choose your partner...</option>';
            
            discordMembers.forEach(member => {
                const option = document.createElement('option');
                option.value = member.id;
                option.textContent = `${member.display_name} (@${member.username})`;
                select.appendChild(option);
            });
        }
        
        // Form submission with validation
        document.getElementById('collab-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const teamName = document.getElementById('team-name').value;
            const partnerId = document.getElementById('partner-select').value;
            const trackUrl = document.getElementById('track-url').value;
            
            // Validate partner exists
            const partner = discordMembers.find(m => m.id === partnerId);
            if (!partner) {
                showStatus('❌ Please select a valid Discord member as your partner', 'error');
                return;
            }
            
            // Submit to your backend
            const submissionData = {
                team_name: teamName,
                partner_discord_id: partnerId,
                partner_username: partner.username,
                track_url: trackUrl,
                submitted_at: new Date().toISOString()
            };
            
            try {
                const response = await fetch('/api/submissions', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(submissionData)
                });
                
                if (response.ok) {
                    showStatus('✅ Collaboration submitted successfully!', 'success');
                    document.getElementById('collab-form').reset();
                } else {
                    showStatus('❌ Submission failed. Please try again.', 'error');
                }
                
            } catch (error) {
                showStatus('❌ Network error. Please check your connection.', 'error');
            }
        });
        
        function showStatus(message, type) {
            const statusDiv = document.getElementById('status');
            statusDiv.innerHTML = `<div style="color: ${type === 'error' ? 'red' : 'green'}; margin-top: 10px;">${message}</div>`;
            
            if (type === 'success') {
                setTimeout(() => {
                    statusDiv.innerHTML = '';
                }, 5000);
            }
        }
    </script>
</body>
</html>
```

#### 2. Backend API Integration
```javascript
// Express.js backend example
const express = require('express');
const app = express();

// Store submissions for voting API
let submissions = [];

app.use(express.json());

// Receive frontend submissions
app.post('/api/submissions', (req, res) => {
    const { team_name, partner_discord_id, partner_username, track_url } = req.body;
    
    // Validate and store submission
    const submission = {
        id: Date.now(),
        team_name,
        partner_discord_id,
        partner_username,
        track_url,
        votes: 0,
        submitted_at: new Date().toISOString()
    };
    
    submissions.push(submission);
    
    res.json({ success: true, submission_id: submission.id });
});

// Voting API for Discord bot
app.get('/api/voting/results', (req, res) => {
    const apiKey = req.headers['x-api-key'];
    
    // Validate bot API key
    if (apiKey !== 'your-bot-api-key') {
        return res.status(401).json({ error: 'Invalid API key' });
    }
    
    // Return submissions sorted by votes
    const sortedSubmissions = submissions
        .sort((a, b) => b.votes - a.votes)
        .map(sub => ({
            team_name: sub.team_name,
            votes: sub.votes,
            track_url: sub.track_url
        }));
    
    res.json({
        competition_active: true,
        submissions: sortedSubmissions,
        total_votes: submissions.reduce((sum, sub) => sum + sub.votes, 0)
    });
});

// Public voting endpoint
app.post('/api/vote/:submissionId', (req, res) => {
    const submissionId = parseInt(req.params.submissionId);
    const submission = submissions.find(s => s.id === submissionId);
    
    if (submission) {
        submission.votes++;
        res.json({ success: true, new_vote_count: submission.votes });
    } else {
        res.status(404).json({ error: 'Submission not found' });
    }
});

app.listen(3000, () => {
    console.log('🎵 Collab Warz API running on port 3000');
});
```

#### 3. Discord Bot Configuration
```bash
# Configure integrated API server
[p]cw apiconfig port 8080
[p]cw apiconfig cors http://your-website.com
[p]cw apiserver start

# Generate admin token for management
[p]cw admintoken generate

# Test the integration
[p]cw testpublicapi
```

#### 4. Complete Automation Result
```
🎵 **Monday 9:00 AM** - Submissions Start
   ├── Bot posts theme announcement
   └── Frontend form becomes available

📝 **During Week** - Users Submit
   ├── Frontend validates Discord members
   ├── Backend stores submissions
   └── Discord messages also accepted (fallback)

🗳️ **Friday 12:00 PM** - Voting Starts  
   ├── Bot uses internal voting storage
   ├── Determines winners automatically
   └── Posts voting announcement

🏆 **Sunday Evening** - Winners Announced
   ├── Bot declares winners based on votes
   ├── Handles ties with face-off system
   └── Prepares next week's theme
```

### Member Validation Examples

#### Valid Discord Submissions
```
✅ VALID: Suno.com submission (short format)
Team name: AI Creators
@charlie check our AI-generated collaboration!
https://suno.com/s/kFacPCnBlw9n9oEP

✅ VALID: Suno.com submission (song format)
Team name: Digital Dreams
@diana our Suno creation is ready!
https://suno.com/song/3b172539-fc21-4f37-937c-a641ed52da26
```

#### Invalid Discord Submissions
```
❌ INVALID: Missing team name
@charlie our song is ready!
https://suno.com/s/validID123abc89
→ Bot response: "❌ Team name missing: Please include `Team name: YourTeamName`"

❌ INVALID: Partner not on server  
Team name: External Collab
@unknown_user from another server
https://suno.com/s/track123abc89de
→ Bot response: "❌ @unknown_user is not a member of the SoundGarden Discord server"

❌ INVALID: No partner mentioned
Team name: Solo Project
My new track without collaboration
https://suno.com/s/solo456abc89def
→ Bot response: "❌ Partner mention missing: Please mention your collaboration partner with @username"

❌ INVALID: Forbidden platform (SoundCloud)
Team name: Old School
@alice our track on SoundCloud!
https://soundcloud.com/track/123
→ Bot response: "❌ Only Suno.com URLs are accepted."

❌ INVALID: Forbidden platform (YouTube)
Team name: Video Track
@bob check our YouTube upload!
https://youtube.com/watch?v=123
→ Bot response: "❌ Only Suno.com URLs are accepted. Please use a Suno.com link."

❌ INVALID: Invalid Suno.com URL format
Team name: AI Experiment
@alice our track is on Suno!
https://suno.com/invalid/url/format
→ Bot response: "❌ Invalid Suno.com URL format. Valid formats: https://suno.com/s/... or https://suno.com/song/..."
```

### Production Deployment Checklist

#### 1. Bot Configuration
```bash
# Essential settings
[p]cw setchannel #collab-warz
[p]cw setadmin @yourusername  
[p]cw toggle  # Enable automation

# Integrated API server (voting + members + admin)
[p]cw apiconfig port 8080
[p]cw apiconfig host 0.0.0.0
[p]cw apiconfig cors https://your-website.com
[p]cw apiserver start
[p]cw admintoken generate  # Get admin token via DM
[p]cw testpublicapi       # Verify all endpoints

# Optional: AI themes
[p]cw setai https://api.openai.com/v1/chat/completions sk-proj-... gpt-4
[p]cw enableai
```

#### 2. Server Requirements
```yaml
# Docker Compose example
version: '3.8'
services:
  discord-bot:
    image: your-bot-image
    ports:
      - "8080:8080"  # Members API
    environment:
      - BOT_TOKEN=your-bot-token
      - API_PORT=8080
    restart: unless-stopped
    
  frontend:
    image: your-frontend-image  
    ports:
      - "80:80"
    environment:
      - DISCORD_API_URL=http://discord-bot:8080
      - DISCORD_API_TOKEN=your-secret-token
    restart: unless-stopped
```

#### 3. Security Checklist
- ✅ **Secure tokens**: Use cryptographically random API keys
- ✅ **CORS protection**: Limit to your domain only  
- ✅ **HTTPS**: Use SSL certificates in production
- ✅ **Rate limiting**: Implement on your voting endpoints
- ✅ **Input validation**: Sanitize all user inputs
- ✅ **Error handling**: Don't expose internal details

---

## Troubleshooting

### Common Issues

#### "No automatic announcements"
```bash
[p]cw status                    # Check config
[p]cw toggle                    # Re-enable if disabled
```

**Possible causes**:
- Automation disabled
- Channel not configured
- Incorrect phase

#### "Admin not receiving DMs"  
```bash
[p]cw setadmin @admin           # Re-verify admin
[p]cw confirmation              # Temporarily disable
```

**Possible causes**:
- DMs blocked by admin
- Admin misconfigured
- Bot lacks DM permissions

#### "AI theme not generating"
```bash
[p]cw status                    # Check AI config
[p]cw generatetheme             # Test manually
[p]cw aimodel gpt-3.5-turbo     # Try different model
[p]cw aitemp 0.8                # Adjust creativity
```

**Possible causes**:
- Invalid API key/endpoint
- Unsupported model name
- Theme already exists for next week
- API error (quota, network, timeout)
- Model-specific parameter issues

#### "Late/duplicate announcements"
```bash
[p]cw schedule                  # Check schedule status
[p]cw reset                     # Reset flags if necessary
```

**Possible causes**:
- Bot restarted during cycle
- Manual phase change
- Timezone/system clock issues

#### "@everyone ping not working"
```bash
[p]cw status                    # Check ping setting
[p]cw everyone                  # Toggle if needed
```

**Possible causes**:
- @everyone ping disabled
- Bot lacks mention everyone permission
- Channel permissions restrict pings

### Working Minimal Configuration
```bash
[p]load collabwarz
[p]cw setchannel #your-channel
[p]cw settheme "First Theme"  
[p]cw toggle
# → Bot works in basic automatic mode
```

### Step-by-Step Debug
1. **Check**: `[p]cw status` - everything green?
2. **Test**: `[p]cw test` - announcements working?
3. **Manual**: `[p]cw announce submission_start` - direct post?
4. **AI Test**: `[p]cw generatetheme` - AI responding?
5. **Logs**: Check bot console for errors

### AI-Specific Troubleshooting

#### Model Not Found Error
```bash
[p]cw aimodel gpt-3.5-turbo     # Use known working model
# Check your provider's model list
```

#### Timeout Issues
- **Local models**: May be slower, increase timeout expectations
- **Remote APIs**: Check network connection and API status
- **High load**: Try lower temperature or fewer tokens

#### Authentication Errors
```bash
[p]cw setai your_endpoint new_api_key  # Refresh credentials
# Verify API key has correct permissions
```

#### Response Format Issues
- Bot expects OpenAI-compatible JSON format
- If using proxy, ensure it converts properly
- Check proxy documentation for compatibility

### Complete Reset
```bash
[p]unload collabwarz           # Unload
[p]load collabwarz             # Reload  
# Then reconfigure from scratch
```

---

## Support & Maintenance

### Help Commands
```bash
[p]cw help                      # Complete integrated help
[p]cw status                    # Detailed system status
[p]cw schedule                  # Weekly schedule
```

### Important Files
- `collabwarz.py`: Main cog code
- `info.json`: Cog metadata
- `requirements.txt`: Python dependencies

### Required Discord Permissions
- **Read Messages** in configured channel
- **Send Messages** in configured channel  
- **Manage Messages** (for editing/deletion)
- **Use External Emojis** (optional)
- **Send DMs** to admins (for confirmations)
- **Mention Everyone** (for @everyone pings, if enabled)

---

*This documentation covers all current bot features including JWT security, public commands (!info and !status), Suno-only policy, admin moderation endpoints, and enhanced user messaging - updated November 2, 2025.*