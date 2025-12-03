"""
Config Manager for CollabWarz Discord Bot

Handles configuration registration, defaults, and helper methods for accessing
complex configuration values.
"""

import os
from datetime import datetime
from redbot.core import Config

class ConfigManager:
    def __init__(self, cog):
        """Initialize ConfigManager with reference to parent cog"""
        self.cog = cog
        self.bot = cog.bot
        # We access config via the cog to ensure we use the same Config object
        # self.config = cog.config 
        
    def register_config(self):
        """Register default configuration values"""
        default_guild = {
            "announcement_channel": None,
            "current_theme": "Cosmic Dreams",
            "current_phase": "voting",  # "submission" or "voting"
            "submission_deadline": None,
            "voting_deadline": None,
            "auto_announce": True,
            "ai_api_url": "",
            "ai_api_key": "",
            "ai_model": "gpt-3.5-turbo",  # Configurable AI model
            "ai_temperature": 0.8,        # AI creativity setting
            "ai_max_tokens": 150,         # Maximum response length
            "last_announcement": None,  # Track last announcement to avoid duplicates
            "last_phase_check": None,   # Track when we last checked for phase changes
            "winner_announced": False,  # Track if winner has been announced for current week
            "require_confirmation": True,  # Require admin confirmation before posting
            "admin_user_id": None,      # Admin to contact for confirmation
            "pending_announcement": None, # Store pending announcement data
            "test_channel": None,       # Channel for test announcements
            "confirmation_timeout": 1800, # 30 minutes timeout for confirmations (non-submission)
            "next_week_theme": None,    # AI-generated theme for next week
            "theme_generation_done": False, # Track if theme was generated this week
            "pending_theme_confirmation": None, # Store pending theme confirmation
            "use_everyone_ping": False, # Whether to include @everyone in announcements
            "min_teams_required": 2,    # Minimum teams required to start voting
            "submission_channel": None, # Channel where submissions are posted
            "week_cancelled": False,    # Track if current week was cancelled
            "validate_discord_submissions": True, # Validate Discord submissions format
            "submitted_teams": {},      # Track teams that have submitted this week {week: [teams]}
            # Legacy / older installations used a `submissions` map. Register it by default
            # to avoid runtime attribute errors when other code expects `submissions`.
            "submissions": {},          # Legacy mapping for admin-submitted web entries {team: {song, url, ...}}
            "team_members": {},         # Track team compositions {week: {team_name: [user_ids]}}
            "admin_channel": None,      # DEPRECATED: No longer used with AutoReputation API
            "rep_reward_amount": 2,     # Amount of rep points to give winners
            "weekly_winners": {},       # Track winners by week {week: {team_name, members, rep_given}}
            "voting_results": {},       # Track voting results {week: {team_name: vote_count}}
            "face_off_active": False,   # Track if a face-off is currently active
            "face_off_teams": [],       # Teams in current face-off
            "face_off_deadline": None,  # When face-off voting ends
            "face_off_results": {},     # Face-off voting results {team_name: vote_count}
            "api_server_enabled": False, # Enable built-in API server for member list
            "api_server_port": 8080,    # Port for the API server
            "api_server_host": "0.0.0.0", # Host for the API server
            "api_access_token": None,   # Token for API authentication (deprecated)
            "api_access_token_data": None,  # Enhanced token data: {token: str, user_id: int, generated_at: str}
            "jwt_signing_key": None,    # JWT signing key for secure token generation
            "cors_origins": ["*"],      # CORS allowed origins
            "auto_delete_messages": True, # Automatically delete invalid messages
            "admin_user_ids": [],       # List of additional admin user IDs
            "suno_api_enabled": True,   # Enable Suno API integration for song metadata
            "suno_api_base_url": "https://api.suno-proxy.click", # Suno API base URL
            "individual_votes": {},     # Track individual votes {week: {user_id: team_name}}
            "session_token_required": True,   # Require Discord session tokens for voting
            "biweekly_mode": False,     # Enable bi-weekly competitions (every 2 weeks)
            
            # Comprehensive normalized data structures
            "artists_db": {},           # {user_id: {name, suno_profile, discord_rank, stats, teams, songs}}
            "teams_db": {},             # {team_id: {name, members, stats, songs_by_week}}
            "songs_db": {},             # {song_id: {title, artists, team_id, week, suno_data, vote_stats}}
            "weeks_db": {},             # {week_key: {theme, date, status, teams, songs, winner, vote_totals}}
            "next_unique_ids": {        # Track next available IDs for normalization
                "team_id": 1,
                "song_id": 1
            },
            "unmatched_suno_authors": {},  # Track Suno authors that couldn't be matched to Discord members
            
            # Redis Communication Configuration (for admin panel)
            "redis_enabled": False,     # Enable Redis communication with admin panel
            "redis_url": None,          # Redis connection URL (auto-detected from environment)
            "redis_poll_interval": 5,   # How often to check for queued actions (seconds)
            "redis_status_update_interval": 30  # How often to update status in Redis (seconds)
            ,
            # Backend polling configuration (use backend API instead of direct Redis)
            "backend_url": None,        # Backend base URL for collabwarz API
            "backend_token": None,      # Shared secret token for cog<->backend auth
            "backend_poll_interval": 10 # Poll interval in seconds when using backend
        }
        # Per-guild toggle to stop potentially destructive operations via admin panel
        default_guild["safe_mode_enabled"] = True
        # Persistent per-guild toggle to suppress noisy logs (defaults True - logs suppressed)
        default_guild["suppress_noisy_logs"] = True
        
        self.cog.config.register_guild(**default_guild)

    async def is_noisy_logs_suppressed(self, guild=None) -> bool:
        """Return True when noisy logs are suppressed for a given guild, otherwise False.

        If guild is provided, read persistent guild configuration. Fallback to in-memory attribute.
        """
        # If a guild is provided, prefer persisted config
        try:
            if guild:
                cfg_val = await self.cog.config.guild(guild).suppress_noisy_logs()
                if isinstance(cfg_val, bool):
                    return cfg_val
        except Exception:
            # Fall back to attribute
            pass
        return getattr(self.cog, 'suppress_noisy_logs', True)

    def get_current_week_key(self) -> str:
        """Get current week identifier for tracking submissions (backwards compatibility)"""
        now = datetime.now()
        iso_year, iso_week, _ = now.isocalendar()
        return f"{iso_year}-W{iso_week}"
    
    async def get_competition_week_key(self, guild) -> str:
        """Get current competition week identifier, handling bi-weekly mode"""
        now = datetime.now()
        iso_year, iso_week, _ = now.isocalendar()
        
        biweekly_mode = await self.cog.config.guild(guild).biweekly_mode()
        
        if biweekly_mode:
            # In bi-weekly mode, only odd weeks have competitions
            # Week 1, 3, 5, etc. = active weeks
            # Week 2, 4, 6, etc. = off weeks
            return f"{iso_year}-W{iso_week}"
        else:
            # Regular weekly mode
            return f"{iso_year}-W{iso_week}"
    
    async def is_competition_week(self, guild) -> bool:
        """Check if current week should have a competition (for bi-weekly mode)"""
        biweekly_mode = await self.cog.config.guild(guild).biweekly_mode()
        
        if not biweekly_mode:
            return True  # Weekly mode - always active
        
        # Bi-weekly mode: only odd weeks are active
        now = datetime.now()
        iso_year, iso_week, _ = now.isocalendar()
        
        # Check if week number is odd
        return (iso_week % 2) != 0

    async def get_submissions_safe(self, guild) -> dict:
        """Return submissions mapping safely, even if 'submissions' is not a registered config key."""
        try:
            cfg_all = await self.cog.config.guild(guild).all()
        except Exception:
            cfg_all = {}
        subs = cfg_all.get('submissions') or {}
        # If the cog tracks submissions in weeks_db structure, try to flatten
        if not subs:
            weeks_db = cfg_all.get('weeks_db') or {}
            # Fallback: no `submissions` mapping present, try the weeks_db/songs_db mappings
            # print(f"⚠️ CollabWarz: No 'submissions' mapping present for guild {guild.name} - falling back to other stores")
            # try to find current week
            try:
                week_key = await self.get_competition_week_key(guild)
                wk = weeks_db.get(week_key, {})
                if isinstance(wk, dict) and wk.get('teams'):
                    # build a dict from list of team names
                    subs = { t: {} for t in wk.get('teams', []) }
                elif isinstance(wk, dict) and wk.get('songs'):
                    subs = {}
                    for s in wk.get('songs', []):
                        if isinstance(s, dict) and s.get('team'):
                            subs.setdefault(s.get('team'), {})
            except Exception:
                pass
        return subs

    async def clear_submissions_safe(self, guild):
        try:
            cfg_all = await self.cog.config.guild(guild).all()
        except Exception:
            cfg_all = {}
        # Clear primary submissions mapping if present
        if 'submissions' in cfg_all:
            try:
                subs_group = getattr(self.cog.config.guild(guild), 'submissions', None)
                if subs_group:
                    await subs_group.clear()
            except Exception:
                pass
        # Also clear submitted_teams entries for the current week
        try:
            week_key = await self.get_competition_week_key(guild)
            submitted_teams = cfg_all.get('submitted_teams') or {}
            if week_key in submitted_teams:
                submitted_teams[week_key] = []
                await self.cog.config.guild(guild).submitted_teams.set(submitted_teams)
        except Exception:
            pass

    async def remove_submission_safe(self, guild, team_name):
        try:
            cfg_all = await self.cog.config.guild(guild).all()
        except Exception:
            cfg_all = {}
        # Remove from submissions mapping if present
        if 'submissions' in cfg_all:
            try:
                subs = cfg_all.get('submissions') or {}
                if team_name in subs:
                    del subs[team_name]
                    await self.set_submissions_safe(guild, subs)
                    return True
            except Exception:
                pass
        # Remove from submitted_teams list for current week
        try:
            week_key = await self.get_competition_week_key(guild)
            submitted_teams = cfg_all.get('submitted_teams') or {}
            wk = submitted_teams.get(week_key, [])
            if team_name in wk:
                wk.remove(team_name)
                submitted_teams[week_key] = wk
                await self.cog.config.guild(guild).submitted_teams.set(submitted_teams)
                return True
        except Exception:
            pass
        return False

    async def set_submissions_safe(self, guild, subs: dict) -> bool:
        """Set submissions if 'submissions' is registered, otherwise populate submitted_teams for the current week."""
        try:
            cfg_all = await self.cog.config.guild(guild).all()
        except Exception:
            cfg_all = {}

        if 'submissions' in cfg_all:
            try:
                subs_group = getattr(self.cog.config.guild(guild), 'submissions', None)
                if subs_group:
                    await subs_group.set(subs)
                    return True
            except Exception:
                pass

        # Fallback to populate submitted_teams
        try:
            week_key = await self.get_competition_week_key(guild)
            submitted_teams = cfg_all.get('submitted_teams') or {}
            submitted_teams[week_key] = list(subs.keys())
            await self.cog.config.guild(guild).submitted_teams.set(submitted_teams)
        except Exception:
            pass
