"""
Collab Warz Discord Bot Cog for Red-DiscordBot

This cog automates announcements for SoundGarden's Collab Warz competition.
It posts announcements about voting phases, submission phases, themes, and reminders.
Announcements are generated using a free AI API for engaging content.
"""

import discord
from redbot.core import commands, Config, checks
from redbot.core.bot import Red
from datetime import datetime, timedelta
import aiohttp
import asyncio
import json
from typing import Optional
from aiohttp import web
import re
import traceback
import os
try:
    import redis.asyncio as redis
    REDIS_AVAILABLE = True
except ImportError:
    REDIS_AVAILABLE = False
    redis = None

class CollabWarz(commands.Cog):
    """
    Automated announcements for SoundGarden's Collab Warz music competition.
    Manages voting and submission phases with AI-generated announcements.
    """
    
    def __init__(self, bot: Red):
        self.bot = bot
        self.config = Config.get_conf(self, identifier=1234567890, force_registration=True)
        
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
        
        self.config.register_guild(**default_guild)
        self.announcement_task = None
        self.redis_task = None
        self.backend_task = None
        self.redis_client = None
        self.backend_session = None
        self.backend_session_loop = None
        # Switch to short-lived per-request aiohttp.ClientSession for safety by default
        self.backend_use_short_lived_sessions = True
        # Per-guild map to throttle repeated backend export errors (timestamp)
        self.backend_error_throttle = {}
        self.confirmation_messages = {}  # Track confirmation messages for reaction handling
        
    def cog_load(self):
        """Start the announcement task and Redis communication when cog loads"""
        self.announcement_task = self.bot.loop.create_task(self.announcement_loop())
        if REDIS_AVAILABLE:
            self.redis_task = self.bot.loop.create_task(self.redis_communication_loop())
        # Start backend polling loop (it will early-return if not configured)
        self.backend_task = self.bot.loop.create_task(self.backend_communication_loop())
        # Run a migration check to ensure older guild configs have `submissions` registered
        self.bot.loop.create_task(self._ensure_config_defaults())
        # Don't create backend session here — create it in the backend loop
        print("🔁 CollabWarz: Backend session will be created lazily in backend_communication_loop (cog_load)")
        
    def cog_unload(self):
        """Stop the announcement task and Redis communication when cog unloads"""
        if self.announcement_task:
            self.announcement_task.cancel()
        if self.redis_task:
            self.redis_task.cancel()
        if self.redis_client:
            asyncio.create_task(self.redis_client.close())
        # Also ensure backend task is cancelled and session cleaned up
        if self.backend_task:
            try:
                self.backend_task.cancel()
            except Exception:
                pass
            self.backend_task = None
        if hasattr(self, 'backend_session') and self.backend_session:
            try:
                print(f"🛑 CollabWarz: Closing backend session (cog_unload). closed={getattr(self.backend_session, 'closed', 'n/a')}")
                asyncio.create_task(self.backend_session.close())
            except Exception:
                print("🛑 CollabWarz: Exception during backend session close in cog_unload")

    def _log_backend_error(self, guild, message, interval=120):
        """Throttle backend error messages per guild for a given interval (seconds)."""
        gid = getattr(guild, 'id', None)
        if gid is None:
            print(message)
            return
        last = self.backend_error_throttle.get(gid, 0)
        now = asyncio.get_running_loop().time()
        if now - last > interval:
            print(message)
            self.backend_error_throttle[gid] = now
    
    def _create_discord_timestamp(self, dt: datetime, style: str = "R") -> str:
        """Create a Discord timestamp from datetime object
        
        Args:
            dt: datetime object
            style: Discord timestamp style
                - "t": Short time (16:20)
                - "T": Long time (16:20:30)
                - "d": Short date (20/04/2021)
                - "D": Long date (20 April 2021)
                - "f": Short date/time (20 April 2021 16:20)
                - "F": Long date/time (Tuesday, 20 April 2021 16:20)
                - "R": Relative time (2 months ago)
        """
        timestamp = int(dt.timestamp())
        return f"<t:{timestamp}:{style}>"
    
    # ========== REDIS COMMUNICATION METHODS ==========
    
    async def _init_redis_connection(self, guild_for_config=None) -> bool:
        """Initialize Redis connection for admin panel communication.

        Tries in this order:
        1. Explicit `redis_url` passed in `guild_for_config` (if provided)
        2. Environment variables `REDIS_URL` or `REDIS_PRIVATE_URL`
        3. Any guild config that has `redis_enabled` True and a `redis_url` value

        This allows setting the Redis URL at runtime via the cog config (no restart required).
        """
        if not REDIS_AVAILABLE:
            print("⚠️ CollabWarz: redis.asyncio package not installed; install 'redis' package to enable Redis support")
            return False

        try:
            # 1) If a specific guild requested a URL, try it first
            redis_url = None
            if guild_for_config:
                try:
                    redis_url = await self.config.guild(guild_for_config).redis_url()
                except Exception:
                    redis_url = None

            # 2) Environment variables (global, highest priority if present)
            if not redis_url:
                redis_url = os.environ.get('REDIS_URL') or os.environ.get('REDIS_PRIVATE_URL')

            # 3) Fallback: look for any guild config that enabled redis and supplied a URL
            if not redis_url:
                for g in self.bot.guilds:
                    try:
                        enabled = await self.config.guild(g).redis_enabled()
                        url = await self.config.guild(g).redis_url()
                        if enabled and url:
                            redis_url = url
                            break
                    except Exception:
                        continue

            if not redis_url:
                print("🔍 CollabWarz: No Redis URL detected (config or REDIS_URL/REDIS_PRIVATE_URL). To enable Redis, set `REDIS_URL` env var or guild config redis_enabled + redis_url.")
                return False

            # Create Redis client
            self.redis_client = redis.from_url(redis_url, decode_responses=True)

            # Test connection
            await self.redis_client.ping()
            print(f"✅ CollabWarz: Redis connected for admin panel communication ({redis_url})")
            return True

        except Exception as e:
            print(f"❌ CollabWarz: Failed to connect to Redis: {e}")
            self.redis_client = None
            return False

    async def _safe_redis_setex(self, key, ttl, value, guild=None):
        """Safely set a key in Redis, with minor retries and reconnection attempts.

        Returns True on success, False otherwise.
        """
        # Take local reference to avoid race-the-client-set-to-None between check and call
        rc = self.redis_client
        if rc is None:
            # Try re-initializing connection using provided guild or fallback detection
            try:
                if guild:
                    await self._init_redis_connection(guild_for_config=guild)
                else:
                    await self._init_redis_connection()
                rc = self.redis_client
            except Exception as e:
                print(f"⚠️ CollabWarz: Unable to (re)initialize Redis: {e}")
                rc = None

        if rc is None:
            print(f"⚠️ CollabWarz: Redis client not available; not saving key {key}")
            return False

        try:
            await rc.setex(key, ttl, value)
            return True
        except Exception as e:
            print(f"⚠️ CollabWarz: Unable to save key {key} with TTL {ttl} in Redis: {e}")
            return False

    async def _post_with_temp_session(self, url, json_payload=None, headers=None, timeout=10):
        """Post to backend URL using a short-lived session and return (status, text)."""
        try:
            async with aiohttp.ClientSession() as tmp_session:
                async with tmp_session.post(url, json=json_payload, headers=headers, timeout=timeout) as resp:
                    try:
                        text = await resp.text()
                    except Exception:
                        text = None
                    return resp.status, text
        except Exception as e:
            print(f"❌ CollabWarz: _post_with_temp_session error for {url}: {e} (type={type(e)})")
            traceback.print_exc()
            return None, None

    async def _get_with_temp_session(self, url, headers=None, timeout=10):
        """GET to backend URL using a short-lived session and return (status, body/json)."""
        try:
            async with aiohttp.ClientSession() as tmp_session:
                async with tmp_session.get(url, headers=headers, timeout=timeout) as resp:
                    body = None
                    if resp.status == 200:
                        try:
                            body = await resp.json()
                        except Exception:
                            try:
                                body = await resp.text()
                            except Exception:
                                body = None
                    return resp.status, body
        except Exception as e:
            print(f"❌ CollabWarz: _get_with_temp_session error for {url}: {e} (type={type(e)})")
            traceback.print_exc()
            return None, None

    async def _safe_redis_set(self, key, value, guild=None):
        """Safely set a value in Redis, with basic reconnect/attempts.

        Returns True on success, False otherwise.
        """
        rc = self.redis_client
        if rc is None:
            try:
                if guild:
                    await self._init_redis_connection(guild_for_config=guild)
                else:
                    await self._init_redis_connection()
                rc = self.redis_client
            except Exception as e:
                print(f"⚠️ CollabWarz: Unable to (re)initialize Redis: {e}")
                rc = None

        if rc is None:
            print(f"⚠️ CollabWarz: Redis client not available; not setting key {key}")
            return False

        try:
            await rc.set(key, value)
            return True
        except Exception as e:
            print(f"⚠️ CollabWarz: Unable to set key {key} in Redis: {e}")
            return False
    
    async def _update_redis_status(self, guild):
        """Update competition status in Redis for admin panel and return the status dictionary.
        If Redis isn't configured, return the status dict so it can be exported via backend polling.
        """
            
        try:
            # Get current status
            current_phase = await self.config.guild(guild).current_phase()
            current_theme = await self.config.guild(guild).current_theme()
            auto_announce = await self.config.guild(guild).auto_announce()
            week_cancelled = await self.config.guild(guild).week_cancelled()
            
            # Count teams (use robust counting logic)
            team_count = await self._count_participating_teams(guild)
            
            # Prepare detailed status including submissions & voting results for admin panel
            # Use a safe fetch of all guild config keys and guard against unregistered values
            try:
                cfg_all = await self.config.guild(guild).all()
            except Exception:
                cfg_all = {}

            submissions = cfg_all.get('submissions') or {}
            voting_results = cfg_all.get('voting_results') or {}
            team_members = cfg_all.get('team_members') or {}
            weeks_db = cfg_all.get('weeks_db') or {}

            status_data = {
                "phase": current_phase,
                "theme": current_theme,
                "automation_enabled": auto_announce,
                "week_cancelled": week_cancelled,
                "team_count": team_count,
                "guild_id": guild.id,
                "guild_name": guild.name,
                "last_updated": datetime.utcnow().isoformat(),
                "cog_version": "redis-integration-1.0.0"
            }
            # Attach detailed snapshots
            try:
                status_data['submissions'] = submissions or {}
                # Also include the submitted_teams mapping (week -> [teams]) when configured
                try:
                    submitted_teams = cfg_all.get('submitted_teams') or {}
                    status_data['submitted_teams'] = submitted_teams or {}
                except Exception:
                    status_data['submitted_teams'] = {}
                status_data['voting_results'] = voting_results or {}
                status_data['team_members'] = team_members or {}
                # Add a small summary of recent weeks for history UI
                try:
                    # Convert weeks_db into a small array of {week, theme, winner}
                    recent = []
                    for wk, data in (weeks_db or {}).items():
                        recent.append({
                            'week': wk,
                            'theme': data.get('theme'),
                            'winner': data.get('winner'),
                            'date': data.get('date')
                        })
                    # Keep last 10 weeks
                    recent.sort(key=lambda x: x.get('date') or '')
                    status_data['weeks'] = recent[-10:]
                except Exception:
                    status_data['weeks'] = []
            except Exception:
                # Avoid failure for large objects
                pass
            
            # Store in Redis if available and feature enabled (use safe helper to avoid race with None client)
            try:
                redis_enabled = await self.config.guild(guild).redis_enabled()
            except Exception:
                redis_enabled = False
            if redis_enabled:
                await self._safe_redis_set('collabwarz:status', json.dumps(status_data), guild=guild)

            # Return the status data for potential backend export or other handling
            return status_data
            
        except Exception as e:
            print(f"❌ CollabWarz: Failed to update Redis status: {e}")
            return None
    
    async def _process_redis_action(self, guild, action_data: dict):
        """Process an action received from Redis queue"""
        action = None
        params = {}
        action_id = None
        try:
            action = action_data.get('action')
            params = action_data.get('params', {})
            action_id = action_data.get('id')
        except Exception:
            action = None
            params = {}
            action_id = None
        
        print(f"🎯 CollabWarz: Processing Redis action '{action}' (ID: {action_id})")
        
        try:
            if action == 'start_phase':
                phase = params.get('phase', 'submission')
                theme = params.get('theme')
                
                if theme:
                    await self.config.guild(guild).current_theme.set(theme)
                await self.config.guild(guild).current_phase.set(phase)
                await self.config.guild(guild).week_cancelled.set(False)
                
                print(f"✅ Phase started: {phase} with theme: {theme}")
                
            elif action == 'end_phase':
                current_phase = await self.config.guild(guild).current_phase()
                if current_phase == 'submission':
                    await self.config.guild(guild).current_phase.set('voting')
                elif current_phase == 'voting':
                    await self.config.guild(guild).current_phase.set('ended')
                
                print(f"✅ Phase ended, new phase: {await self.config.guild(guild).current_phase()}")
                
            elif action == 'cancel_week':
                await self.config.guild(guild).week_cancelled.set(True)
                await self.config.guild(guild).current_phase.set('cancelled')
                
                print("✅ Week cancelled")
                
            elif action == 'enable_automation':
                await self.config.guild(guild).auto_announce.set(True)
                print("✅ Automation enabled")
                
            elif action == 'disable_automation':
                await self.config.guild(guild).auto_announce.set(False)
                print("✅ Automation disabled")
                
            elif action == 'toggle_automation':
                current = await self.config.guild(guild).auto_announce()
                await self.config.guild(guild).auto_announce.set(not current)
                print(f"✅ Automation toggled: {not current}")
                
            elif action == 'set_theme' or action == 'update_theme':
                theme = params.get('theme')
                if theme:
                    await self.config.guild(guild).current_theme.set(theme)
                    print(f"✅ Theme updated: {theme}")

            elif action == 'set_phase':
                phase = params.get('phase')
                if phase in ['submission', 'voting', 'paused', 'cancelled', 'ended', 'inactive']:
                    await self.config.guild(guild).current_phase.set(phase)
                    print(f"✅ Phase set to: {phase}")
                else:
                    print(f"❌ Invalid phase: {phase}")

            elif action == 'next_phase':
                current_phase = await self.config.guild(guild).current_phase()
                if current_phase == 'submission':
                    await self.config.guild(guild).current_phase.set('voting')
                    print("✅ Advanced to voting")
                elif current_phase == 'voting':
                    await self.config.guild(guild).current_phase.set('ended')
                    print("✅ Advanced to ended")
                else:
                    await self.config.guild(guild).current_phase.set('submission')
                    print("✅ Reset to submission")

            elif action == 'start_new_week':
                theme = params.get('theme')
                if theme:
                    await self.config.guild(guild).current_theme.set(theme)
                    await self.config.guild(guild).current_phase.set('submission')
                    await self.config.guild(guild).week_cancelled.set(False)
                    await self._clear_submissions_safe(guild)
                    print(f"✅ New week started with theme: {theme}")
                else:
                    print("❌ start_new_week requires a theme")

            elif action == 'clear_submissions':
                await self._clear_submissions_safe(guild)
                print("✅ Submissions cleared")

            elif action == 'remove_submission':
                team_name = params.get('team_name')
                if team_name:
                    submissions = await self._get_submissions_safe(guild)
                    if team_name in submissions:
                        del submissions[team_name]
                        await self._set_submissions_safe(guild, submissions)
                        print(f"✅ Removed submission for team {team_name}")
                    else:
                        print(f"⚠️ No submission found for team {team_name}")
                else:
                    print("❌ remove_submission requires team_name")

            elif action == 'remove_vote':
                week = params.get('week')
                user_id = params.get('user_id')
                if week and user_id:
                    votes = await self.config.guild(guild).individual_votes()
                    week_votes = votes.get(week, {})
                    if str(user_id) in week_votes:
                        del week_votes[str(user_id)]
                        votes[week] = week_votes
                        await self.config.guild(guild).individual_votes.set(votes)
                        # Also adjust aggregated voting_results
                        voting_results = await self.config.guild(guild).voting_results()
                        week_results = voting_results.get(week, {})
                        # Find which team this user voted for (we cannot always find team without logs)
                        # As a simplification, we will refresh voting_results from raw votes when needed
                        print(f"✅ Removed vote from user {user_id} for week {week}")
                    else:
                        print(f"⚠️ No vote from user {user_id} found for week {week}")
                else:
                    print("❌ remove_vote requires week and user_id")

            elif action == 'reset_week':
                await self.config.guild(guild).current_phase.set('submission')
                await self.config.guild(guild).week_cancelled.set(False)
                await self._clear_submissions_safe(guild)
                await self.config.guild(guild).voting_results.clear()
                await self.config.guild(guild).weekly_winners.clear()
                print("✅ Week reset")

            elif action == 'force_voting':
                await self.config.guild(guild).current_phase.set('voting')
                await self.config.guild(guild).week_cancelled.set(False)
                print("✅ Force set to voting phase")

            elif action == 'announce_winners':
                try:
                    # Trigger the process that finalizes the vote and announces winners
                    await self._process_voting_end(guild)
                    print("✅ Announce winners triggered")
                except Exception as e:
                    print(f"❌ Failed to announce winners: {e}")
                    
            else:
                print(f"❓ Unknown action: {action}")
                action_data['status'] = 'failed'
                action_data['error'] = f'unknown action: {action}'
            
            # Mark action as completed
            action_data['status'] = 'completed'
            action_data['processed_at'] = datetime.utcnow().isoformat()
            
            # Use safe redis helper to store action result
            try:
                redis_enabled = await self.config.guild(guild).redis_enabled()
            except Exception:
                redis_enabled = False
            saved_to_redis = False
            if redis_enabled:
                saved_to_redis = await self._safe_redis_setex(
                    f'collabwarz:action:{action_id}',
                    86400,
                    json.dumps(action_data),
                    guild=guild,
                )
            if not saved_to_redis:
                try:
                    backend_url = await self.config.guild(guild).backend_url()
                    backend_token = await self.config.guild(guild).backend_token()
                    if backend_url and backend_token:
                        result_url = backend_url.rstrip('/') + '/api/collabwarz/action-result'
                        headers = {"X-CW-Token": backend_token}
                        await self._post_with_temp_session(result_url, json_payload=action_data, headers=headers, timeout=10)
                except Exception as e:
                    print(f"⚠️ CollabWarz: Failed to post action result to backend fallback: {e}")
            
            # Update status after processing action
            await self._update_redis_status(guild)

            # If Redis isn't available, optionally inform backend of action result (fallback)
            if not self.redis_client:
                try:
                    backend_url = await self.config.guild(guild).backend_url()
                    backend_token = await self.config.guild(guild).backend_token()
                    if backend_url and backend_token:
                        result_url = backend_url.rstrip('/') + '/api/collabwarz/action-result'
                        headers = {"X-CW-Token": backend_token}
                        async with aiohttp.ClientSession() as session:
                            async with session.post(result_url, json=action_data, headers=headers, timeout=10) as presp:
                                        if presp.status != 200:
                                            self._log_backend_error(guild, f"⚠️ CollabWarz: Backend result post (fallback) returned {presp.status}")
                except Exception as e:
                    print(f"⚠️ CollabWarz: Failed to post action result to backend fallback: {e}")
            
        except Exception as e:
            print(f"❌ CollabWarz: Failed to process action '{action}': {e}")
            
            # Mark action as failed
            action_data['status'] = 'failed'
            action_data['error'] = str(e)
            action_data['processed_at'] = datetime.utcnow().isoformat()
            
            # Save failed action status as well using safe helper
            try:
                redis_enabled = await self.config.guild(guild).redis_enabled()
            except Exception:
                redis_enabled = False
            saved_to_redis = False
            if redis_enabled:
                saved_to_redis = await self._safe_redis_setex(
                    f'collabwarz:action:{action_id}',
                    86400,
                    json.dumps(action_data),
                    guild=guild,
                )
            if not saved_to_redis:
                try:
                    backend_url = await self.config.guild(guild).backend_url()
                    backend_token = await self.config.guild(guild).backend_token()
                    if backend_url and backend_token:
                        result_url = backend_url.rstrip('/') + '/api/collabwarz/action-result'
                        headers = {"X-CW-Token": backend_token}
                        await self._post_with_temp_session(result_url, json_payload=action_data, headers=headers, timeout=10)
                except Exception as e:
                    print(f"⚠️ CollabWarz: Failed to post failed action result to backend fallback: {e}")
    
    async def redis_communication_loop(self):
        """Main Redis communication loop - polls for actions and updates status"""
        await self.bot.wait_until_ready()
        
        # Initialize Redis connection
        if not await self._init_redis_connection():
            print("⚠️ CollabWarz: Redis not available, admin panel communication disabled")
            return
        
        print("🔄 CollabWarz: Started Redis communication loop")
        
        last_status_update = 0
        
        while True:
            try:
                # Get all guilds where this cog is active
                for guild in self.bot.guilds:
                    try:
                        # Check for queued actions
                        rc = self.redis_client
                        action_string = None
                        if rc:
                            try:
                                action_string = await rc.rpop('collabwarz:actions')
                            except Exception as e:
                                print(f"⚠️ CollabWarz: Redis rpop error: {e}")
                        if action_string:
                            action_data = json.loads(action_string)
                            await self._process_redis_action(guild, action_data)
                        
                        # Update status periodically
                        now = asyncio.get_event_loop().time()
                        if now - last_status_update > 30:  # Every 30 seconds
                            await self._update_redis_status(guild)
                            last_status_update = now
                            
                    except Exception as e:
                        print(f"❌ CollabWarz: Error processing Redis for guild {guild.name}: {e}")
                
                # Sleep before next poll
                await asyncio.sleep(5)  # Poll every 5 seconds
                
            except asyncio.CancelledError:
                break
            except Exception as e:
                print(f"❌ CollabWarz: Redis communication error: {e}")
                await asyncio.sleep(30)  # Wait longer on error
        
        print("🛑 CollabWarz: Redis communication loop stopped")

    async def backend_communication_loop(self):
        """Poll the external backend for actions when configured.

        This allows the cog to operate without direct Redis access by polling
        the backend on Instance 2 for queued actions.
        """
        await self.bot.wait_until_ready()

        print("🔁 CollabWarz: Backend communication loop starting (polling backend API)")

        while True:
            try:
                for guild in self.bot.guilds:
                    try:
                        backend_url = await self.config.guild(guild).backend_url()
                        backend_token = await self.config.guild(guild).backend_token()
                        poll_interval = await self.config.guild(guild).backend_poll_interval()

                        if not backend_url or not backend_token:
                            # Not configured for this guild
                            continue

                        # Build request
                        next_url = backend_url.rstrip("/") + "/api/collabwarz/next-action"

                        # Diagnostics: what mode are we in and whether redis is available
                        print(f"🔁 CollabWarz: Handling guild {guild.name} (short_lived={getattr(self, 'backend_use_short_lived_sessions', False)}, redis={bool(self.redis_client)})")
                        headers = {"X-CW-Token": backend_token}
                        if getattr(self, 'backend_use_short_lived_sessions', False):
                            try:
                                status_code, body = await self._get_with_temp_session(next_url, headers=headers, timeout=10)
                                if status_code == 204:
                                    # No action available
                                    pass
                                elif status_code == 200:
                                    action = None
                                    if isinstance(body, dict):
                                        action = body.get("action")
                                    if action:
                                        await self._process_redis_action(guild, action)
                                        # Report result back to backend using short-lived session
                                        result_url = backend_url.rstrip("/") + "/api/collabwarz/action-result"
                                        result_payload = {
                                            "id": action.get("id"),
                                            "status": "completed",
                                            "details": {"processed_by": "collabwarz_cog"},
                                        }
                                        try:
                                            rstatus, rtext = await self._post_with_temp_session(result_url, json_payload=result_payload, headers=headers, timeout=10)
                                            if rstatus is not None and rstatus != 200:
                                                self._log_backend_error(guild, f"⚠️ CollabWarz: Backend result post (short-lived) returned {rstatus}")
                                        except Exception as e:
                                            self._log_backend_error(guild, f"❌ CollabWarz: Result post (short-lived) failed: {e}")
                                elif status_code is None:
                                    print("❌ CollabWarz: Failed to get a response from backend (short-lived session)")
                                else:
                                    print(f"❌ CollabWarz: Unexpected backend response: {status_code}")
                            except asyncio.TimeoutError:
                                print("⚠️ CollabWarz: Backend poll timed out")
                            except Exception as e:
                                print(f"❌ CollabWarz: Error polling backend (short-lived session): {e}")
                        else:
                            # Persistent session path (legacy), keep existing logic
                            await self._ensure_backend_session()
                            session = self.backend_session
                            print(f"🔁 CollabWarz: Using backend session for GET. closed={getattr(session, 'closed', 'n/a')}")
                            try:
                                headers = {"X-CW-Token": backend_token}
                                resp = await session.get(next_url, headers=headers, timeout=10)
                                try:
                                    if resp.status == 204:
                                        pass
                                    elif resp.status == 200:
                                        body = await resp.json()
                                        action = body.get("action")
                                        if action:
                                            await self._process_redis_action(guild, action)
                                            result_url = backend_url.rstrip("/") + "/api/collabwarz/action-result"
                                            result_payload = {
                                                "id": action.get("id"),
                                                "status": "completed",
                                                "details": {"processed_by": "collabwarz_cog"},
                                            }
                                            async with session.post(result_url, json=result_payload, headers=headers, timeout=10) as presp:
                                                    if presp.status != 200:
                                                        self._log_backend_error(guild, f"⚠️ CollabWarz: Backend result post returned {presp.status}")
                                    else:
                                        print(f"❌ CollabWarz: Unexpected backend response: {resp.status}")
                                finally:
                                    resp.close()
                            except asyncio.TimeoutError:
                                print("⚠️ CollabWarz: Backend poll timed out")
                            except Exception as e:
                                print(f"❌ CollabWarz: Error polling backend: {e} (session closed: {getattr(session, 'closed', 'n/a')})")

                        # After processing, update and export current status back to backend
                        try:
                            status_data = await self._update_redis_status(guild)
                            # If we have status data and backend configured, post it.
                            if status_data and backend_url and backend_token:
                                status_url = backend_url.rstrip('/') + '/api/collabwarz/status'
                                try:
                                    headers = { 'X-CW-Token': backend_token }
                                    if getattr(self, 'backend_use_short_lived_sessions', False):
                                        # Use short-lived session for status post
                                        rstatus, rtext = await self._post_with_temp_session(status_url, json_payload=status_data, headers=headers, timeout=10)
                                        if rstatus is not None and rstatus != 200:
                                            print(f"⚠️ CollabWarz: Failed to export status to backend (HTTP {rstatus})")
                                        elif rstatus is None:
                                            # Throttle repeated messages for the same guild to avoid log spam
                                            last = self.backend_error_throttle.get(guild.id, 0)
                                            now = asyncio.get_running_loop().time()
                                            if now - last > 120:
                                                print(f"❌ CollabWarz: Failed to export status to backend (no response) for guild {guild.name}")
                                                self.backend_error_throttle[guild.id] = now
                                    else:
                                        print(f"🔁 CollabWarz: Posting status to backend for {guild.name} (session.closed={getattr(session, 'closed', 'n/a')})")
                                        async with session.post(status_url, json=status_data, headers=headers, timeout=10) as sresp:
                                            if sresp.status != 200:
                                                print(f"⚠️ CollabWarz: Failed to export status to backend (HTTP {sresp.status})")
                                except Exception as ee:
                                    self._log_backend_error(guild, f"❌ CollabWarz: Error exporting status to backend: {ee}")
                                    self._log_backend_error(guild, traceback.format_exc())
                            else:
                                # No status to export
                                print(f"ℹ️ CollabWarz: No status available to export for guild {guild.name}")
                        except Exception as e:
                            print(f"❌ CollabWarz: Failed to update and export status for guild {guild.name}: {e}")

                        # Sleep according to guild poll interval
                        await asyncio.sleep(poll_interval or 10)

                    except Exception as e:
                        print(f"❌ CollabWarz: Error in backend loop for guild {guild.name}: {e}")
                        continue

                # Short sleep between full guild iterations
                await asyncio.sleep(1)

            except asyncio.CancelledError:
                break
            except Exception as e:
                print(f"❌ CollabWarz: Backend communication loop error: {e}")
                await asyncio.sleep(10)
        
        print("🛑 CollabWarz: Backend communication loop stopped")

    async def _ensure_config_defaults(self):
        """Ensure older guild configs include any newly added registration keys.

        This ensures older installations still have the `submissions` mapping
        available to minimize runtime attribute missing errors.
        """
        await self.bot.wait_until_ready()
        for g in self.bot.guilds:
            try:
                cfg_all = await self.config.guild(g).all()
            except Exception:
                cfg_all = {}
            if 'submissions' not in cfg_all:
                try:
                    subs_group = getattr(self.config.guild(g), 'submissions', None)
                    if subs_group:
                        await subs_group.set({})
                        print(f"ℹ️ CollabWarz: Added missing `submissions` mapping for guild {g.name}")
                except Exception:
                    # If we failed to add `submissions`, don't crash; fall back to submitted_teams
                    pass

    async def _ensure_backend_session(self):
        """Ensure the persistent backend session exists and is bound to the current loop.

        If it's missing or bound to a different event loop, recreate it on the current loop.
        """
        try:
            current_loop = asyncio.get_running_loop()
        except RuntimeError:
            # No running event loop
            current_loop = None
        session = self.backend_session
        if session is None or getattr(session, 'closed', True) or self.backend_session_loop != current_loop:
            # Close existing session if present
            if session and not getattr(session, 'closed', True):
                try:
                    await session.close()
                except Exception:
                    pass
            # Recreate session on the current loop
            try:
                self.backend_session = aiohttp.ClientSession(connector=aiohttp.TCPConnector(limit=10, keepalive_timeout=60))
                self.backend_session_loop = current_loop
                print(f"🔁 CollabWarz: Persistent backend session (re)created on loop {current_loop} (closed={getattr(self.backend_session, 'closed', 'n/a')})")
            except Exception as e:
                print(f"❌ CollabWarz: Failed to create persistent backend session: {e}")
                self.backend_session = None
                self.backend_session_loop = None

    # ========== RUNTIME REDIS MANAGEMENT COMMANDS ==========

    @commands.group()
    @checks.is_owner()
    async def redis(self, ctx: commands.Context):
        """Manage Redis configuration for the admin panel (owner-only)."""
        if not ctx.invoked_subcommand:
            await ctx.send("Available subcommands: `seturl <url>`, `enable`, `disable`, `status`")

    @redis.command(name="seturl")
    async def redis_seturl(self, ctx: commands.Context, url: str):
        """Set the Redis URL for this guild and start Redis communication immediately."""
        if not ctx.guild:
            await ctx.send("This command must be run in a guild.")
            return

        await self.config.guild(ctx.guild).redis_url.set(url)
        await self.config.guild(ctx.guild).redis_enabled.set(True)

        # Restart the redis task if running
        if self.redis_task:
            try:
                self.redis_task.cancel()
            except Exception:
                pass
            self.redis_task = None

        # Start a new loop that will pick up the guild-specific URL
        self.redis_task = self.bot.loop.create_task(self.redis_communication_loop())
        await ctx.send("✅ Redis URL saved and Redis communication started (guild-level).")

    @redis.command(name="enable")
    async def redis_enable(self, ctx: commands.Context):
        """Enable Redis communication for this guild."""
        if not ctx.guild:
            await ctx.send("This command must be run in a guild.")
            return

        await self.config.guild(ctx.guild).redis_enabled.set(True)
        if not self.redis_task:
            self.redis_task = self.bot.loop.create_task(self.redis_communication_loop())
        await ctx.send("✅ Redis communication enabled for this guild.")

    @redis.command(name="disable")
    async def redis_disable(self, ctx: commands.Context):
        """Disable Redis communication for this guild."""
        if not ctx.guild:
            await ctx.send("This command must be run in a guild.")
            return

        await self.config.guild(ctx.guild).redis_enabled.set(False)
        if self.redis_task:
            try:
                self.redis_task.cancel()
            except Exception:
                pass
            self.redis_task = None
        await ctx.send("✅ Redis communication disabled for this guild.")

    @redis.command(name="status")
    async def redis_status(self, ctx: commands.Context):
        """Show Redis configuration/status for this guild."""
        if not ctx.guild:
            await ctx.send("This command must be run in a guild.")
            return

        enabled = await self.config.guild(ctx.guild).redis_enabled()
        url = await self.config.guild(ctx.guild).redis_url()
        client_connected = bool(self.redis_client)

        msg = (
            f"Redis enabled (guild): {enabled}\n"
            f"Redis URL (guild): {url or '(not set)'}\n"
            f"Redis library available: {REDIS_AVAILABLE}\n"
            f"Redis client connected: {client_connected}"
        )
        await ctx.send(f"``\n{msg}\n``")

    @redis.command(name="ping")
    async def redis_ping(self, ctx: commands.Context):
        """Ping the Redis server to verify connectivity."""
        if not REDIS_AVAILABLE:
            await ctx.send("⚠️ Le paquet Python `redis` n'est pas installé sur cette instance.")
            return

        # Ensure we have a client (try to initialize using guild config)
        if not self.redis_client:
            ok = await self._init_redis_connection(ctx.guild)
            if not ok:
                await ctx.send("❌ Impossible de se connecter à Redis (pas d'URL trouvée ou échec de connexion).")
                return

        try:
            pong = await self.redis_client.ping()
            await ctx.send(f"✅ Redis ping réussi: {pong}")
        except Exception as e:
            await ctx.send(f"❌ Erreur lors du ping Redis: {e}")

    # ========== BACKEND (Instance 2) CONFIGURATION COMMANDS ==========

    @commands.group()
    @checks.is_owner()
    async def backend(self, ctx: commands.Context):
        """Manage backend API configuration for collabwarz (owner-only)."""
        if not ctx.invoked_subcommand:
            await ctx.send("Available subcommands: `set <url> <token>`, `status`, `disable`")

    @backend.command(name="set")
    async def backend_set(self, ctx: commands.Context, url: str, token: str):
        """Configure backend URL and shared token for cog polling."""
        if not ctx.guild:
            await ctx.send("This command must be run in a guild.")
            return

        await self.config.guild(ctx.guild).backend_url.set(url)
        await self.config.guild(ctx.guild).backend_token.set(token)
        await self.config.guild(ctx.guild).backend_poll_interval.set(10)

        # Restart backend task to pick up new config
        if self.backend_task:
            try:
                self.backend_task.cancel()
            except Exception:
                pass
            self.backend_task = None

        self.backend_task = self.bot.loop.create_task(self.backend_communication_loop())
        await ctx.send("✅ Backend configuration saved and polling started for this guild.")

    @backend.command(name="disable")
    async def backend_disable(self, ctx: commands.Context):
        """Disable backend polling for this guild."""
        if not ctx.guild:
            await ctx.send("This command must be run in a guild.")
            return

        await self.config.guild(ctx.guild).backend_url.set(None)
        await self.config.guild(ctx.guild).backend_token.set(None)

        # Cancel backend task if running
        if self.backend_task:
            try:
                self.backend_task.cancel()
            except Exception:
                pass
            self.backend_task = None

        await ctx.send("✅ Backend polling disabled for this guild.")

    @backend.command(name="status")
    async def backend_status(self, ctx: commands.Context):
        """Show backend configuration/status for this guild."""
        if not ctx.guild:
            await ctx.send("This command must be run in a guild.")
            return

        url = await self.config.guild(ctx.guild).backend_url()
        token = await self.config.guild(ctx.guild).backend_token()
        poll_interval = await self.config.guild(ctx.guild).backend_poll_interval()
        running = bool(self.backend_task)

        token_display = (token[:6] + "..." ) if token else "(not set)"

        msg = (
            f"Backend URL: {url or '(not set)'}\n"
            f"Backend token: {token_display}\n"
            f"Poll interval: {poll_interval}s\n"
            f"Backend task running: {running}"
        )

        await ctx.send(f"``\n{msg}\n``")
    
    def _get_next_deadline(self, announcement_type: str) -> datetime:
        """Get the next deadline based on announcement type"""
        now = datetime.utcnow()
        day = now.weekday()  # Monday is 0, Sunday is 6
        
        if announcement_type == "submission_start":
            # Submissions end Friday noon
            days_until_friday = (4 - day) % 7  # 4 = Friday
            if days_until_friday == 0 and now.hour >= 12:  # Friday afternoon
                days_until_friday = 7  # Next Friday
            elif days_until_friday == 0:  # Friday before noon
                pass  # Same day
            else:
                pass  # Days until Friday
                
            next_friday = now + timedelta(days=days_until_friday)
            return next_friday.replace(hour=12, minute=0, second=0, microsecond=0)
            
        elif announcement_type == "voting_start" or announcement_type == "reminder":
            # Voting ends Sunday night
            days_until_sunday = (6 - day) % 7  # 6 = Sunday
            if days_until_sunday == 0 and now.hour >= 23:  # Sunday late night
                days_until_sunday = 7  # Next Sunday
            elif days_until_sunday == 0:  # Sunday before 11 PM
                pass  # Same day
            else:
                pass  # Days until Sunday
                
            next_sunday = now + timedelta(days=days_until_sunday)
            return next_sunday.replace(hour=23, minute=59, second=59, microsecond=0)
        
        # Default fallback
        return now + timedelta(days=1)
    
    async def _count_participating_teams(self, guild) -> int:
        """Count the number of teams with submissions this competition cycle"""
        try:
            week_key = await self._get_competition_week_key(guild)
            
            # Count teams from different sources
            total_teams = set()  # Use set to avoid double-counting
            
            # 1. Count Discord registered teams for current week
            try:
                cfg_all = await self.config.guild(guild).all()
            except Exception:
                cfg_all = {}

            submitted_teams = cfg_all.get('submitted_teams', {})
            week_teams = submitted_teams.get(week_key, [])
            for team_name in week_teams:
                total_teams.add(team_name)
            
            # 2. Count web submissions (from submissions config)
            # Note: submissions config contains all current active submissions
            # 2. Count web submissions (from submissions config if present)
            submissions = cfg_all.get('submissions') or {}
            if isinstance(submissions, dict):
                for team_name in submissions.keys():
                    total_teams.add(team_name)
            else:
                # If submissions isn't a dict, look for weeks_db or songs_db
                weeks_db = cfg_all.get('weeks_db') or {}
                week_info = weeks_db.get(week_key) or {}
                # If weeks_db stores a teams list or songs list, attempt to extract
                if isinstance(week_info.get('teams'), list):
                    for t in week_info.get('teams', []):
                        total_teams.add(t)
                elif isinstance(week_info.get('songs'), list):
                    for s in week_info.get('songs', []):
                        if isinstance(s, dict) and s.get('team'):
                            total_teams.add(s.get('team'))
                else:
                    # Fallback: examine songs_db and collect teams registered for this week
                    songs_db = cfg_all.get('songs_db') or {}
                    for song in songs_db.values():
                        try:
                            if song and song.get('week') == week_key and song.get('team'):
                                total_teams.add(song.get('team'))
                        except Exception:
                            continue
            
            # 3. Also check for unregistered submissions (fallback for raw Discord messages)
            validate_enabled = await self.config.guild(guild).validate_discord_submissions()
            if not validate_enabled:
                # If validation is disabled, also count raw messages
                raw_count = await self._count_raw_submissions(guild)
                # For raw counting, we can't get team names, so just return the max
                return max(len(total_teams), raw_count)
            
            return len(total_teams)
            
        except Exception as e:
            print(f"Error counting teams in {guild.name}: {e}")
            return 0
    
    async def _count_raw_submissions(self, guild) -> int:
        """Count raw submissions by scanning messages (fallback method)"""
        try:
            submission_channel_id = await self.config.guild(guild).submission_channel()
            if not submission_channel_id:
                submission_channel_id = await self.config.guild(guild).announcement_channel()
            
            if not submission_channel_id:
                return 0
            
            channel = guild.get_channel(submission_channel_id)
            if not channel:
                return 0
            
            # Get current week identifier for filtering messages
            now = datetime.now()
            week_start = now - timedelta(days=now.weekday())
            
            team_count = 0
            async for message in channel.history(after=week_start, limit=None):
                if 'suno.com' in message.content.lower():
                    team_count += 1
            
            return team_count
            
        except Exception as e:
            print(f"Error counting raw submissions in {guild.name}: {e}")
            return 0
    
    async def _cancel_week_and_restart(self, guild, channel, theme: str):
        """Cancel current week due to insufficient teams and restart next Monday"""
        try:
            # Mark week as cancelled
            await self.config.guild(guild).week_cancelled.set(True)
            await self.config.guild(guild).current_phase.set("cancelled")
            
            # Calculate next Monday
            now = datetime.now()
            days_until_monday = (7 - now.weekday()) % 7
            if days_until_monday == 0:  # If today is Monday
                days_until_monday = 7
            
            next_monday = now + timedelta(days=days_until_monday)
            next_monday_ts = self._create_discord_timestamp(next_monday.replace(hour=9, minute=0, second=0), "F")
            
            # Create cancellation announcement
            cancellation_msg = f"""⚠️ **WEEK CANCELLED - INSUFFICIENT PARTICIPATION** ⚠️

🎵 **Theme:** **{theme}**

Unfortunately, we didn't receive enough submissions this week to proceed with voting.

📅 **Competition restarts:** {next_monday_ts}
🔄 **New theme will be announced** when we restart

Thank you for your understanding! Let's make next week amazing! 🎶"""

            # Check for @everyone ping setting
            use_everyone_ping = await self.config.guild(guild).use_everyone_ping()
            if use_everyone_ping:
                cancellation_msg = f"@everyone\n\n{cancellation_msg}"
            
            # Send cancellation message
            await channel.send(cancellation_msg)
            
            # Reset flags for next week
            current_week = now.strftime("%Y-W%U")
            await self.config.guild(guild).last_announcement.set(f"week_cancelled_{current_week}")
            await self.config.guild(guild).winner_announced.set(False)
            await self.config.guild(guild).theme_generation_done.set(False)
            
            print(f"Week cancelled in {guild.name} due to insufficient teams")
            
        except Exception as e:
            print(f"Error cancelling week in {guild.name}: {e}")
    
    def _extract_team_info_from_message(self, message_content: str, mentions: list, guild: discord.Guild, author_id: int) -> dict:
        """Extract team name and partner from Discord message"""
        result = {
            "team_name": None,
            "partner_id": None,
            "errors": []
        }
        
        # Look for "Team name:" pattern (case insensitive)
        team_match = re.search(r'team\s+name\s*:\s*(.+?)(?:\n|$)', message_content, re.IGNORECASE)
        if team_match:
            result["team_name"] = team_match.group(1).strip()
        else:
            result["errors"].append("❌ **Team name missing**: Please include `Team name: YourTeamName`")
        
        # Check for partner mention (@user)
        if mentions:
            # Filter out bots and the author themselves
            valid_mentions = [user for user in mentions if not user.bot and user.id != author_id]
            
            if len(valid_mentions) >= 1:
                partner = valid_mentions[0]
                
                # Verify partner is a member of this guild
                guild_member = guild.get_member(partner.id)
                if guild_member:
                    result["partner_id"] = partner.id
                else:
                    result["errors"].append(f"❌ **Partner not on server**: @{partner.name} is not a member of the {guild.name} Discord server")
            else:
                result["errors"].append("❌ **Partner mention missing**: Please mention your collaboration partner with @username (and don't mention yourself)")
        else:
            result["errors"].append("❌ **Partner mention missing**: Please mention your collaboration partner with @username")
        
        return result
    
    def _get_current_week_key(self) -> str:
        """Get current week identifier for tracking submissions (backwards compatibility)"""
        now = datetime.now()
        iso_year, iso_week, _ = now.isocalendar()
        return f"{iso_year}-W{iso_week}"
    
    async def _get_competition_week_key(self, guild) -> str:
        """Get current competition week identifier, handling bi-weekly mode"""
        now = datetime.now()
        iso_year, iso_week, _ = now.isocalendar()
        
        biweekly_mode = await self.config.guild(guild).biweekly_mode()
        
        if biweekly_mode:
            # In bi-weekly mode, only odd weeks have competitions
            # Week 1, 3, 5, etc. = active weeks
            # Week 2, 4, 6, etc. = off weeks
            return f"{iso_year}-W{iso_week}"
        else:
            # Regular weekly mode
            return f"{iso_year}-W{iso_week}"
    
    async def _is_competition_week(self, guild) -> bool:
        """Check if current week should have a competition (for bi-weekly mode)"""
        biweekly_mode = await self.config.guild(guild).biweekly_mode()
        
        if not biweekly_mode:
            return True  # Weekly mode - always active
        
        # Bi-weekly mode: only odd weeks are active
        now = datetime.now()
        iso_year, iso_week, _ = now.isocalendar()
        
        # Week 1, 3, 5, etc. are competition weeks
        # Week 2, 4, 6, etc. are off weeks
        return iso_week % 2 == 1
    
    # ========== COMPREHENSIVE DATA MANAGEMENT SYSTEM ==========
    
    async def _get_or_create_artist(self, guild, user_id: int, user_name: str = None) -> dict:
        """Get or create artist entry in normalized database"""
        artists_db = await self.config.guild(guild).artists_db()
        user_id_str = str(user_id)
        
        if user_id_str not in artists_db:
            # Create new artist entry
            member = guild.get_member(user_id)
            display_name = user_name or (member.display_name if member else f"User {user_id}")
            
            artists_db[user_id_str] = {
                "name": display_name,
                "suno_profile": None,  # To be filled when discovered
                "discord_rank": "Seed",  # Default rank
                "stats": {
                    "participations": 0,
                    "victories": 0,
                    "petals": 0,
                    "last_updated": datetime.now().isoformat()
                },
                "team_history": [],  # List of {team_id, week_key, role}
                "song_history": []   # List of song_ids this artist contributed to
            }
            await self.config.guild(guild).artists_db.set(artists_db)
        
        return artists_db[user_id_str]
    
    async def _get_or_create_team(self, guild, team_name: str, member_ids: list, week_key: str) -> int:
        """Get or create team entry and return team_id"""
        teams_db = await self.config.guild(guild).teams_db()
        next_ids = await self.config.guild(guild).next_unique_ids()
        
        # Check if exact team composition exists
        member_ids_set = set(str(uid) for uid in member_ids)
        for team_id, team_data in teams_db.items():
            if set(team_data["members"]) == member_ids_set and team_data["name"] == team_name:
                return int(team_id)

            # helper functions have been moved to class-level methods for reuse
        
        # Create new team
        team_id = next_ids["team_id"]
        teams_db[str(team_id)] = {
            "name": team_name,
            "members": [str(uid) for uid in member_ids],
            "stats": {
                "participations": 0,
                "victories": 0,
                "first_appearance": week_key,
                "last_appearance": week_key
            },
            "songs_by_week": {}  # {week_key: [song_ids]}
        }
        
        # Update next ID
        next_ids["team_id"] += 1
        await self.config.guild(guild).teams_db.set(teams_db)
        await self.config.guild(guild).next_unique_ids.set(next_ids)
        
        return team_id

    async def _get_submissions_safe(self, guild) -> dict:
        """Return submissions mapping safely, even if 'submissions' is not a registered config key."""
        try:
            cfg_all = await self.config.guild(guild).all()
        except Exception:
            cfg_all = {}
        subs = cfg_all.get('submissions') or {}
        # If the cog tracks submissions in weeks_db structure, try to flatten
        if not subs:
            weeks_db = cfg_all.get('weeks_db') or {}
            # Fallback: no `submissions` mapping present, try the weeks_db/songs_db mappings
            print(f"⚠️ CollabWarz: No 'submissions' mapping present for guild {guild.name} - falling back to other stores")
            # try to find current week
            try:
                week_key = await self._get_competition_week_key(guild)
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

    async def _clear_submissions_safe(self, guild):
        try:
            cfg_all = await self.config.guild(guild).all()
        except Exception:
            cfg_all = {}
        # Clear primary submissions mapping if present
        if 'submissions' in cfg_all:
            try:
                subs_group = getattr(self.config.guild(guild), 'submissions', None)
                if subs_group:
                    await subs_group.clear()
            except Exception:
                pass
        # Also clear submitted_teams entries for the current week
        try:
            week_key = await self._get_competition_week_key(guild)
            submitted_teams = cfg_all.get('submitted_teams') or {}
            if week_key in submitted_teams:
                submitted_teams[week_key] = []
                await self.config.guild(guild).submitted_teams.set(submitted_teams)
        except Exception:
            pass

    async def _remove_submission_safe(self, guild, team_name):
        try:
            cfg_all = await self.config.guild(guild).all()
        except Exception:
            cfg_all = {}
        # Remove from submissions mapping if present
        if 'submissions' in cfg_all:
            try:
                subs = cfg_all.get('submissions') or {}
                if team_name in subs:
                    del subs[team_name]
                    await self._set_submissions_safe(guild, subs)
                    return True
            except Exception:
                pass
        # Remove from submitted_teams list for current week
        try:
            week_key = await self._get_competition_week_key(guild)
            submitted_teams = cfg_all.get('submitted_teams') or {}
            wk = submitted_teams.get(week_key, [])
            if team_name in wk:
                wk.remove(team_name)
                submitted_teams[week_key] = wk
                await self.config.guild(guild).submitted_teams.set(submitted_teams)
                return True
        except Exception:
            pass
        return False

    async def _set_submissions_safe(self, guild, subs: dict) -> bool:
        """Set submissions if 'submissions' is registered, otherwise populate submitted_teams for the current week."""
        try:
            cfg_all = await self.config.guild(guild).all()
        except Exception:
            cfg_all = {}

        if 'submissions' in cfg_all:
            try:
                subs_group = getattr(self.config.guild(guild), 'submissions', None)
                if subs_group:
                    await subs_group.set(subs)
                    return True
            except Exception:
                pass

        # Fallback to populate submitted_teams
        try:
            week_key = await self._get_competition_week_key(guild)
            submitted_teams = cfg_all.get('submitted_teams') or {}
            submitted_teams[week_key] = list(subs.keys())
            await self.config.guild(guild).submitted_teams.set(submitted_teams)
            return True
        except Exception:
            pass

        return False
    
    async def _record_song_submission(self, guild, team_id: int, week_key: str, suno_url: str, title: str = None) -> int:
        """Record a song submission and return song_id"""
        songs_db = await self.config.guild(guild).songs_db()
        teams_db = await self.config.guild(guild).teams_db()
        next_ids = await self.config.guild(guild).next_unique_ids()
        
        # Create new song entry
        song_id = next_ids["song_id"]
        
        # Extract Suno song ID for metadata
        suno_song_id = self._extract_suno_song_id(suno_url)
        
        # Fetch Suno metadata immediately to identify author and update profiles
        suno_metadata = await self._fetch_suno_metadata(suno_song_id, guild)
        
        # Determine primary author and update artist profiles
        primary_author_id = await self._identify_and_update_song_author(
            guild, team_id, suno_metadata
        )
        
        songs_db[str(song_id)] = {
            "title": title or suno_metadata.get("title", f"Song {song_id}"),
            "suno_url": suno_url,
            "suno_song_id": suno_song_id,
            "team_id": team_id,
            "artists": teams_db[str(team_id)]["members"].copy(),
            "primary_author_id": primary_author_id,  # Track which team member's profile this is from
            "week_key": week_key,
            "submission_date": datetime.now().isoformat(),
            "suno_metadata": suno_metadata,  # Store immediately fetched metadata
            "vote_stats": {
                "total_votes": 0,
                "final_position": None,
                "won_week": False
            }
        }
        
        # Update team's song history
        if week_key not in teams_db[str(team_id)]["songs_by_week"]:
            teams_db[str(team_id)]["songs_by_week"][week_key] = []
        teams_db[str(team_id)]["songs_by_week"][week_key].append(song_id)
        
        # Update artist song histories
        artists_db = await self.config.guild(guild).artists_db()
        for artist_id in teams_db[str(team_id)]["members"]:
            if artist_id in artists_db:
                artists_db[artist_id]["song_history"].append(song_id)
        
        # Update next ID
        next_ids["song_id"] += 1
        
        # Save all changes
        await self.config.guild(guild).songs_db.set(songs_db)
        await self.config.guild(guild).teams_db.set(teams_db)
        await self.config.guild(guild).artists_db.set(artists_db)
        await self.config.guild(guild).next_unique_ids.set(next_ids)
        
        return song_id
    
    async def _update_week_data(self, guild, week_key: str, theme: str, status: str = "active") -> None:
        """Update or create week data entry"""
        weeks_db = await self.config.guild(guild).weeks_db()
        
        if week_key not in weeks_db:
            weeks_db[week_key] = {
                "theme": theme,
                "start_date": datetime.now().isoformat(),
                "status": status,  # active, voting, completed, cancelled
                "teams": [],      # List of team_ids that participated
                "songs": [],      # List of song_ids submitted
                "total_votes": 0,
                "winner_team_id": None,
                "winner_song_id": None,
                "vote_breakdown": {},  # {song_id: vote_count}
                "participants": []     # List of user_ids who participated
            }
        else:
            # Update existing week
            weeks_db[week_key]["theme"] = theme
            weeks_db[week_key]["status"] = status
        
        await self.config.guild(guild).weeks_db.set(weeks_db)
    
    async def _finalize_week_results(self, guild, week_key: str, winner_team_id: int, winner_song_id: int, vote_results: dict) -> None:
        """Finalize week results and update all related statistics"""
        weeks_db = await self.config.guild(guild).weeks_db()
        teams_db = await self.config.guild(guild).teams_db()
        songs_db = await self.config.guild(guild).songs_db()
        artists_db = await self.config.guild(guild).artists_db()
        
        # Update week data
        if week_key in weeks_db:
            weeks_db[week_key].update({
                "status": "completed",
                "winner_team_id": winner_team_id,
                "winner_song_id": winner_song_id,
                "vote_breakdown": vote_results,
                "total_votes": sum(vote_results.values()),
                "completion_date": datetime.now().isoformat()
            })
        
        # Update song vote statistics
        for song_id_str, votes in vote_results.items():
            if song_id_str in songs_db:
                songs_db[song_id_str]["vote_stats"]["total_votes"] = votes
                songs_db[song_id_str]["vote_stats"]["won_week"] = (int(song_id_str) == winner_song_id)
        
        # Update team statistics
        if str(winner_team_id) in teams_db:
            teams_db[str(winner_team_id)]["stats"]["victories"] += 1
        
        # Update all participating team stats
        for team_id_str in teams_db:
            team_data = teams_db[team_id_str]
            if week_key in team_data["songs_by_week"]:
                team_data["stats"]["participations"] += 1
                team_data["stats"]["last_appearance"] = week_key
        
        # Update artist statistics
        for artist_id_str in artists_db:
            # Check if this artist participated this week
            participated = False
            for team_id_str, team_data in teams_db.items():
                if (artist_id_str in team_data["members"] and 
                    week_key in team_data["songs_by_week"]):
                    participated = True
                    # Add team history entry
                    team_entry = {
                        "team_id": int(team_id_str),
                        "team_name": team_data["name"],
                        "week_key": week_key,
                        "won": (int(team_id_str) == winner_team_id)
                    }
                    artists_db[artist_id_str]["team_history"].append(team_entry)
                    break
            
            if participated:
                artists_db[artist_id_str]["stats"]["participations"] += 1
                if any(team["won"] for team in artists_db[artist_id_str]["team_history"] 
                       if team["week_key"] == week_key):
                    artists_db[artist_id_str]["stats"]["victories"] += 1
        
        # Save all changes
        await self.config.guild(guild).weeks_db.set(weeks_db)
        await self.config.guild(guild).teams_db.set(teams_db)
        await self.config.guild(guild).songs_db.set(songs_db)
        await self.config.guild(guild).artists_db.set(artists_db)
    
    async def _update_artist_suno_profile(self, guild, user_id: int, suno_url: str) -> None:
        """Update artist's Suno profile URL"""
        artists_db = await self.config.guild(guild).artists_db()
        user_id_str = str(user_id)
        
        if user_id_str in artists_db:
            artists_db[user_id_str]["suno_profile"] = suno_url
            await self.config.guild(guild).artists_db.set(artists_db)
    
    async def _update_artist_discord_rank(self, guild, user_id: int, rank: str) -> None:
        """Update artist's Discord rank (Seed, Sprout, Flower, Rosegarden, Eden)"""
        valid_ranks = ["Seed", "Sprout", "Flower", "Rosegarden", "Eden"]
        if rank not in valid_ranks:
            return
        
        artists_db = await self.config.guild(guild).artists_db()
        user_id_str = str(user_id)
        
        if user_id_str in artists_db:
            artists_db[user_id_str]["discord_rank"] = rank
            await self.config.guild(guild).artists_db.set(artists_db)
    
    async def _update_artist_petals(self, guild, user_id: int) -> None:
        """Sync artist's petal count from AutoReputation cog"""
        try:
            petal_count = await self._get_user_rep_count(guild, user_id)
            artists_db = await self.config.guild(guild).artists_db()
            user_id_str = str(user_id)
            
            if user_id_str in artists_db:
                artists_db[user_id_str]["stats"]["petals"] = petal_count
                artists_db[user_id_str]["stats"]["last_updated"] = datetime.now().isoformat()
                await self.config.guild(guild).artists_db.set(artists_db)
        except Exception as e:
            print(f"Error updating petals for user {user_id}: {e}")
    
    def _extract_suno_song_id(self, suno_url: str) -> str:
        """Extract Suno song ID from URL for metadata purposes"""
        if not suno_url:
            return ""
        
        # Suno URLs typically look like: https://suno.com/song/abc123def-456ghi-789jkl
        import re
        pattern = r'suno\.com/song/([a-f0-9\-]+)'
        match = re.search(pattern, suno_url)
        return match.group(1) if match else ""
    
    
    # ========== END COMPREHENSIVE DATA MANAGEMENT ==========
    
    def _get_current_week(self) -> str:
        """Get current week identifier (alias for _get_current_week_key for consistency)"""
        return self._get_current_week_key()
    
    def _extract_suno_song_id(self, url: str) -> str:
        """Extract Suno song ID from URL
        
        Args:
            url: Suno URL (e.g., https://suno.com/song/2619926b-bbb6-449d-9072-bded6177f3a0)
            
        Returns:
            Song ID string, or None if not found
        """
        import re
        # Match UUID pattern in Suno URLs
        pattern = r'suno\.com/song/([a-fA-F0-9-]{36})'
        match = re.search(pattern, url)
        return match.group(1) if match else None
    
    async def _identify_and_update_song_author(self, guild, team_id: int, suno_metadata: dict) -> str:
        """
        Identify which team member is the author of the Suno song and update their profile
        
        Args:
            guild: Discord guild
            team_id: ID of the team that submitted the song
            suno_metadata: Metadata fetched from Suno API
            
        Returns:
            user_id of the primary author, or None if not identified
        """
        if not suno_metadata or not suno_metadata.get("author_handle"):
            return None
            
        teams_db = await self.config.guild(guild).teams_db()
        artists_db = await self.config.guild(guild).artists_db()
        
        if str(team_id) not in teams_db:
            return None
            
        team_members = teams_db[str(team_id)]["members"]
        author_handle = suno_metadata["author_handle"]
        author_profile_url = f"https://suno.com/@{author_handle}"
        
        # Strategy 1: Check if any team member already has this exact Suno profile
        for member_id in team_members:
            if member_id in artists_db:
                existing_profile = artists_db[member_id].get("suno_profile")
                if existing_profile == author_profile_url:
                    print(f"✅ Matched song author @{author_handle} to existing profile: {member_id}")
                    return member_id
        
        # Strategy 2: Check if any team member has a similar handle (case-insensitive, username variations)
        for member_id in team_members:
            member = guild.get_member(int(member_id))
            if member:
                # Check against Discord username variations
                username_variations = [
                    member.name.lower(),
                    member.display_name.lower(),
                    member.name.lower().replace("_", ""),
                    member.display_name.lower().replace("_", ""),
                    member.name.lower().replace("-", ""),
                    member.display_name.lower().replace("-", "")
                ]
                
                if author_handle.lower() in username_variations:
                    # High confidence match - update their profile
                    if member_id in artists_db:
                        artists_db[member_id]["suno_profile"] = author_profile_url
                        await self.config.guild(guild).artists_db.set(artists_db)
                        print(f"🎯 Auto-linked Suno profile @{author_handle} to {member.display_name} ({member_id})")
                        return member_id
        
        # Strategy 3: Check if it's a partial match or contains Discord name
        best_match_id = None
        best_match_score = 0
        
        for member_id in team_members:
            member = guild.get_member(int(member_id))
            if member:
                # Check if Discord name is contained in Suno handle or vice versa
                discord_name = member.display_name.lower()
                suno_handle_lower = author_handle.lower()
                
                # Calculate similarity score
                score = 0
                if discord_name in suno_handle_lower:
                    score = len(discord_name) / len(suno_handle_lower)
                elif suno_handle_lower in discord_name:
                    score = len(suno_handle_lower) / len(discord_name)
                
                if score > best_match_score and score > 0.5:  # At least 50% similarity
                    best_match_score = score
                    best_match_id = member_id
        
        # If we found a good partial match, suggest it but don't auto-link
        if best_match_id and best_match_score > 0.7:  # High confidence threshold
            member = guild.get_member(int(best_match_id))
            if member and best_match_id in artists_db:
                # Only auto-link if they don't already have a different Suno profile
                existing_profile = artists_db[best_match_id].get("suno_profile")
                if not existing_profile:
                    artists_db[best_match_id]["suno_profile"] = author_profile_url
                    await self.config.guild(guild).artists_db.set(artists_db)
                    print(f"🔗 Suggested Suno link @{author_handle} to {member.display_name} ({best_match_id}) - {best_match_score:.1%} similarity")
                    return best_match_id
                else:
                    print(f"⚠️ Possible match for @{author_handle} is {member.display_name}, but they already have profile: {existing_profile}")
        
        # Strategy 4: No clear match - create a note for manual review
        print(f"❓ Could not auto-match Suno author @{author_handle} to team members: {[guild.get_member(int(mid)).display_name if guild.get_member(int(mid)) else mid for mid in team_members]}")
        
        # Store unmatched author info for potential future matching
        unmatched_authors = await self.config.guild(guild).unmatched_suno_authors()
        if not unmatched_authors:
            unmatched_authors = {}
        
        if author_handle not in unmatched_authors:
            unmatched_authors[author_handle] = {
                "profile_url": author_profile_url,
                "author_name": suno_metadata.get("author_name", "Unknown"),
                "first_seen": datetime.now().isoformat(),
                "team_appearances": []
            }
        
        unmatched_authors[author_handle]["team_appearances"].append({
            "team_id": team_id,
            "team_members": team_members,
            "date": datetime.now().isoformat()
        })
        
        await self.config.guild(guild).unmatched_suno_authors.set(unmatched_authors)
        
        return None  # No match found
    
    async def _fetch_suno_metadata(self, song_id: str, guild: discord.Guild) -> dict:
        """Fetch song metadata from Suno API
        
        Args:
            song_id: Suno song ID
            guild: Discord guild for configuration
            
        Returns:
            Dictionary with song metadata or empty dict if failed
        """
        suno_enabled = await self.config.guild(guild).suno_api_enabled()
        if not suno_enabled:
            return {}
        
        base_url = await self.config.guild(guild).suno_api_base_url()
        
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(
                    f"{base_url}/song/{song_id}",
                    timeout=aiohttp.ClientTimeout(total=10)
                ) as response:
                    if response.status == 200:
                        data = await response.json()
                        
                        # Extract relevant fields for frontend
                        return {
                            "id": data.get("id"),
                            "title": data.get("title"),
                            "audio_url": data.get("audio_url"),
                            "image_url": data.get("image_url"),
                            "duration": data.get("metadata", {}).get("duration"),
                            "author_name": data.get("display_name"),
                            "author_handle": data.get("handle"),
                            "author_avatar": data.get("avatar_image_url"),
                            "play_count": data.get("play_count"),
                            "upvote_count": data.get("upvote_count"),
                            "tags": data.get("metadata", {}).get("tags"),
                            "created_at": data.get("created_at")
                        }
                    else:
                        print(f"Suno API error: HTTP {response.status}")
                        return {}
        except Exception as e:
            print(f"Error fetching Suno metadata for {song_id}: {e}")
            return {}
    
    async def _is_team_already_submitted(self, guild, team_name: str, user_id: int, partner_id: int) -> dict:
        """Check if team or members already submitted this competition cycle"""
        week_key = await self._get_competition_week_key(guild)
        submitted_teams = await self.config.guild(guild).submitted_teams()
        team_members = await self.config.guild(guild).team_members()
        
        # Get submissions for current week
        week_teams = submitted_teams.get(week_key, [])
        week_members = team_members.get(week_key, {})
        
        result = {
            "can_submit": True,
            "errors": []
        }
        
        # Check if exact team name already exists
        if team_name.lower() in [t.lower() for t in week_teams]:
            result["can_submit"] = False
            result["errors"].append(f"❌ **Team name already used**: `{team_name}` has already submitted this week")
        
        # Check if either member is already in another team
        for existing_team, members in week_members.items():
            if user_id in members:
                result["can_submit"] = False
                result["errors"].append(f"❌ **You're already in a team**: You're part of team `{existing_team}` this week")
            
            if partner_id in members:
                result["can_submit"] = False
                result["errors"].append(f"❌ **Partner already in a team**: Your partner is already part of team `{existing_team}` this week")
        
        return result
    
    async def _register_team_submission(self, guild, team_name: str, user_id: int, partner_id: int):
        """Register a successful team submission"""
        week_key = await self._get_competition_week_key(guild)
        
        # Update submitted teams
        submitted_teams = await self.config.guild(guild).submitted_teams()
        if week_key not in submitted_teams:
            submitted_teams[week_key] = []
        submitted_teams[week_key].append(team_name)
        await self.config.guild(guild).submitted_teams.set(submitted_teams)
        
        # Update team members
        team_members = await self.config.guild(guild).team_members()
        if week_key not in team_members:
            team_members[week_key] = {}
        team_members[week_key][team_name] = [user_id, partner_id]
        await self.config.guild(guild).team_members.set(team_members)
    
    async def _send_submission_error(self, channel, user, errors: list):
        """Send submission validation error message"""
        error_msg = f"{user.mention}, there are issues with your submission:\n\n"
        error_msg += "\n".join(errors)
        error_msg += "\n\n**Correct format:**\n"
        error_msg += "```\n"
        error_msg += "Team name: Amazing Duo\n"
        error_msg += "@YourPartner check out our track!\n"
        error_msg += "[Suno.com link only]\n"
        error_msg += "```\n"
        error_msg += "💡 **Alternative:** Submit via our website: **https://collabwarz.soundgarden.app**\n"
        error_msg += "ℹ️ **Need help?** Use `!info` for submission guide or `!status` for competition status"
        
        await channel.send(error_msg)
    
    def _start_api_server(self, guild):
        """Start the API server for this guild"""
        try:
            app = web.Application()
            
            # Add CORS middleware
            async def cors_middleware(request, handler):
                try:
                    response = await handler(request)
                    cors_origins = await self.config.guild(guild).cors_origins()
                    
                    if "*" in cors_origins:
                        response.headers['Access-Control-Allow-Origin'] = '*'
                    else:
                        origin = request.headers.get('Origin')
                        if origin and origin in cors_origins:
                            response.headers['Access-Control-Allow-Origin'] = origin
                    
                    response.headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS'
                    response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization'
                    
                    return response
                except Exception as e:
                    print(f"CORS middleware error: {e}")
                    return web.json_response({"error": "CORS error"}, status=500)
            
            # Temporarily disable CORS middleware to fix TypeError
            # app.middlewares.append(cors_middleware)
            
            # Define API routes
            app.router.add_get('/api/members', self._handle_members_request)
            app.router.add_options('/api/members', self._handle_options_request)
            
            # Public API routes (for frontend users)
            app.router.add_get('/api/public/status', self._handle_public_status)
            app.router.add_get('/api/public/submissions', self._handle_public_submissions)
            app.router.add_get('/api/public/history', self._handle_public_history)
            app.router.add_get('/api/public/voting', self._handle_public_voting)
            app.router.add_post('/api/public/vote', self._handle_public_vote)
            app.router.add_get('/api/public/leaderboard', self._handle_public_leaderboard)
            # Comprehensive Data API routes (new normalized database access)
            app.router.add_get('/api/public/artists', self._handle_public_artists)
            app.router.add_get('/api/public/artists/{user_id}', self._handle_public_artist_detail)
            app.router.add_get('/api/public/teams', self._handle_public_teams)
            app.router.add_get('/api/public/teams/{team_id}', self._handle_public_team_detail)
            app.router.add_get('/api/public/songs', self._handle_public_songs)
            app.router.add_get('/api/public/songs/{song_id}', self._handle_public_song_detail)
            app.router.add_get('/api/public/weeks', self._handle_public_weeks)
            app.router.add_get('/api/public/weeks/{week_key}', self._handle_public_week_detail)
            app.router.add_get('/api/public/stats/artist/{user_id}', self._handle_public_artist_stats)
            app.router.add_get('/api/public/stats/leaderboard', self._handle_public_stats_leaderboard)
            app.router.add_get('/api/public/user/{user_id}/membership', self._handle_public_user_membership)
            
            # Test endpoints
            app.router.add_get('/api/ping', self._handle_ping)
            app.router.add_get('/api/test', self._handle_test)
            app.router.add_get('/api/simple', self._handle_simple_test)
            
            app.router.add_options('/api/public/{path:.*}', self._handle_options_request)
            
            # Admin API routes
            app.router.add_get('/api/admin/config', self._handle_admin_config_get)
            app.router.add_post('/api/admin/config', self._handle_admin_config_post)
            app.router.add_get('/api/admin/status', self._handle_admin_status)
            app.router.add_get('/api/admin/submissions', self._handle_admin_submissions)
            app.router.add_get('/api/admin/history', self._handle_admin_history)
            app.router.add_post('/api/admin/actions', self._handle_admin_actions)
            
            # Admin moderation endpoints
            app.router.add_delete('/api/admin/submissions/{team_name}', self._handle_admin_remove_submission)
            app.router.add_delete('/api/admin/votes/{week}/{user_id}', self._handle_admin_remove_vote)
            app.router.add_delete('/api/admin/weeks/{week}', self._handle_admin_remove_week)
            app.router.add_get('/api/admin/votes/{week}/details', self._handle_admin_vote_details)
            app.router.add_get('/api/admin/test', self._handle_admin_test)
            
            app.router.add_options('/api/admin/{path:.*}', self._handle_options_request)
            
            return app
            
        except Exception as e:
            print(f"Error starting API server: {e}")
            return None
    
    async def _handle_options_request(self, request):
        """Handle CORS preflight requests"""
        return web.Response(status=200)
    
    async def _handle_members_request(self, request):
        """Handle API request for guild members list"""
        try:
            # Find the guild for this request
            guild = None
            for g in self.bot.guilds:
                api_enabled = await self.config.guild(g).api_server_enabled()
                if api_enabled:
                    guild = g
                    break
            
            if not guild:
                return web.json_response(
                    {"error": "API not enabled"}, 
                    status=503
                )
            
            # Check authentication
            auth_token = await self.config.guild(guild).api_access_token()
            if auth_token:
                auth_header = request.headers.get('Authorization', '')
                if not auth_header.startswith('Bearer '):
                    return web.json_response(
                        {"error": "Missing or invalid authorization"}, 
                        status=401
                    )
                
                provided_token = auth_header[7:]  # Remove 'Bearer ' prefix
                if provided_token != auth_token:
                    return web.json_response(
                        {"error": "Invalid token"}, 
                        status=403
                    )
            
            # Get members list
            members_data = await self._get_guild_members_for_api(guild)
            
            response = web.json_response({
                "guild": {
                    "id": str(guild.id),
                    "name": guild.name,
                    "member_count": guild.member_count
                },
                "members": members_data,
                "timestamp": datetime.utcnow().isoformat()
            })
            
            # Add CORS headers directly
            response.headers['Access-Control-Allow-Origin'] = '*'
            response.headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS'
            response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization'
            
            return response
            
        except Exception as e:
            print(f"Error handling members request: {e}")
            return web.json_response(
                {"error": "Internal server error"}, 
                status=500
            )
    
    async def _get_guild_members_for_api(self, guild):
        """Get formatted guild members data for API"""
        try:
            members_data = []
            
            for member in guild.members:
                # Skip bots
                if member.bot:
                    continue
                
                member_data = {
                    "id": str(member.id),
                    "username": member.name,
                    "display_name": member.display_name,
                    "discriminator": member.discriminator if hasattr(member, 'discriminator') else None,
                    "avatar_url": str(member.display_avatar.url) if member.display_avatar else None,
                    "joined_at": member.joined_at.isoformat() if member.joined_at else None
                }
                
                members_data.append(member_data)
            
            # Sort by display name for easier frontend usage
            members_data.sort(key=lambda x: x["display_name"].lower())
            
            return members_data
            
        except Exception as e:
            print(f"Error getting guild members: {e}")
            return []
    
    async def _validate_admin_auth(self, request):
        """Validate admin authentication for API requests"""
        try:
            # Find the guild for this request
            guild = None
            for g in self.bot.guilds:
                api_enabled = await self.config.guild(g).api_server_enabled()
                if api_enabled:
                    guild = g
                    break
            
            if not guild:
                return None, web.json_response({"error": "API not enabled"}, status=503)
            
            # Check authentication (required for admin endpoints)
            token_data = await self.config.guild(guild).api_access_token_data()
            token_user_id = None
            token_valid = False
            
            auth_header = request.headers.get('Authorization', '')
            if not auth_header.startswith('Bearer '):
                return None, web.json_response({"error": "Missing authorization header"}, status=401)
            
            provided_token = auth_header[7:]  # Remove 'Bearer ' prefix
            
            # Try JWT validation first (most secure)
            signing_key = await self.config.guild(guild).jwt_signing_key()
            if signing_key and '.' in provided_token:
                try:
                    import json
                    import base64
                    import hashlib
                    from datetime import datetime
                    
                    # Parse JWT token
                    parts = provided_token.split('.')
                    if len(parts) != 3:
                        print(f"Invalid JWT format: expected 3 parts, got {len(parts)}")
                        return None, web.json_response({"error": "Invalid token format"}, status=400)
                    
                    header_b64, payload_b64, signature = parts
                    
                    # Validate that parts are not empty
                    if not all([header_b64, payload_b64, signature]):
                        print("Invalid JWT: empty parts detected")
                        return None, web.json_response({"error": "Invalid token structure"}, status=400)
                    
                    # Verify signature
                    message = f"{header_b64}.{payload_b64}"
                    expected_sig = hashlib.new('sha256', (message + signing_key).encode()).hexdigest()
                    
                    if signature == expected_sig:
                        # Decode payload
                        payload_json = base64.urlsafe_b64decode(payload_b64 + '=' * (-len(payload_b64) % 4)).decode()
                        payload = json.loads(payload_json)
                        
                        # Check expiration
                        try:
                            # Handle different datetime formats
                            expires_str = payload['expires_at']
                            if 'Z' in expires_str:
                                expires_str = expires_str.replace('Z', '+00:00')
                            expires_at = datetime.fromisoformat(expires_str)
                        except ValueError:
                            # Fallback: try parsing without timezone
                            expires_at = datetime.fromisoformat(payload['expires_at'].split('+')[0].split('Z')[0])
                        
                        if datetime.utcnow() < expires_at:
                            token_valid = True
                            token_user_id = payload.get('user_id')
                            print(f"JWT token validated for user {token_user_id} in guild {guild.id}")
                        else:
                            print(f"JWT token expired for guild {guild.id}")
                            return None, web.json_response({"error": "Token expired"}, status=401)
                    else:
                        print(f"JWT signature validation failed for guild {guild.id}")
                        return None, web.json_response({"error": "Invalid token signature"}, status=403)
                except Exception as e:
                    print(f"JWT validation error: {e}")
                    return None, web.json_response({"error": f"Token validation failed: {str(e)}"}, status=400)
            
            # Fallback to legacy token formats if JWT failed
            if not token_valid:
                if token_data and token_data.get('token_hash'):
                    # Legacy hashed token format
                    import hashlib
                    stored_hash = token_data['token_hash']
                    salt = bytes.fromhex(token_data['salt'])
                    token_user_id = token_data.get('user_id')
                    
                    # Hash the provided token with stored salt
                    provided_hash = hashlib.pbkdf2_hmac('sha256', provided_token.encode('utf-8'), salt, 100000)
                    
                    if provided_hash.hex() == stored_hash:
                        token_valid = True
                        print(f"Warning: Using legacy hashed token for guild {guild.id}")
                
                elif token_data and token_data.get('token'):
                    # Legacy enhanced token format (unhashed)
                    if provided_token == token_data['token']:
                        token_valid = True
                        token_user_id = token_data.get('user_id')
                        print(f"Warning: Using legacy unhashed token for guild {guild.id}")
                
                else:
                    # Backward compatibility: check old token format
                    old_token = await self.config.guild(guild).api_access_token()
                    if old_token and provided_token == old_token:
                        token_valid = True
                        print(f"Warning: Using legacy admin token without user association for guild {guild.id}")
            
            if not token_valid:
                return None, web.json_response({"error": "Invalid token"}, status=403)
            
            # Validate that the token belongs to a configured Discord admin (only for new tokens)
            if token_user_id:
                primary_admin_id = await self.config.guild(guild).admin_user_id()
                admin_ids = await self.config.guild(guild).admin_user_ids()
                
                if token_user_id != primary_admin_id and token_user_id not in admin_ids:
                    return None, web.json_response({"error": "Token user no longer configured as admin"}, status=403)
            
            return guild, None
            
        except Exception as e:
            print(f"Error validating admin auth: {e}")
            return None, web.json_response({"error": f"Authentication failed: {str(e)}"}, status=500)
    
    async def _handle_admin_config_get(self, request):
        """Get current bot configuration for admin panel"""
        guild, error_response = await self._validate_admin_auth(request)
        if error_response:
            return error_response
        
        try:
            config = await self.config.guild(guild).all()
            
            # Sanitize sensitive data
            safe_config = config.copy()
            if 'api_access_token' in safe_config:
                safe_config['api_access_token'] = "***HIDDEN***" if safe_config['api_access_token'] else None
            
            return web.json_response({
                "guild": {
                    "id": str(guild.id),
                    "name": guild.name,
                    "member_count": guild.member_count
                },
                "config": safe_config,
                "timestamp": datetime.utcnow().isoformat()
            })
            
        except Exception as e:
            print(f"Error getting admin config: {e}")
            return web.json_response({"error": "Failed to get configuration"}, status=500)
    
    async def _handle_admin_config_post(self, request):
        """Update bot configuration from admin panel"""
        guild, error_response = await self._validate_admin_auth(request)
        if error_response:
            return error_response
        
        try:
            data = await request.json()
            updates = data.get('updates', {})
            
            # Define allowed configuration updates
            allowed_updates = {
                'current_theme': str,
                'current_phase': str,
                'automation_enabled': bool,
                'everyone_ping': bool,
                'auto_delete_messages': bool,
                'api_server_enabled': bool,
                'api_port': int,
                'cors_origins': list,
                'ai_api_url': str,
                'ai_model': str
            }
            
            applied_updates = {}
            
            for key, value in updates.items():
                if key in allowed_updates:
                    expected_type = allowed_updates[key]
                    
                    # Type validation
                    if expected_type == bool and isinstance(value, bool):
                        await self.config.guild(guild).set_raw(key, value=value)
                        applied_updates[key] = value
                    elif expected_type == str and isinstance(value, str):
                        await self.config.guild(guild).set_raw(key, value=value)
                        applied_updates[key] = value
                    elif expected_type == int and isinstance(value, int):
                        await self.config.guild(guild).set_raw(key, value=value)
                        applied_updates[key] = value
                    elif expected_type == list and isinstance(value, list):
                        await self.config.guild(guild).set_raw(key, value=value)
                        applied_updates[key] = value
            
            return web.json_response({
                "success": True,
                "applied_updates": applied_updates,
                "timestamp": datetime.utcnow().isoformat()
            })
            
        except Exception as e:
            print(f"Error updating admin config: {e}")
            return web.json_response({"error": "Failed to update configuration"}, status=500)
    
    async def _handle_admin_status(self, request):
        """Get current competition status for admin panel"""
        guild, error_response = await self._validate_admin_auth(request)
        if error_response:
            return error_response
        
        try:
            current_phase = await self.config.guild(guild).current_phase()
            current_theme = await self.config.guild(guild).current_theme()
            automation_enabled = await self.config.guild(guild).automation_enabled()
            week_cancelled = await self.config.guild(guild).week_cancelled()
            
            # Get submission stats
            submissions = await self._get_submissions_safe(guild)
            team_count = len(submissions)
            
            # Get voting results if available
            # Get internal voting results
            voting_results = {}
            try:
                current_week = self._get_current_week()
                all_voting_results = await self.config.guild(guild).voting_results()
                voting_results = all_voting_results.get(current_week, {})
            except Exception as e:
                print(f"Error getting voting results: {e}")
            
            next_phase_time = None
            try:
                next_phase_time = self._get_next_phase_time()
            except Exception as e:
                print(f"Error getting next phase time: {e}")
            
            status = {
                "phase": current_phase,
                "theme": current_theme,
                "automation_enabled": automation_enabled,
                "week_cancelled": week_cancelled,
                "team_count": team_count,
                "voting_results": voting_results,
                "next_phase_change": next_phase_time,
                "timestamp": datetime.utcnow().isoformat()
            }
            
            return web.json_response(status)
            
        except Exception as e:
            print(f"Error getting admin status: {e}")
            return web.json_response({"error": "Failed to get status"}, status=500)
    
    async def _handle_admin_test(self, request):
        """Simple admin test endpoint without heavy validation"""
        try:
            # Find the guild for this request
            guild = None
            for g in self.bot.guilds:
                api_enabled = await self.config.guild(g).api_server_enabled()
                if api_enabled:
                    guild = g
                    break
            
            if not guild:
                return web.json_response({"error": "API not enabled"}, status=503)
            
            return web.json_response({
                "status": "success",
                "message": "Admin test endpoint works",
                "guild_name": guild.name,
                "timestamp": datetime.utcnow().isoformat()
            })
        except Exception as e:
            print(f"Error in admin test: {e}")
            return web.json_response({"error": f"Admin test failed: {str(e)}"}, status=500)
    
    async def _handle_admin_submissions(self, request):
        """Get current submissions for admin panel"""
        guild, error_response = await self._validate_admin_auth(request)
        if error_response:
            return error_response
        
        try:
            submissions = await self._get_submissions_safe(guild)
            
            # Enrich submissions with member data
            enriched_submissions = []
            for team_name, submission in submissions.items():
                members_info = []
                
                for member_id in submission.get('members', []):
                    member = guild.get_member(int(member_id))
                    if member:
                        members_info.append({
                            "id": str(member.id),
                            "username": member.name,
                            "display_name": member.display_name,
                            "avatar_url": str(member.display_avatar.url) if member.display_avatar else None
                        })
                
                enriched_submission = {
                    "team_name": team_name,
                    "track_url": submission.get('track_url'),
                    "members": members_info,
                    "submitted_at": submission.get('submitted_at'),
                    "message_id": submission.get('message_id')
                }
                
                enriched_submissions.append(enriched_submission)
            
            # Sort by submission time
            enriched_submissions.sort(key=lambda x: x.get('submitted_at', ''), reverse=True)
            
            return web.json_response({
                "submissions": enriched_submissions,
                "count": len(enriched_submissions),
                "timestamp": datetime.utcnow().isoformat()
            })
            
        except Exception as e:
            print(f"Error getting admin submissions: {e}")
            return web.json_response({"error": "Failed to get submissions"}, status=500)
    
    async def _handle_admin_history(self, request):
        """Get competition history for admin panel"""
        guild, error_response = await self._validate_admin_auth(request)
        if error_response:
            return error_response
        
        try:
            history = await self.config.guild(guild).competition_history()
            
            # Get pagination parameters
            page = int(request.query.get('page', 1))
            per_page = int(request.query.get('per_page', 20))
            
            # Sort by date (most recent first)
            sorted_history = sorted(history.items(), key=lambda x: x[1].get('end_date', ''), reverse=True)
            
            # Paginate
            start_idx = (page - 1) * per_page
            end_idx = start_idx + per_page
            paginated_history = sorted_history[start_idx:end_idx]
            
            return web.json_response({
                "history": dict(paginated_history),
                "pagination": {
                    "page": page,
                    "per_page": per_page,
                    "total": len(sorted_history),
                    "pages": (len(sorted_history) + per_page - 1) // per_page
                },
                "timestamp": datetime.utcnow().isoformat()
            })
            
        except Exception as e:
            print(f"Error getting admin history: {e}")
            return web.json_response({"error": "Failed to get history"}, status=500)
    
    async def _handle_admin_actions(self, request):
        """Handle admin actions from the web panel"""
        guild, error_response = await self._validate_admin_auth(request)
        if error_response:
            return error_response
        
        try:
            data = await request.json()
            action = data.get('action')
            params = data.get('params', {})
            
            result = {"success": False, "message": "Unknown action"}
            
            if action == "set_phase":
                phase = params.get('phase')
                if phase in ['submission', 'voting', 'paused', 'cancelled', 'ended', 'inactive']:
                    await self.config.guild(guild).current_phase.set(phase)
                    result = {"success": True, "message": f"Phase set to {phase}"}
                else:
                    result = {"success": False, "message": "Invalid phase"}
            
            elif action == "set_theme":
                theme = params.get('theme', '').strip()
                if theme:
                    await self.config.guild(guild).current_theme.set(theme)
                    result = {"success": True, "message": f"Theme set to: {theme}"}
                else:
                    result = {"success": False, "message": "Theme cannot be empty"}
            
            elif action == "start_new_week":
                theme = params.get('theme', '').strip()
                if theme:
                    await self.config.guild(guild).current_theme.set(theme)
                    await self.config.guild(guild).current_phase.set('submission')
                    await self.config.guild(guild).week_cancelled.set(False)
                    await self._clear_submissions_safe(guild)
                    result = {"success": True, "message": f"New week started with theme: {theme}"}
                else:
                    result = {"success": False, "message": "Theme required for new week"}
            
            elif action == "cancel_week":
                reason = params.get('reason', 'Admin cancelled')
                await self.config.guild(guild).current_phase.set('cancelled')
                await self.config.guild(guild).week_cancelled.set(True)
                result = {"success": True, "message": f"Week cancelled: {reason}"}
            
            elif action == "clear_submissions":
                await self._clear_submissions_safe(guild)
                result = {"success": True, "message": "All submissions cleared"}
            
            elif action == "toggle_automation":
                current = await self.config.guild(guild).automation_enabled()
                await self.config.guild(guild).automation_enabled.set(not current)
                status = "enabled" if not current else "disabled"
                result = {"success": True, "message": f"Automation {status}"}
            
            else:
                result = {"success": False, "message": f"Unknown action: {action}"}
            
            result["timestamp"] = datetime.utcnow().isoformat()
            return web.json_response(result)
            
        except Exception as e:
            print(f"Error handling admin action: {e}")
            return web.json_response({"error": "Failed to execute action"}, status=500)
    
    async def _handle_admin_remove_submission(self, request):
        """Remove a submission from a team"""
        guild, error_response = await self._validate_admin_auth(request)
        if error_response:
            return error_response
        
        try:
            team_name = request.match_info.get('team_name')
            if not team_name:
                return web.json_response({"error": "Team name required"}, status=400)
            
            submissions = await self._get_submissions_safe(guild)
            if team_name in submissions:
                del submissions[team_name]
                await self._set_submissions_safe(guild, submissions)
                return web.json_response({
                    "success": True, 
                    "message": f"Submission from {team_name} removed",
                    "timestamp": datetime.utcnow().isoformat()
                })
            else:
                return web.json_response({"error": f"No submission found for team {team_name}"}, status=404)
                
        except Exception as e:
            print(f"Error removing submission: {e}")
            return web.json_response({"error": "Failed to remove submission"}, status=500)
    
    async def _handle_admin_remove_vote(self, request):
        """Remove a vote from a user for a specific week"""
        guild, error_response = await self._validate_admin_auth(request)
        if error_response:
            return error_response
        
        try:
            week = request.match_info.get('week')
            user_id = request.match_info.get('user_id')
            
            if not week or not user_id:
                return web.json_response({"error": "Week and user_id required"}, status=400)
            
            try:
                user_id = int(user_id)
            except ValueError:
                return web.json_response({"error": "Invalid user_id format"}, status=400)
            
            history = await self.config.guild(guild).competition_history()
            week_data = history.get(week)
            
            if not week_data:
                return web.json_response({"error": f"No data found for week {week}"}, status=404)
            
            votes = week_data.get('votes', {})
            user_id_str = str(user_id)
            
            if user_id_str in votes:
                del votes[user_id_str]
                week_data['votes'] = votes
                history[week] = week_data
                await self.config.guild(guild).competition_history.set(history)
                
                return web.json_response({
                    "success": True,
                    "message": f"Vote from user {user_id} for week {week} removed",
                    "timestamp": datetime.utcnow().isoformat()
                })
            else:
                return web.json_response({"error": f"No vote found from user {user_id} for week {week}"}, status=404)
                
        except Exception as e:
            print(f"Error removing vote: {e}")
            return web.json_response({"error": "Failed to remove vote"}, status=500)
    
    async def _handle_admin_remove_week(self, request):
        """Remove an entire week record from competition history"""
        guild, error_response = await self._validate_admin_auth(request)
        if error_response:
            return error_response
        
        try:
            week = request.match_info.get('week')
            if not week:
                return web.json_response({"error": "Week identifier required"}, status=400)
            
            history = await self.config.guild(guild).competition_history()
            
            if week in history:
                del history[week]
                await self.config.guild(guild).competition_history.set(history)
                
                return web.json_response({
                    "success": True,
                    "message": f"Week {week} record completely removed",
                    "timestamp": datetime.utcnow().isoformat()
                })
            else:
                return web.json_response({"error": f"No record found for week {week}"}, status=404)
                
        except Exception as e:
            print(f"Error removing week record: {e}")
            return web.json_response({"error": "Failed to remove week record"}, status=500)
    
    async def _handle_admin_vote_details(self, request):
        """Get detailed voting information for a specific week"""
        guild, error_response = await self._validate_admin_auth(request)
        if error_response:
            return error_response
        
        try:
            week = request.match_info.get('week')
            if not week:
                return web.json_response({"error": "Week identifier required"}, status=400)
            
            history = await self.config.guild(guild).competition_history()
            week_data = history.get(week)
            
            if not week_data:
                return web.json_response({"error": f"No data found for week {week}"}, status=404)
            
            votes = week_data.get('votes', {})
            submissions = week_data.get('submissions', {})
            
            # Build detailed vote information
            vote_details = []
            
            for user_id, vote_data in votes.items():
                try:
                    user = self.bot.get_user(int(user_id))
                    username = user.display_name if user else f"Unknown User ({user_id})"
                except:
                    username = f"Unknown User ({user_id})"
                
                voted_for = vote_data.get('voted_for', 'Unknown')
                voted_at = vote_data.get('timestamp', 'Unknown')
                
                vote_details.append({
                    "user_id": user_id,
                    "username": username,
                    "voted_for": voted_for,
                    "voted_at": voted_at
                })
            
            # Get submission details with Suno metadata for admin context
            submission_details = {}
            for team, submission in submissions.items():
                song_url = submission.get('url', '')
                
                # Create base submission info
                submission_info = {
                    "url": song_url,
                    "submitted_by": submission.get('submitted_by', 'Unknown'),
                    "submitted_at": submission.get('timestamp', 'Unknown'),
                    "song_metadata": None
                }
                
                # Fetch Suno metadata if available
                if song_url and 'suno.com' in song_url.lower():
                    try:
                        song_metadata = await self._fetch_suno_metadata(song_url)
                        if song_metadata:
                            submission_info["song_metadata"] = {
                                "title": song_metadata.get('title', 'Unknown Title'),
                                "audio_url": song_metadata.get('audio_url'),
                                "image_url": song_metadata.get('image_url'),
                                "author_profile_url": song_metadata.get('author_profile_url'),
                                "duration": song_metadata.get('duration'),
                                "tags": song_metadata.get('tags', [])
                            }
                    except Exception as e:
                        print(f"Failed to fetch Suno metadata for admin vote details: {e}")
                        # Continue without metadata
                
                submission_details[team] = submission_info
            
            return web.json_response({
                "week": week,
                "theme": week_data.get('theme', 'Unknown'),
                "total_votes": len(votes),
                "vote_details": vote_details,
                "submissions": submission_details,
                "timestamp": datetime.utcnow().isoformat()
            })
            
        except Exception as e:
            print(f"Error getting vote details: {e}")
            return web.json_response({"error": "Failed to get vote details"}, status=500)
    
    def _get_next_phase_time(self):
        """Calculate when the next automated phase change will occur"""
        try:
            now = datetime.now()
            
            # Monday 00:00 - New week starts (submission phase)
            days_until_monday = (7 - now.weekday()) % 7
            if days_until_monday == 0 and now.hour >= 0:
                days_until_monday = 7
            next_monday = (now + timedelta(days=days_until_monday)).replace(hour=0, minute=0, second=0, microsecond=0)
            
            # Sunday 20:00 - Voting results
            days_until_sunday = (6 - now.weekday()) % 7
            if days_until_sunday == 0 and now.hour >= 20:
                days_until_sunday = 7
            next_sunday_voting = (now + timedelta(days=days_until_sunday)).replace(hour=20, minute=0, second=0, microsecond=0)
            
            # Return the next upcoming event
            if next_sunday_voting < next_monday:
                return {
                    "event": "voting_results",
                    "time": next_sunday_voting.isoformat(),
                    "description": "Voting results and winner announcement"
                }
            else:
                return {
                    "event": "new_week",
                    "time": next_monday.isoformat(),
                    "description": "New competition week starts"
                }
                
        except Exception as e:
            print(f"Error calculating next phase time: {e}")
            return None
    
    async def _handle_public_status(self, request):
        """Get current competition status for frontend users"""
        try:
            # Find the guild for this request (no auth required for public endpoints)
            guild = None
            for g in self.bot.guilds:
                api_enabled = await self.config.guild(g).api_server_enabled()
                if api_enabled:
                    guild = g
                    break
            
            if not guild:
                return web.json_response({"error": "API not enabled"}, status=503)
            
            current_phase = await self.config.guild(guild).current_phase()
            current_theme = await self.config.guild(guild).current_theme()
            week_cancelled = await self.config.guild(guild).week_cancelled()
            
            # Get submission stats
            submissions = await self._get_submissions_safe(guild)
            team_count = len(submissions)
            
            # Calculate competition timeline
            now = datetime.now()
            week_start = now - timedelta(days=now.weekday())  # Monday
            week_end = week_start + timedelta(days=6, hours=20)  # Sunday 20:00
            
            # Get voting results if available
            # Get internal voting results if in voting phase
            voting_results = None
            if current_phase == "voting":
                current_week = self._get_current_week()
                all_voting_results = await self.config.guild(guild).voting_results()
                vote_counts = all_voting_results.get(current_week, {})
                if vote_counts:
                    total_votes = sum(vote_counts.values())
                    voting_results = {
                        "results": vote_counts,
                        "total_votes": total_votes
                    }
            
            status = {
                "competition": {
                    "phase": current_phase,
                    "theme": current_theme,
                    "week_cancelled": week_cancelled,
                    "team_count": team_count,
                    "week_start": week_start.isoformat(),
                    "week_end": week_end.isoformat(),
                    "voting_deadline": week_end.isoformat()
                },
                "voting": voting_results,
                "next_events": self._get_next_phase_time(),
                "guild_info": {
                    "name": guild.name,
                    "member_count": guild.member_count
                },
                "timestamp": datetime.utcnow().isoformat()
            }
            
            return web.json_response(status)
            
        except Exception as e:
            print(f"Error getting public status: {e}")
            return web.json_response({"error": "Failed to get status"}, status=500)
    
    async def _handle_ping(self, request):
        """Simple ping endpoint for testing"""
        return web.json_response({"status": "ok", "message": "CollabWarz API is running"})
    
    async def _handle_test(self, request):
        """Simple test endpoint without any validation"""
        return web.json_response({
            "status": "success",
            "message": "Test endpoint works"
        })
    
    async def _handle_simple_test(self, request):
        """Ultra-simple test endpoint to isolate middleware issues"""
        response = web.Response(text='{"simple": "test"}', content_type='application/json')
        response.headers['Access-Control-Allow-Origin'] = '*'
        return response
    
    async def _handle_public_submissions(self, request):
        """Get current week submissions for frontend users"""
        try:
            guild = None
            for g in self.bot.guilds:
                api_enabled = await self.config.guild(g).api_server_enabled()
                if api_enabled:
                    guild = g
                    break
            
            if not guild:
                return web.json_response({"error": "API not enabled"}, status=503)
            
            submissions = await self._get_submissions_safe(guild)
            current_theme = await self.config.guild(guild).current_theme()
            current_phase = await self.config.guild(guild).current_phase()
            
            # Enrich submissions with member data and voting info
            enriched_submissions = []
            for team_name, submission in submissions.items():
                members_info = []
                
                for member_id in submission.get('members', []):
                    member = guild.get_member(int(member_id))
                    if member:
                        members_info.append({
                            "id": str(member.id),
                            "username": member.name,
                            "display_name": member.display_name,
                            "avatar_url": str(member.display_avatar.url) if member.display_avatar else None
                        })
                
                # Get vote count from internal storage
                vote_count = None
                current_week = self._get_current_week()
                all_voting_results = await self.config.guild(guild).voting_results()
                weekly_votes = all_voting_results.get(current_week, {})
                vote_count = weekly_votes.get(team_name, 0)
                
                # Get Suno metadata if available
                suno_metadata = {}
                track_url = submission.get('track_url')
                song_info = None
                
                if track_url:
                    song_id = self._extract_suno_song_id(track_url)
                    if song_id:
                        suno_metadata = await self._fetch_suno_metadata(song_id, guild)
                        
                        # Create clean song object for frontend
                        if suno_metadata:
                            song_info = {
                                'title': suno_metadata.get('title', 'Unknown Title'),
                                'audio_url': suno_metadata.get('audio_url'),
                                'image_url': suno_metadata.get('image_url'),
                                'duration': suno_metadata.get('duration'),
                                'author_name': suno_metadata.get('author_name'),
                                'author_handle': suno_metadata.get('author_handle'),
                                'author_profile_url': f"https://suno.com/@{suno_metadata.get('author_handle')}" if suno_metadata.get('author_handle') else None,
                                'suno_url': track_url
                            }
                
                enriched_submission = {
                    "team_name": team_name,
                    "track_url": track_url,
                    "members": members_info,
                    "submitted_at": submission.get('submitted_at'),
                    "vote_count": vote_count,
                    "song": song_info,
                    "suno_metadata": suno_metadata  # Keep for backward compatibility
                }
                
                enriched_submissions.append(enriched_submission)
            
            # Sort by submission time
            enriched_submissions.sort(key=lambda x: x.get('submitted_at', ''), reverse=False)
            
            return web.json_response({
                "competition": {
                    "theme": current_theme,
                    "phase": current_phase,
                    "week": self._get_current_week()
                },
                "submissions": enriched_submissions,
                "count": len(enriched_submissions),
                "timestamp": datetime.utcnow().isoformat()
            })
            
        except Exception as e:
            print(f"Error getting public submissions: {e}")
            return web.json_response({"error": "Failed to get submissions"}, status=500)
    
    async def _handle_public_history(self, request):
        """Get competition history for frontend users with song details"""
        try:
            guild = None
            for g in self.bot.guilds:
                api_enabled = await self.config.guild(g).api_server_enabled()
                if api_enabled:
                    guild = g
                    break
            
            if not guild:
                return web.json_response({"error": "API not enabled"}, status=503)
            
            history = await self.config.guild(guild).competition_history()
            
            # Get pagination parameters
            page = int(request.query.get('page', 1))
            per_page = int(request.query.get('per_page', 10))
            
            # Sort by date (most recent first)
            sorted_history = sorted(history.items(), key=lambda x: x[1].get('end_date', ''), reverse=True)
            
            # Paginate
            start_idx = (page - 1) * per_page
            end_idx = start_idx + per_page
            paginated_history = sorted_history[start_idx:end_idx]
            
            # Enrich history with additional stats and song details
            enriched_history = {}
            for week_id, week_data in paginated_history:
                enriched_week = week_data.copy()
                
                # Add calculated stats
                if 'winner' in week_data and 'total_votes' in week_data:
                    enriched_week['participation_rate'] = week_data.get('total_teams', 0)
                    enriched_week['average_votes_per_team'] = (
                        week_data['total_votes'] / week_data['total_teams'] 
                        if week_data.get('total_teams', 0) > 0 else 0
                    )
                
                # Add song details from submissions
                if 'all_submissions' in week_data:
                    submissions_with_songs = []
                    for submission in week_data['all_submissions']:
                        submission_copy = submission.copy()
                        
                        # Extract song info from suno_metadata if available
                        if 'suno_metadata' in submission and submission['suno_metadata']:
                            metadata = submission['suno_metadata']
                            submission_copy['song'] = {
                                'title': metadata.get('title', 'Unknown Title'),
                                'audio_url': metadata.get('audio_url'),
                                'image_url': metadata.get('image_url'),
                                'duration': metadata.get('duration'),
                                'author_name': metadata.get('author_name'),
                                'suno_url': submission.get('track_url')
                            }
                        else:
                            # Fallback: just provide the URL
                            submission_copy['song'] = {
                                'title': submission.get('team_name', 'Unknown'),
                                'audio_url': None,
                                'image_url': None,
                                'duration': None,
                                'author_name': None,
                                'suno_url': submission.get('track_url')
                            }
                        
                        submissions_with_songs.append(submission_copy)
                    
                    enriched_week['all_submissions'] = submissions_with_songs
                
                # Add song info to winner as well
                if 'winner' in enriched_week and 'suno_metadata' in enriched_week['winner']:
                    metadata = enriched_week['winner']['suno_metadata']
                    enriched_week['winner']['song'] = {
                        'title': metadata.get('title', 'Unknown Title'),
                        'audio_url': metadata.get('audio_url'),
                        'image_url': metadata.get('image_url'),
                        'duration': metadata.get('duration'),
                        'author_name': metadata.get('author_name'),
                        'suno_url': enriched_week['winner'].get('track_url')
                    }
                
                enriched_history[week_id] = enriched_week
            
            return web.json_response({
                "history": enriched_history,
                "pagination": {
                    "page": page,
                    "per_page": per_page,
                    "total": len(sorted_history),
                    "pages": (len(sorted_history) + per_page - 1) // per_page
                },
                "timestamp": datetime.utcnow().isoformat()
            })
            
        except Exception as e:
            print(f"Error getting public history: {e}")
            return web.json_response({"error": "Failed to get history"}, status=500)
    
    async def _handle_public_voting(self, request):
        """Get current voting results for frontend users"""
        try:
            guild = None
            for g in self.bot.guilds:
                api_enabled = await self.config.guild(g).api_server_enabled()
                if api_enabled:
                    guild = g
                    break
            
            if not guild:
                return web.json_response({"error": "API not enabled"}, status=503)
            
            current_phase = await self.config.guild(guild).current_phase()
            
            # Only show voting results during voting phase or after
            if current_phase not in ['voting', 'ended']:
                return web.json_response({
                    "voting_available": False,
                    "phase": current_phase,
                    "message": "Voting results not available in current phase",
                    "timestamp": datetime.utcnow().isoformat()
                })
            
            # Get voting results from internal storage
            current_week = self._get_current_week()
            all_voting_results = await self.config.guild(guild).voting_results()
            vote_counts = all_voting_results.get(current_week, {})
            
            voting_results = None
            if vote_counts:
                total_votes = sum(vote_counts.values())
                voting_results = {
                    "results": vote_counts,
                    "total_votes": total_votes
                }
            
            if not voting_results:
                return web.json_response({
                    "voting_available": False,
                    "phase": current_phase,
                    "message": "Voting results not available yet",
                    "timestamp": datetime.utcnow().isoformat()
                })
            
            # Enrich with submission details
            submissions = await self._get_submissions_safe(guild)
            enriched_results = []
            
            for team_name, votes in voting_results.get('results', {}).items():
                submission = submissions.get(team_name, {})
                
                # Get member info
                members_info = []
                for member_id in submission.get('members', []):
                    member = guild.get_member(int(member_id))
                    if member:
                        members_info.append({
                            "id": str(member.id),
                            "username": member.name,
                            "display_name": member.display_name,
                            "avatar_url": str(member.display_avatar.url) if member.display_avatar else None
                        })
                
                # Get Suno metadata if available
                suno_metadata = {}
                track_url = submission.get('track_url')
                song_info = None
                
                if track_url:
                    song_id = self._extract_suno_song_id(track_url)
                    if song_id:
                        suno_metadata = await self._fetch_suno_metadata(song_id, guild)
                        
                        # Create clean song object for frontend
                        if suno_metadata:
                            song_info = {
                                'title': suno_metadata.get('title', 'Unknown Title'),
                                'audio_url': suno_metadata.get('audio_url'),
                                'image_url': suno_metadata.get('image_url'),
                                'duration': suno_metadata.get('duration'),
                                'author_name': suno_metadata.get('author_name'),
                                'author_handle': suno_metadata.get('author_handle'),
                                'author_profile_url': f"https://suno.com/@{suno_metadata.get('author_handle')}" if suno_metadata.get('author_handle') else None,
                                'suno_url': track_url
                            }
                
                enriched_results.append({
                    "team_name": team_name,
                    "votes": votes,
                    "track_url": track_url,
                    "members": members_info,
                    "submitted_at": submission.get('submitted_at'),
                    "song": song_info,
                    "suno_metadata": suno_metadata  # Keep for backward compatibility
                })
            
            # Sort by votes (descending)
            enriched_results.sort(key=lambda x: x['votes'], reverse=True)
            
            return web.json_response({
                "voting_available": True,
                "phase": current_phase,
                "results": enriched_results,
                "total_votes": voting_results.get('total_votes', 0),
                "voting_closed": voting_results.get('voting_closed', False),
                "week": self._get_current_week(),
                "timestamp": datetime.utcnow().isoformat()
            })
            
        except Exception as e:
            print(f"Error getting public voting: {e}")
            return web.json_response({"error": "Failed to get voting results"}, status=500)
    

    
    async def _handle_public_vote(self, request):
        """Handle vote submission from frontend users"""
        try:
            guild = None
            for g in self.bot.guilds:
                api_enabled = await self.config.guild(g).api_server_enabled()
                if api_enabled:
                    guild = g
                    break
            
            if not guild:
                return web.json_response({"error": "Guild not found"}, status=404)
            
            # Check if voting is active
            current_phase = await self.config.guild(guild).current_phase()
            if current_phase != "voting":
                return web.json_response({
                    "error": "Voting is not active",
                    "phase": current_phase,
                    "message": "Voting phase has not started or has ended"
                }, status=400)
            
            # Parse request data
            try:
                data = await request.json()
                team_name = data.get('team_name')
                voter_id = data.get('voter_id')  # Discord user ID or identifier
                
                if not team_name or not voter_id:
                    return web.json_response({
                        "error": "Missing required fields",
                        "required": ["team_name", "voter_id"]
                    }, status=400)
                    
            except Exception as e:
                return web.json_response({"error": "Invalid JSON data"}, status=400)
            
            # Validate team exists in current submissions
            submissions = await self._get_submissions_safe(guild)
            if team_name not in submissions:
                return web.json_response({
                    "error": "Team not found",
                    "message": f"Team '{team_name}' has no submission this week"
                }, status=404)
            
            # SIMPLE SECURITY: Validate Discord session token
            session_token = request.headers.get('Authorization', '').replace('Bearer ', '')
            if not session_token:
                return web.json_response({
                    "error": "Authentication required",
                    "message": "Discord session token required"
                }, status=401)
            
            # Validate voter is a member of the Discord guild
            try:
                voter_member = guild.get_member(int(voter_id))
                if not voter_member:
                    return web.json_response({
                        "error": "Unauthorized voter",
                        "message": "Voter must be a member of the Discord server"
                    }, status=403)
            except (ValueError, TypeError):
                return web.json_response({
                    "error": "Invalid voter ID",
                    "message": "Voter ID must be a valid Discord user ID"
                }, status=400)
            
            # TODO: Validate session_token with Discord OAuth API
            # For now, just check it exists (frontend should handle OAuth)
            
            # Check if user has already voted this week
            current_week = self._get_current_week()
            individual_votes = await self.config.guild(guild).individual_votes()
            
            if current_week in individual_votes and str(voter_id) in individual_votes[current_week]:
                previous_vote = individual_votes[current_week][str(voter_id)]
                return web.json_response({
                    "error": "Already voted", 
                    "message": f"You have already voted for '{previous_vote}' this week",
                    "previous_vote": previous_vote,
                    "week": current_week
                }, status=409)
            
            # Record individual vote tracking
            if current_week not in individual_votes:
                individual_votes[current_week] = {}
            individual_votes[current_week][str(voter_id)] = team_name
            
            # Record vote in team totals
            all_voting_results = await self.config.guild(guild).voting_results()
            
            # Initialize week data if not exists
            if current_week not in all_voting_results:
                all_voting_results[current_week] = {}
            
            # Initialize team vote count if not exists
            if team_name not in all_voting_results[current_week]:
                all_voting_results[current_week][team_name] = 0
            
            # Increment vote count
            all_voting_results[current_week][team_name] += 1
            
            # Save both individual votes and totals
            await self.config.guild(guild).individual_votes.set(individual_votes)
            await self.config.guild(guild).voting_results.set(all_voting_results)
            
            return web.json_response({
                "success": True,
                "message": f"Vote recorded for {team_name}",
                "team_name": team_name,
                "new_vote_count": all_voting_results[current_week][team_name],
                "week": current_week,
                "timestamp": datetime.utcnow().isoformat()
            })
            
        except Exception as e:
            print(f"Error recording vote: {e}")
            return web.json_response({"error": "Failed to record vote"}, status=500)
    
    async def _handle_public_leaderboard(self, request):
        """Get overall leaderboard and statistics for frontend users"""
        try:
            guild = None
            for g in self.bot.guilds:
                api_enabled = await self.config.guild(g).api_server_enabled()
                if api_enabled:
                    guild = g
                    break
            
            if not guild:
                return web.json_response({"error": "API not enabled"}, status=503)
            
            history = await self.config.guild(guild).competition_history()
            
            # Calculate member statistics
            member_stats = {}
            total_competitions = 0
            total_participants = set()
            
            for week_id, week_data in history.items():
                if 'winner' not in week_data:
                    continue
                    
                total_competitions += 1
                
                # Track winner stats
                winner = week_data['winner']
                if 'members' in winner:
                    for member_name in winner['members']:
                        if member_name not in member_stats:
                            member_stats[member_name] = {
                                'wins': 0,
                                'participations': 0,
                                'total_votes': 0,
                                'member_name': member_name,
                                'suno_handles': set(),  # Track all Suno handles used
                                'winning_songs': []  # Track winning songs with metadata
                            }
                        member_stats[member_name]['wins'] += 1
                        member_stats[member_name]['total_votes'] += winner.get('votes', 0)
                        total_participants.add(member_name)
                        
                        # Extract Suno handle from winner's metadata
                        if 'suno_metadata' in winner and winner['suno_metadata']:
                            handle = winner['suno_metadata'].get('author_handle')
                            if handle:
                                member_stats[member_name]['suno_handles'].add(handle)
                            
                            # Track winning song info
                            member_stats[member_name]['winning_songs'].append({
                                'week': week_id,
                                'title': winner['suno_metadata'].get('title'),
                                'suno_url': winner.get('track_url'),
                                'votes': winner.get('votes', 0)
                            })
                
                # Track all participants (from submissions if available)
                if 'all_submissions' in week_data:
                    for submission in week_data['all_submissions']:
                        if 'members' in submission:
                            for member_name in submission['members']:
                                total_participants.add(member_name)
                                if member_name not in member_stats:
                                    member_stats[member_name] = {
                                        'wins': 0,
                                        'participations': 0,
                                        'total_votes': 0,
                                        'member_name': member_name,
                                        'suno_handles': set(),
                                        'winning_songs': []
                                    }
                                member_stats[member_name]['participations'] += 1
                                
                                # Track Suno handle from any submission
                                if 'suno_metadata' in submission and submission['suno_metadata']:
                                    handle = submission['suno_metadata'].get('author_handle')
                                    if handle:
                                        member_stats[member_name]['suno_handles'].add(handle)
            
            # Calculate win rates and sort
            leaderboard = []
            for member_name, stats in member_stats.items():
                stats['win_rate'] = (stats['wins'] / stats['participations'] * 100) if stats['participations'] > 0 else 0
                stats['average_votes'] = (stats['total_votes'] / stats['wins']) if stats['wins'] > 0 else 0
                
                # Convert suno_handles set to list and get primary handle
                suno_handles_list = list(stats['suno_handles']) if stats['suno_handles'] else []
                primary_handle = suno_handles_list[0] if suno_handles_list else None
                
                # Try to get current Discord member info
                member_info = None
                for member in guild.members:
                    if member.display_name == member_name or member.name == member_name:
                        member_info = {
                            "id": str(member.id),
                            "username": member.name,
                            "display_name": member.display_name,
                            "avatar_url": str(member.display_avatar.url) if member.display_avatar else None
                        }
                        break
                
                stats['member_info'] = member_info
                stats['suno_handle'] = primary_handle
                stats['suno_profile_url'] = f"https://suno.com/@{primary_handle}" if primary_handle else None
                stats['all_suno_handles'] = suno_handles_list  # In case they use multiple
                
                # Remove the set object before JSON serialization
                del stats['suno_handles']
                
                leaderboard.append(stats)
            
            # Sort by wins, then by win rate
            leaderboard.sort(key=lambda x: (x['wins'], x['win_rate']), reverse=True)
            
            # Get recent activity (last 5 competitions)
            recent_competitions = sorted(history.items(), key=lambda x: x[1].get('end_date', ''), reverse=True)[:5]
            
            return web.json_response({
                "leaderboard": leaderboard[:50],  # Top 50
                "statistics": {
                    "total_competitions": total_competitions,
                    "total_participants": len(total_participants),
                    "average_teams_per_week": sum(w.get('total_teams', 0) for w in history.values()) / len(history) if history else 0,
                    "average_votes_per_week": sum(w.get('total_votes', 0) for w in history.values()) / len(history) if history else 0
                },
                "recent_competitions": dict(recent_competitions),
                "timestamp": datetime.utcnow().isoformat()
            })
            
        except Exception as e:
            print(f"Error getting public leaderboard: {e}")
            return web.json_response({"error": "Failed to get leaderboard"}, status=500)
    
    # ========== COMPREHENSIVE DATA API ENDPOINTS ==========
    
    async def _handle_public_artists(self, request):
        """Get all artists with basic info"""
        try:
            guild = await self._get_api_guild()
            if not guild:
                return web.json_response({"error": "API not enabled"}, status=503)
            
            artists_db = await self.config.guild(guild).artists_db()
            
            # Format artists for public API
            artists_list = []
            for user_id, artist_data in artists_db.items():
                # Get current Discord member info
                member = guild.get_member(int(user_id))
                
                artist_info = {
                    "user_id": user_id,
                    "name": artist_data["name"],
                    "discord_rank": artist_data["discord_rank"],
                    "suno_profile": artist_data["suno_profile"],
                    "stats": {
                        "participations": artist_data["stats"]["participations"],
                        "victories": artist_data["stats"]["victories"],
                        "petals": artist_data["stats"]["petals"],
                        "win_rate": (artist_data["stats"]["victories"] / artist_data["stats"]["participations"] * 100) if artist_data["stats"]["participations"] > 0 else 0
                    },
                    "member_info": {
                        "username": member.name if member else None,
                        "display_name": member.display_name if member else artist_data["name"],
                        "avatar_url": str(member.display_avatar.url) if member and member.display_avatar else None,
                        "is_online": member.status.name if member else "offline"
                    } if member else None
                }
                artists_list.append(artist_info)
            
            # Sort by victories, then participations
            artists_list.sort(key=lambda x: (x["stats"]["victories"], x["stats"]["participations"]), reverse=True)
            
            return web.json_response({
                "artists": artists_list,
                "total_count": len(artists_list),
                "timestamp": datetime.utcnow().isoformat()
            })
            
        except Exception as e:
            print(f"Error getting artists: {e}")
            return web.json_response({"error": "Failed to get artists"}, status=500)
    
    async def _handle_public_artist_detail(self, request):
        """Get detailed info for specific artist"""
        try:
            guild = await self._get_api_guild()
            if not guild:
                return web.json_response({"error": "API not enabled"}, status=503)
            
            user_id = request.match_info['user_id']
            artists_db = await self.config.guild(guild).artists_db()
            teams_db = await self.config.guild(guild).teams_db()
            songs_db = await self.config.guild(guild).songs_db()
            
            if user_id not in artists_db:
                return web.json_response({"error": "Artist not found"}, status=404)
            
            artist_data = artists_db[user_id]
            member = guild.get_member(int(user_id))
            
            # Get detailed team history with song info
            detailed_team_history = []
            for team_entry in artist_data["team_history"]:
                team_id = team_entry["team_id"]
                if str(team_id) in teams_db:
                    team_data = teams_db[str(team_id)]
                    
                    # Get songs for this week
                    week_songs = []
                    week_key = team_entry["week_key"]
                    if week_key in team_data["songs_by_week"]:
                        for song_id in team_data["songs_by_week"][week_key]:
                            if str(song_id) in songs_db:
                                song_data = songs_db[str(song_id)]
                                week_songs.append({
                                    "id": song_id,
                                    "title": song_data["title"],
                                    "suno_url": song_data["suno_url"],
                                    "votes": song_data["vote_stats"]["total_votes"]
                                })
                    
                    detailed_team_history.append({
                        "team_id": team_id,
                        "team_name": team_entry["team_name"],
                        "week_key": week_key,
                        "won": team_entry["won"],
                        "songs": week_songs,
                        "teammates": [aid for aid in team_data["members"] if aid != user_id]
                    })
            
            # Get song history with details
            detailed_song_history = []
            for song_id in artist_data["song_history"]:
                if str(song_id) in songs_db:
                    song_data = songs_db[str(song_id)]
                    detailed_song_history.append({
                        "id": song_id,
                        "title": song_data["title"],
                        "suno_url": song_data["suno_url"],
                        "week_key": song_data["week_key"],
                        "team_id": song_data["team_id"],
                        "votes": song_data["vote_stats"]["total_votes"],
                        "won_week": song_data["vote_stats"]["won_week"]
                    })
            
            return web.json_response({
                "artist": {
                    "user_id": user_id,
                    "name": artist_data["name"],
                    "discord_rank": artist_data["discord_rank"],
                    "suno_profile": artist_data["suno_profile"],
                    "stats": artist_data["stats"],
                    "team_history": detailed_team_history,
                    "song_history": detailed_song_history,
                    "member_info": {
                        "username": member.name if member else None,
                        "display_name": member.display_name if member else artist_data["name"],
                        "avatar_url": str(member.display_avatar.url) if member and member.display_avatar else None,
                        "is_online": member.status.name if member else "offline"
                    } if member else None
                },
                "timestamp": datetime.utcnow().isoformat()
            })
            
        except Exception as e:
            print(f"Error getting artist detail: {e}")
            return web.json_response({"error": "Failed to get artist detail"}, status=500)
    
    async def _handle_public_teams(self, request):
        """Get all teams with basic info"""
        try:
            guild = await self._get_api_guild()
            if not guild:
                return web.json_response({"error": "API not enabled"}, status=503)
            
            teams_db = await self.config.guild(guild).teams_db()
            artists_db = await self.config.guild(guild).artists_db()
            
            teams_list = []
            for team_id, team_data in teams_db.items():
                # Get member names
                member_names = []
                for member_id in team_data["members"]:
                    if member_id in artists_db:
                        member_names.append(artists_db[member_id]["name"])
                    else:
                        member = guild.get_member(int(member_id))
                        member_names.append(member.display_name if member else f"User-{member_id}")
                
                teams_list.append({
                    "id": int(team_id),
                    "name": team_data["name"],
                    "members": team_data["members"],
                    "member_names": member_names,
                    "stats": team_data["stats"],
                    "total_songs": sum(len(songs) for songs in team_data["songs_by_week"].values())
                })
            
            # Sort by victories, then participations
            teams_list.sort(key=lambda x: (x["stats"]["victories"], x["stats"]["participations"]), reverse=True)
            
            return web.json_response({
                "teams": teams_list,
                "total_count": len(teams_list),
                "timestamp": datetime.utcnow().isoformat()
            })
            
        except Exception as e:
            print(f"Error getting teams: {e}")
            return web.json_response({"error": "Failed to get teams"}, status=500)
    
    async def _handle_public_team_detail(self, request):
        """Get detailed info for specific team"""
        try:
            guild = await self._get_api_guild()
            if not guild:
                return web.json_response({"error": "API not enabled"}, status=503)
            
            team_id = request.match_info['team_id']
            teams_db = await self.config.guild(guild).teams_db()
            songs_db = await self.config.guild(guild).songs_db()
            artists_db = await self.config.guild(guild).artists_db()
            
            if team_id not in teams_db:
                return web.json_response({"error": "Team not found"}, status=404)
            
            team_data = teams_db[team_id]
            
            # Get detailed member info
            detailed_members = []
            for member_id in team_data["members"]:
                member = guild.get_member(int(member_id))
                artist_data = artists_db.get(member_id, {})
                
                detailed_members.append({
                    "user_id": member_id,
                    "name": artist_data.get("name", member.display_name if member else f"User-{member_id}"),
                    "discord_rank": artist_data.get("discord_rank", "Seed"),
                    "suno_profile": artist_data.get("suno_profile"),
                    "member_info": {
                        "username": member.name if member else None,
                        "display_name": member.display_name if member else None,
                        "avatar_url": str(member.display_avatar.url) if member and member.display_avatar else None
                    } if member else None
                })
            
            # Get songs by week with details
            songs_by_week = {}
            for week_key, song_ids in team_data["songs_by_week"].items():
                week_songs = []
                for song_id in song_ids:
                    if str(song_id) in songs_db:
                        song_data = songs_db[str(song_id)]
                        week_songs.append({
                            "id": song_id,
                            "title": song_data["title"],
                            "suno_url": song_data["suno_url"],
                            "submission_date": song_data["submission_date"],
                            "votes": song_data["vote_stats"]["total_votes"],
                            "won_week": song_data["vote_stats"]["won_week"]
                        })
                songs_by_week[week_key] = week_songs
            
            return web.json_response({
                "team": {
                    "id": int(team_id),
                    "name": team_data["name"],
                    "members": detailed_members,
                    "stats": team_data["stats"],
                    "songs_by_week": songs_by_week
                },
                "timestamp": datetime.utcnow().isoformat()
            })
            
        except Exception as e:
            print(f"Error getting team detail: {e}")
            return web.json_response({"error": "Failed to get team detail"}, status=500)
    
    async def _handle_public_songs(self, request):
        """Get all songs with basic info"""
        try:
            guild = await self._get_api_guild()
            if not guild:
                return web.json_response({"error": "API not enabled"}, status=503)
            
            songs_db = await self.config.guild(guild).songs_db()
            teams_db = await self.config.guild(guild).teams_db()
            artists_db = await self.config.guild(guild).artists_db()
            
            songs_list = []
            for song_id, song_data in songs_db.items():
                # Get team name
                team_name = "Unknown Team"
                if str(song_data["team_id"]) in teams_db:
                    team_name = teams_db[str(song_data["team_id"])]["name"]
                
                # Get artist names
                artist_names = []
                for artist_id in song_data["artists"]:
                    if artist_id in artists_db:
                        artist_names.append(artists_db[artist_id]["name"])
                    else:
                        member = guild.get_member(int(artist_id))
                        artist_names.append(member.display_name if member else f"User-{artist_id}")
                
                songs_list.append({
                    "id": int(song_id),
                    "title": song_data["title"],
                    "suno_url": song_data["suno_url"],
                    "team_id": song_data["team_id"],
                    "team_name": team_name,
                    "artists": song_data["artists"],
                    "artist_names": artist_names,
                    "week_key": song_data["week_key"],
                    "submission_date": song_data["submission_date"],
                    "votes": song_data["vote_stats"]["total_votes"],
                    "won_week": song_data["vote_stats"]["won_week"]
                })
            
            # Sort by submission date (newest first)
            songs_list.sort(key=lambda x: x["submission_date"], reverse=True)
            
            return web.json_response({
                "songs": songs_list,
                "total_count": len(songs_list),
                "timestamp": datetime.utcnow().isoformat()
            })
            
        except Exception as e:
            print(f"Error getting songs: {e}")
            return web.json_response({"error": "Failed to get songs"}, status=500)
    
    async def _handle_public_song_detail(self, request):
        """Get detailed info for specific song"""
        try:
            guild = await self._get_api_guild()
            if not guild:
                return web.json_response({"error": "API not enabled"}, status=503)
            
            song_id = request.match_info['song_id']
            songs_db = await self.config.guild(guild).songs_db()
            teams_db = await self.config.guild(guild).teams_db()
            artists_db = await self.config.guild(guild).artists_db()
            
            if song_id not in songs_db:
                return web.json_response({"error": "Song not found"}, status=404)
            
            song_data = songs_db[song_id]
            
            # Get detailed team info
            team_info = None
            if str(song_data["team_id"]) in teams_db:
                team_data = teams_db[str(song_data["team_id"])]
                team_info = {
                    "id": song_data["team_id"],
                    "name": team_data["name"],
                    "stats": team_data["stats"]
                }
            
            # Get detailed artist info
            detailed_artists = []
            for artist_id in song_data["artists"]:
                member = guild.get_member(int(artist_id))
                artist_data = artists_db.get(artist_id, {})
                
                detailed_artists.append({
                    "user_id": artist_id,
                    "name": artist_data.get("name", member.display_name if member else f"User-{artist_id}"),
                    "discord_rank": artist_data.get("discord_rank", "Seed"),
                    "suno_profile": artist_data.get("suno_profile"),
                    "member_info": {
                        "username": member.name if member else None,
                        "display_name": member.display_name if member else None,
                        "avatar_url": str(member.display_avatar.url) if member and member.display_avatar else None
                    } if member else None
                })
            
            return web.json_response({
                "song": {
                    "id": int(song_id),
                    "title": song_data["title"],
                    "suno_url": song_data["suno_url"],
                    "suno_song_id": song_data["suno_song_id"],
                    "team": team_info,
                    "artists": detailed_artists,
                    "week_key": song_data["week_key"],
                    "submission_date": song_data["submission_date"],
                    "suno_metadata": song_data["suno_metadata"],
                    "vote_stats": song_data["vote_stats"]
                },
                "timestamp": datetime.utcnow().isoformat()
            })
            
        except Exception as e:
            print(f"Error getting song detail: {e}")
            return web.json_response({"error": "Failed to get song detail"}, status=500)
    
    async def _handle_public_weeks(self, request):
        """Get all competition weeks with basic info"""
        try:
            guild = await self._get_api_guild()
            if not guild:
                return web.json_response({"error": "API not enabled"}, status=503)
            
            weeks_db = await self.config.guild(guild).weeks_db()
            
            weeks_list = []
            for week_key, week_data in weeks_db.items():
                weeks_list.append({
                    "week_key": week_key,
                    "theme": week_data["theme"],
                    "status": week_data["status"],
                    "start_date": week_data["start_date"],
                    "completion_date": week_data.get("completion_date"),
                    "total_teams": len(week_data["teams"]),
                    "total_songs": len(week_data["songs"]),
                    "total_participants": len(week_data["participants"]),
                    "total_votes": week_data["total_votes"],
                    "winner_team_id": week_data.get("winner_team_id"),
                    "winner_song_id": week_data.get("winner_song_id")
                })
            
            # Sort by start date (newest first)
            weeks_list.sort(key=lambda x: x["start_date"], reverse=True)
            
            return web.json_response({
                "weeks": weeks_list,
                "total_count": len(weeks_list),
                "timestamp": datetime.utcnow().isoformat()
            })
            
        except Exception as e:
            print(f"Error getting weeks: {e}")
            return web.json_response({"error": "Failed to get weeks"}, status=500)
    
    async def _handle_public_week_detail(self, request):
        """Get detailed info for specific week"""
        try:
            guild = await self._get_api_guild()
            if not guild:
                return web.json_response({"error": "API not enabled"}, status=503)
            
            week_key = request.match_info['week_key']
            weeks_db = await self.config.guild(guild).weeks_db()
            teams_db = await self.config.guild(guild).teams_db()
            songs_db = await self.config.guild(guild).songs_db()
            artists_db = await self.config.guild(guild).artists_db()
            
            if week_key not in weeks_db:
                return web.json_response({"error": "Week not found"}, status=404)
            
            week_data = weeks_db[week_key]
            
            # Get detailed team info
            detailed_teams = []
            for team_id in week_data["teams"]:
                if str(team_id) in teams_db:
                    team_data = teams_db[str(team_id)]
                    
                    # Get member names
                    member_names = []
                    for member_id in team_data["members"]:
                        if member_id in artists_db:
                            member_names.append(artists_db[member_id]["name"])
                        else:
                            member = guild.get_member(int(member_id))
                            member_names.append(member.display_name if member else f"User-{member_id}")
                    
                    detailed_teams.append({
                        "id": team_id,
                        "name": team_data["name"],
                        "members": team_data["members"],
                        "member_names": member_names,
                        "is_winner": team_id == week_data.get("winner_team_id")
                    })
            
            # Get detailed song info
            detailed_songs = []
            for song_id in week_data["songs"]:
                if str(song_id) in songs_db:
                    song_data = songs_db[str(song_id)]
                    
                    # Get artist names
                    artist_names = []
                    for artist_id in song_data["artists"]:
                        if artist_id in artists_db:
                            artist_names.append(artists_db[artist_id]["name"])
                        else:
                            member = guild.get_member(int(artist_id))
                            artist_names.append(member.display_name if member else f"User-{artist_id}")
                    
                    detailed_songs.append({
                        "id": song_id,
                        "title": song_data["title"],
                        "suno_url": song_data["suno_url"],
                        "team_id": song_data["team_id"],
                        "artists": song_data["artists"],
                        "artist_names": artist_names,
                        "votes": song_data["vote_stats"]["total_votes"],
                        "is_winner": song_id == week_data.get("winner_song_id")
                    })
            
            # Sort songs by votes (descending)
            detailed_songs.sort(key=lambda x: x["votes"], reverse=True)
            
            return web.json_response({
                "week": {
                    "week_key": week_key,
                    "theme": week_data["theme"],
                    "status": week_data["status"],
                    "start_date": week_data["start_date"],
                    "completion_date": week_data.get("completion_date"),
                    "teams": detailed_teams,
                    "songs": detailed_songs,
                    "participants": week_data["participants"],
                    "total_votes": week_data["total_votes"],
                    "vote_breakdown": week_data["vote_breakdown"],
                    "winner_team_id": week_data.get("winner_team_id"),
                    "winner_song_id": week_data.get("winner_song_id")
                },
                "timestamp": datetime.utcnow().isoformat()
            })
            
        except Exception as e:
            print(f"Error getting week detail: {e}")
            return web.json_response({"error": "Failed to get week detail"}, status=500)
    
    async def _handle_public_artist_stats(self, request):
        """Get comprehensive statistics for specific artist"""
        try:
            guild = await self._get_api_guild()
            if not guild:
                return web.json_response({"error": "API not enabled"}, status=503)
            
            user_id = request.match_info['user_id']
            artists_db = await self.config.guild(guild).artists_db()
            
            if user_id not in artists_db:
                return web.json_response({"error": "Artist not found"}, status=404)
            
            artist_data = artists_db[user_id]
            
            # Calculate advanced statistics
            win_rate = (artist_data["stats"]["victories"] / artist_data["stats"]["participations"] * 100) if artist_data["stats"]["participations"] > 0 else 0
            
            # Analyze team history for patterns
            teammates_frequency = {}
            victories_by_teammate = {}
            
            for team_entry in artist_data["team_history"]:
                teammate_ids = [tid for tid in team_entry.get("teammates", []) if tid != user_id]
                
                for teammate_id in teammate_ids:
                    teammates_frequency[teammate_id] = teammates_frequency.get(teammate_id, 0) + 1
                    if team_entry["won"]:
                        victories_by_teammate[teammate_id] = victories_by_teammate.get(teammate_id, 0) + 1
            
            # Get teammate details
            frequent_teammates = []
            for teammate_id, frequency in sorted(teammates_frequency.items(), key=lambda x: x[1], reverse=True)[:5]:
                teammate_data = artists_db.get(teammate_id, {})
                member = guild.get_member(int(teammate_id))
                
                frequent_teammates.append({
                    "user_id": teammate_id,
                    "name": teammate_data.get("name", member.display_name if member else f"User-{teammate_id}"),
                    "collaborations": frequency,
                    "joint_victories": victories_by_teammate.get(teammate_id, 0),
                    "joint_win_rate": (victories_by_teammate.get(teammate_id, 0) / frequency * 100) if frequency > 0 else 0
                })
            
            return web.json_response({
                "artist_stats": {
                    "user_id": user_id,
                    "name": artist_data["name"],
                    "basic_stats": artist_data["stats"],
                    "advanced_stats": {
                        "win_rate": win_rate,
                        "total_songs": len(artist_data["song_history"]),
                        "total_teams": len(artist_data["team_history"]),
                        "unique_teammates": len(teammates_frequency),
                        "average_votes_per_song": 0  # Would calculate from song vote data
                    },
                    "frequent_teammates": frequent_teammates
                },
                "timestamp": datetime.utcnow().isoformat()
            })
            
        except Exception as e:
            print(f"Error getting artist stats: {e}")
            return web.json_response({"error": "Failed to get artist stats"}, status=500)
    
    async def _handle_public_stats_leaderboard(self, request):
        """Get comprehensive statistics and leaderboards"""
        try:
            guild = await self._get_api_guild()
            if not guild:
                return web.json_response({"error": "API not enabled"}, status=503)
            
            artists_db = await self.config.guild(guild).artists_db()
            teams_db = await self.config.guild(guild).teams_db()
            songs_db = await self.config.guild(guild).songs_db()
            weeks_db = await self.config.guild(guild).weeks_db()
            
            # Artist leaderboards
            artists_by_wins = sorted(
                [(uid, data) for uid, data in artists_db.items()], 
                key=lambda x: x[1]["stats"]["victories"], 
                reverse=True
            )[:10]
            
            artists_by_participations = sorted(
                [(uid, data) for uid, data in artists_db.items()], 
                key=lambda x: x[1]["stats"]["participations"], 
                reverse=True
            )[:10]
            
            artists_by_petals = sorted(
                [(uid, data) for uid, data in artists_db.items()], 
                key=lambda x: x[1]["stats"]["petals"], 
                reverse=True
            )[:10]
            
            # Team leaderboards
            teams_by_wins = sorted(
                [(tid, data) for tid, data in teams_db.items()], 
                key=lambda x: x[1]["stats"]["victories"], 
                reverse=True
            )[:10]
            
            # Format leaderboards
            def format_artist_entry(user_id, artist_data):
                member = guild.get_member(int(user_id))
                return {
                    "user_id": user_id,
                    "name": artist_data["name"],
                    "stats": artist_data["stats"],
                    "member_info": {
                        "display_name": member.display_name if member else artist_data["name"],
                        "avatar_url": str(member.display_avatar.url) if member and member.display_avatar else None
                    } if member else None
                }
            
            def format_team_entry(team_id, team_data):
                return {
                    "id": int(team_id),
                    "name": team_data["name"],
                    "stats": team_data["stats"],
                    "member_count": len(team_data["members"])
                }
            
            # Calculate overall statistics
            total_artists = len(artists_db)
            total_teams = len(teams_db)
            total_songs = len(songs_db)
            total_weeks = len(weeks_db)
            
            completed_weeks = sum(1 for w in weeks_db.values() if w["status"] == "completed")
            total_votes = sum(w["total_votes"] for w in weeks_db.values())
            
            return web.json_response({
                "leaderboards": {
                    "artists_by_wins": [format_artist_entry(uid, data) for uid, data in artists_by_wins],
                    "artists_by_participations": [format_artist_entry(uid, data) for uid, data in artists_by_participations],
                    "artists_by_petals": [format_artist_entry(uid, data) for uid, data in artists_by_petals],
                    "teams_by_wins": [format_team_entry(tid, data) for tid, data in teams_by_wins]
                },
                "overall_stats": {
                    "total_artists": total_artists,
                    "total_teams": total_teams,
                    "total_songs": total_songs,
                    "total_weeks": total_weeks,
                    "completed_weeks": completed_weeks,
                    "total_votes": total_votes,
                    "average_votes_per_week": total_votes / completed_weeks if completed_weeks > 0 else 0
                },
                "timestamp": datetime.utcnow().isoformat()
            })
            
        except Exception as e:
            print(f"Error getting stats leaderboard: {e}")
            return web.json_response({"error": "Failed to get stats leaderboard"}, status=500)
    
    async def _get_api_guild(self):
        """Helper to get the guild with API enabled"""
        for guild in self.bot.guilds:
            api_enabled = await self.config.guild(guild).api_server_enabled()
            if api_enabled:
                return guild
        return None
    
    async def _handle_public_user_membership(self, request):
        """Check if a user is a member of the Discord server"""
        try:
            guild = await self._get_api_guild()
            if not guild:
                return web.json_response({"error": "API not enabled"}, status=503)
            
            user_id = request.match_info['user_id']
            
            # Validate user_id is numeric
            try:
                user_id_int = int(user_id)
            except ValueError:
                return web.json_response({"error": "Invalid user ID format"}, status=400)
            
            # Check if user is a member of the guild
            member = guild.get_member(user_id_int)
            is_member = member is not None
            
            response_data = {
                "user_id": user_id,
                "is_member": is_member,
                "timestamp": datetime.utcnow().isoformat()
            }
            
            # If they are a member, include basic member info
            if is_member:
                response_data["member_info"] = {
                    "username": member.name,
                    "display_name": member.display_name,
                    "avatar_url": str(member.display_avatar.url) if member.display_avatar else None,
                    "joined_at": member.joined_at.isoformat() if member.joined_at else None,
                    "status": member.status.name,
                    "roles": [role.name for role in member.roles if role.name != "@everyone"]
                }
                
                # Check if they're in the artists database
                artists_db = await self.config.guild(guild).artists_db()
                if user_id in artists_db:
                    artist_data = artists_db[user_id]
                    response_data["collab_warz_profile"] = {
                        "name": artist_data["name"],
                        "discord_rank": artist_data["discord_rank"],
                        "suno_profile": artist_data["suno_profile"],
                        "stats": artist_data["stats"]
                    }
            else:
                # Not a member - check if we have historical data
                artists_db = await self.config.guild(guild).artists_db()
                if user_id in artists_db:
                    response_data["historical_participant"] = True
                    response_data["note"] = "User has participated in Collab Warz but is no longer in the server"
                else:
                    response_data["historical_participant"] = False
            
            return web.json_response(response_data)
            
        except Exception as e:
            print(f"Error checking user membership: {e}")
            return web.json_response({"error": "Failed to check user membership"}, status=500)
    
    # ========== END COMPREHENSIVE DATA API ENDPOINTS ==========
    
    async def _start_api_server_task(self, guild):
        """Start the API server as a background task"""
        try:
            api_enabled = await self.config.guild(guild).api_server_enabled()
            if not api_enabled:
                return
            
            # Clean up any existing server instances for this guild
            if hasattr(self, '_api_servers') and guild.id in self._api_servers:
                try:
                    old_runner = self._api_servers[guild.id]
                    await old_runner.cleanup()
                    print(f"Cleaned up old API server for {guild.name}")
                except Exception as e:
                    print(f"Error cleaning up old server: {e}")
                finally:
                    del self._api_servers[guild.id]
            
            port = await self.config.guild(guild).api_server_port()
            host = await self.config.guild(guild).api_server_host()
            
            # Force port 8080 for Railway deployment
            import os
            
            # Check for Railway environment variables
            railway_detected = (
                'RAILWAY_ENVIRONMENT_ID' in os.environ or 
                'RAILWAY_SERVICE_ID' in os.environ or
                'RAILWAY_PROJECT_ID' in os.environ or
                'up.railway.app' in str(os.environ.get('HOSTNAME', ''))
            )
            
            if railway_detected:
                # Use a completely different port range to avoid all conflicts
                port = 5000  # Use port 5000 - typically free
                print(f"Railway environment detected, using dedicated API port: {port}")
                print(f"Bypassing all Railway port conflicts")
                print(f"Service ID: {os.environ.get('RAILWAY_SERVICE_ID')}")
            else:
                print(f"Local environment, using configured port: {port}")
                print(f"HOSTNAME: {os.environ.get('HOSTNAME')}")
            
            app = self._start_api_server(guild)
            if not app:
                return
            
            runner = web.AppRunner(app)
            await runner.setup()
            
            # Track this server for cleanup
            if not hasattr(self, '_api_servers'):
                self._api_servers = {}
            self._api_servers[guild.id] = runner
            
            # Try to start on the assigned port
            try:
                site = web.TCPSite(runner, host, port)
                await site.start()
                print(f"API server started for {guild.name} on {host}:{port}")
            except OSError as e:
                if "Address already in use" in str(e):
                    print(f"Port {port} busy, trying alternative port...")
                    # Try alternative port
                    alt_port = port + 1000
                    site = web.TCPSite(runner, host, alt_port)
                    await site.start()
                    print(f"API server started for {guild.name} on {host}:{alt_port} (alternative)")
                else:
                    raise e
            
            # Keep the server running
            while api_enabled:
                await asyncio.sleep(60)  # Check every minute
                api_enabled = await self.config.guild(guild).api_server_enabled()
            
            await runner.cleanup()
            print(f"API server stopped for {guild.name}")
            
        except Exception as e:
            print(f"Error in API server task for {guild.name}: {e}")
    
    async def _validate_and_process_submission(self, message) -> dict:
        """
        Validate Discord submission and return structured result
        
        Returns:
            dict: {
                "success": bool,
                "team_name": str (if success),
                "partner_mention": str (if success),
                "errors": list[str] (if not success)
            }
        """
        try:
            guild = message.guild
            
            # Check for forbidden platforms first
            forbidden_platforms = ['soundcloud', 'youtube', 'bandcamp', 'spotify', 'drive.google']
            has_forbidden_platform = any(platform in message.content.lower() for platform in forbidden_platforms)
            
            if has_forbidden_platform:
                return {
                    "success": False,
                    "errors": [
                        "**Only Suno.com URLs are accepted**",
                        "Forbidden platforms: SoundCloud, YouTube, Bandcamp, Spotify, Google Drive",
                        "**Valid submissions:**",
                        "• Valid Suno.com URLs only: `https://suno.com/s/...` or `https://suno.com/song/...`"
                    ]
                }
            
            # Check for Suno URLs and validate them
            suno_urls = self._extract_suno_urls_from_text(message.content)
            has_suno_reference = 'suno.com' in message.content.lower()
            has_attachment = len(message.attachments) > 0
            
            # Reject file attachments - only Suno URLs are allowed
            if has_attachment:
                return {
                    "success": False,
                    "errors": [
                        "**File attachments are not accepted**",
                        "Valid submissions must be Suno.com URLs only:",
                        "• `https://suno.com/s/kFacPCnBlw9n9oEP`",
                        "• `https://suno.com/song/3b172539-fc21-4f37-937c-a641ed52da26`",
                        "Please create your collaboration on Suno.com and share the link."
                    ]
                }
            
            if has_suno_reference and not suno_urls:
                return {
                    "success": False,
                    "errors": [
                        "**Invalid Suno.com URL format**",
                        "Valid Suno URL formats:",
                        "• `https://suno.com/s/kFacPCnBlw9n9oEP`",
                        "• `https://suno.com/song/3b172539-fc21-4f37-937c-a641ed52da26`"
                    ]
                }
            
            # Must have valid Suno URL
            if not suno_urls:
                return {
                    "success": False,
                    "errors": [
                        "**No valid submission content**",
                        "Please include a valid Suno.com URL:",
                        "• `https://suno.com/s/kFacPCnBlw9n9oEP`",
                        "• `https://suno.com/song/3b172539-fc21-4f37-937c-a641ed52da26`"
                    ]
                }
            
            # Extract team info from message
            team_info = self._extract_team_info_from_message(
                message.content, message.mentions, guild, message.author.id
            )
            
            if team_info["errors"]:
                return {
                    "success": False,
                    "errors": team_info["errors"]
                }
            
            # Check if team can submit
            team_check = await self._is_team_already_submitted(
                guild, 
                team_info["team_name"], 
                message.author.id, 
                team_info["partner_id"]
            )
            
            if not team_check["can_submit"]:
                return {
                    "success": False,
                    "errors": team_check["errors"]
                }
            
            # Register successful submission
            await self._register_team_submission(
                guild, 
                team_info["team_name"], 
                message.author.id, 
                team_info["partner_id"]
            )
            
            # ===== COMPREHENSIVE DATA TRACKING =====
            week_key = await self._get_competition_week_key(guild)
            
            # Ensure artists exist in database
            await self._get_or_create_artist(guild, message.author.id, message.author.display_name)
            await self._get_or_create_artist(guild, team_info["partner_id"])
            
            # Create or get team in normalized database
            team_id = await self._get_or_create_team(
                guild, 
                team_info["team_name"], 
                [message.author.id, team_info["partner_id"]], 
                week_key
            )
            
            # Record song submission
            song_id = await self._record_song_submission(
                guild, 
                team_id, 
                week_key, 
                suno_urls[0],  # Use first Suno URL
                None  # Title will be extracted later if needed
            )
            
            # Update week data to include this team and song
            weeks_db = await self.config.guild(guild).weeks_db()
            if week_key in weeks_db:
                if team_id not in weeks_db[week_key]["teams"]:
                    weeks_db[week_key]["teams"].append(team_id)
                if song_id not in weeks_db[week_key]["songs"]:
                    weeks_db[week_key]["songs"].append(song_id)
                if message.author.id not in weeks_db[week_key]["participants"]:
                    weeks_db[week_key]["participants"].append(message.author.id)
                if team_info["partner_id"] not in weeks_db[week_key]["participants"]:
                    weeks_db[week_key]["participants"].append(team_info["partner_id"])
                await self.config.guild(guild).weeks_db.set(weeks_db)
            # ===== END DATA TRACKING =====
            
            # Get partner mention for response
            partner = guild.get_member(team_info["partner_id"])
            partner_mention = partner.mention if partner else "your partner"
            
            return {
                "success": True,
                "team_name": team_info["team_name"],
                "partner_mention": partner_mention,
                "errors": []
            }
            
        except Exception as e:
            print(f"Error validating Discord submission in {guild.name}: {e}")
            return {
                "success": False,
                "errors": [f"Internal error: {str(e)}"]
            }
    
    async def _validate_discord_submission(self, message):
        """Validate and process Discord submission"""
        try:
            guild = message.guild
            if not guild:
                return
            
            # Check if validation is enabled
            validate_enabled = await self.config.guild(guild).validate_discord_submissions()
            if not validate_enabled:
                return
            
            # Check if this is the submission channel
            submission_channel_id = await self.config.guild(guild).submission_channel()
            if not submission_channel_id or message.channel.id != submission_channel_id:
                return
            
            # Check if message has attachment or valid Suno URL (potential submission)
            has_attachment = len(message.attachments) > 0
            
            # Check for other music platforms (now forbidden)
            forbidden_platforms = ['soundcloud', 'youtube', 'bandcamp', 'spotify', 'drive.google']
            has_forbidden_platform = any(platform in message.content.lower() for platform in forbidden_platforms)
            
            # Check for Suno URLs
            suno_urls = self._extract_suno_urls_from_text(message.content)
            has_valid_suno = len(suno_urls) > 0
            has_suno_reference = 'suno.com' in message.content.lower()
            
            # Reject if forbidden platforms are used
            if has_forbidden_platform:
                error_msg = (
                    "❌ **Only Suno.com URLs are accepted**\n\n"
                    "**Forbidden platforms**: SoundCloud, YouTube, Bandcamp, Spotify, Google Drive\n"
                    "**Valid submissions**:\n"
                    "• Valid Suno.com URLs only:\n"
                    "  - `https://suno.com/s/kFacPCnBlw9n9oEP`\n"
                    "  - `https://suno.com/song/3b172539-fc21-4f37-937c-a641ed52da26`\n\n"
                    "Please use Suno.com to create and share your collaboration."
                )
                await self._send_submission_error(message.channel, message.author, [error_msg])
                return
            
            # Reject file attachments - only Suno URLs are allowed
            if has_attachment:
                error_msg = (
                    "❌ **File attachments are not accepted**\n\n"
                    "**Valid submissions must be Suno.com URLs only:**\n"
                    "• `https://suno.com/s/kFacPCnBlw9n9oEP`\n"
                    "• `https://suno.com/song/3b172539-fc21-4f37-937c-a641ed52da26`\n\n"
                    "Please create your collaboration on Suno.com and share the link."
                )
                await self._send_submission_error(message.channel, message.author, [error_msg])
                return
            
            # Check if it's a potential submission (only Suno URLs now)
            if not (has_valid_suno or has_suno_reference):
                return  # Not a submission, ignore
            
            # Validate Suno URLs if referenced
            if has_suno_reference and not has_valid_suno:
                # Has Suno reference but no valid URLs
                error_msg = (
                    "❌ **Invalid Suno.com URL format**\n\n"
                    "Valid Suno URL formats:\n"
                    "• `https://suno.com/s/kFacPCnBlw9n9oEP`\n"
                    "• `https://suno.com/song/3b172539-fc21-4f37-937c-a641ed52da26`\n\n"
                    "Please check your URL and try again."
                )
                await self._send_submission_error(message.channel, message.author, [error_msg])
                return
            
            # Extract team info from message
            team_info = self._extract_team_info_from_message(message.content, message.mentions, guild, message.author.id)
            
            if team_info["errors"]:
                await self._send_submission_error(message.channel, message.author, team_info["errors"])
                return
            
            # Check if team can submit
            team_check = await self._is_team_already_submitted(
                guild, 
                team_info["team_name"], 
                message.author.id, 
                team_info["partner_id"]
            )
            
            if not team_check["can_submit"]:
                await self._send_submission_error(message.channel, message.author, team_check["errors"])
                return
            
            # Register successful submission
            await self._register_team_submission(
                guild, 
                team_info["team_name"], 
                message.author.id, 
                team_info["partner_id"]
            )
            
            # Send success confirmation
            partner = guild.get_member(team_info["partner_id"])
            partner_name = partner.mention if partner else "your partner"
            
            success_msg = f"✅ **Submission registered!**\n\n"
            success_msg += f"**Team:** `{team_info['team_name']}`\n"
            success_msg += f"**Members:** {message.author.mention} & {partner_name}\n"
            competition_key = await self._get_competition_week_key(guild)
            success_msg += f"**Competition:** {competition_key}\n\n"
            success_msg += "Good luck in the competition! 🎵"
            
            await message.add_reaction("✅")
            await message.channel.send(success_msg)
            
        except Exception as e:
            print(f"Error validating Discord submission in {guild.name}: {e}")
    
    def _validate_suno_url(self, url: str) -> bool:
        """
        Validate Suno.com URL format
        
        Valid formats:
        - https://suno.com/s/kFacPCnBlw9n9oEP
        - https://suno.com/song/3b172539-fc21-4f37-937c-a641ed52da26
        
        Args:
            url: The URL to validate
            
        Returns:
            bool: True if URL is valid Suno format, False otherwise
        """
        import re
        
        if not url or not isinstance(url, str):
            return False
            
        # Remove trailing whitespace and normalize URL
        url = url.strip()
        
        # Pattern for Suno URLs
        # Format 1: https://suno.com/s/[16 character alphanumeric string]
        # Format 2: https://suno.com/song/[UUID format]
        suno_patterns = [
            r'^https://suno\.com/s/[a-zA-Z0-9]{16}$',  # Short format (exactly 16 chars)
            r'^https://suno\.com/song/[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}$'  # UUID format
        ]
        
        for pattern in suno_patterns:
            if re.match(pattern, url):
                return True
                
        return False
    
    def _extract_suno_urls_from_text(self, text: str) -> list:
        """
        Extract all potential Suno URLs from text
        
        Args:
            text: Text to search for URLs
            
        Returns:
            list: List of found Suno URLs
        """
        import re
        
        if not text:
            return []
            
        # Pattern to find URLs that might be Suno links
        url_pattern = r'https://suno\.com/(?:s/[a-zA-Z0-9]{16}|song/[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12})'
        
        found_urls = re.findall(url_pattern, text)
        
        # Validate each found URL
        valid_urls = []
        for url in found_urls:
            if self._validate_suno_url(url):
                valid_urls.append(url)
                
        return valid_urls
    
    async def _is_user_admin(self, guild, user) -> bool:
        """Check if user is admin or has manage messages permission"""
        # Check if user is the primary configured admin
        admin_id = await self.config.guild(guild).admin_user_id()
        if admin_id == user.id:
            return True
        
        # Check if user is in the additional admins list
        admin_ids = await self.config.guild(guild).admin_user_ids()
        if user.id in admin_ids:
            return True
        
        # Check if user has admin/manage permissions
        if hasattr(user, 'guild_permissions'):
            return (user.guild_permissions.administrator or 
                    user.guild_permissions.manage_messages or
                    user.guild_permissions.manage_guild)
        
        return False
    
    async def _delete_message_with_explanation(self, message, title: str, explanation: str, 
                                             auto_delete_enabled: bool, delete_after: int = 10, 
                                             include_help_commands: bool = True) -> None:
        """
        Delete message and send explanation if auto-delete is enabled
        
        Args:
            message: The message to potentially delete
            title: Title for the explanation message
            explanation: Explanation text
            auto_delete_enabled: Whether auto-deletion is enabled
            delete_after: Seconds after which to delete the explanation
            include_help_commands: Whether to include info about !info and !status commands
        """
        help_text = "\nℹ️ **Need help?** Use `!info` for competition guide or `!status` for current status" if include_help_commands else ""
        
        if auto_delete_enabled:
            try:
                await message.delete()
                await message.channel.send(
                    f"{title}\n\n{explanation}{help_text}\n\n*This message will be deleted in {delete_after} seconds.*",
                    delete_after=delete_after
                )
            except discord.Forbidden:
                # Can't delete message, send warning instead
                await message.channel.send(
                    f"{title} - {message.author.mention} {explanation}{help_text}",
                    delete_after=delete_after
                )
        else:
            # Just send a warning without deleting
            await message.channel.send(
                f"{title} - {message.author.mention} {explanation}{help_text}",
                delete_after=delete_after
            )
    
    async def _get_user_rep_count(self, guild, user_id: int) -> int:
        """Get user's current rep points using AutoReputation API"""
        try:
            # Get AutoReputation cog
            auto_rep = self.bot.get_cog('AutoReputation')
            if not auto_rep:
                print("AutoReputation cog not found")
                return 0
            
            user = guild.get_member(user_id)
            if not user:
                return 0
            
            # Get petals using AutoReputation API
            result = await auto_rep.api_get_points(guild, user_id)
            
            if result and "petals" in result:
                return result["petals"]
            
            return 0
            
        except Exception as e:
            print(f"Error getting rep count for user {user_id}: {e}")
            return 0
    
    async def _give_rep_to_user(self, guild, user_id: int, amount: int) -> bool:
        """Give rep points to a user using AutoReputation API"""
        try:
            # Get AutoReputation cog
            auto_rep = self.bot.get_cog('AutoReputation')
            if not auto_rep:
                print("AutoReputation cog not found")
                return False
            
            user = guild.get_member(user_id)
            if not user:
                return False
            
            # Add petals using AutoReputation API
            result = await auto_rep.api_add_points(
                guild=guild,
                user_id=user_id,
                amount=amount,
                reason="Competition winner",
                source_cog="CollabWarz"
            )
            
            # Check if the operation was successful
            if result and result.get("success"):
                return True
            else:
                print(f"Failed to give rep to user {user_id}: {result}")
                return False
            
        except Exception as e:
            print(f"Error giving rep to user {user_id}: {e}")
            return False
    
    async def _record_weekly_winner(self, guild, team_name: str, member_ids: list, week_key: str = None):
        """Record the competition winner and give rep rewards"""
        try:
            if week_key is None:
                week_key = await self._get_competition_week_key(guild)
            
            # Record winner
            weekly_winners = await self.config.guild(guild).weekly_winners()
            rep_amount = await self.config.guild(guild).rep_reward_amount()
            
            # Give rep to each team member
            rep_results = {}
            for user_id in member_ids:
                success = await self._give_rep_to_user(guild, user_id, rep_amount)
                rep_results[user_id] = success
            
            # Record the winner with rep status
            weekly_winners[week_key] = {
                "team_name": team_name,
                "members": member_ids,
                "rep_given": rep_results,
                "timestamp": datetime.now().isoformat()
            }
            
            await self.config.guild(guild).weekly_winners.set(weekly_winners)
            
            # ===== COMPREHENSIVE DATA TRACKING =====
            # Find the winning team and song in normalized database
            teams_db = await self.config.guild(guild).teams_db()
            songs_db = await self.config.guild(guild).songs_db()
            
            winning_team_id = None
            winning_song_id = None
            
            # Find team by name and members
            for team_id, team_data in teams_db.items():
                if (team_data["name"] == team_name and 
                    set(str(uid) for uid in member_ids) == set(team_data["members"])):
                    winning_team_id = int(team_id)
                    
                    # Find the song for this week
                    if week_key in team_data["songs_by_week"]:
                        for song_id in team_data["songs_by_week"][week_key]:
                            if str(song_id) in songs_db and songs_db[str(song_id)]["week_key"] == week_key:
                                winning_song_id = song_id
                                break
                    break
            
            # If we found the team and song, finalize results
            if winning_team_id and winning_song_id:
                # Get vote counts from current system (placeholder - would integrate with real vote system)
                vote_results = {str(winning_song_id): 0}  # Would get real vote counts
                
                # Finalize all week results
                await self._finalize_week_results(guild, week_key, winning_team_id, winning_song_id, vote_results)
            # ===== END DATA TRACKING =====
            
            return rep_results
            
        except Exception as e:
            print(f"Error recording weekly winner: {e}")
            return {}
    
    async def _create_winner_announcement_with_rep(self, guild, team_name: str, member_ids: list, theme: str, vote_counts: dict = None, from_face_off: bool = False) -> str:
        """Create winner announcement with rep information and voting details"""
        try:
            rep_amount = await self.config.guild(guild).rep_reward_amount()
            
            # Get member details and their rep counts
            member_details = []
            for user_id in member_ids:
                user = guild.get_member(user_id)
                if user:
                    # Get updated rep count (after giving rewards)
                    total_rep = await self._get_user_rep_count(guild, user_id)
                    
                    member_details.append({
                        "user": user,
                        "gained": rep_amount,
                        "total": total_rep
                    })
            
            # Get winning team's song information
            submissions = await self._get_submissions_safe(guild)
            winning_song_info = submissions.get(team_name, {})
            song_url = winning_song_info.get('track_url', '')
            
            # Create enhanced winner message
            if from_face_off:
                base_msg = f"⚔️ **FACE-OFF WINNER!** ⚔️\n\n🏆 **{team_name}** wins the 24-hour tie-breaker! 🏆\n\n"
            else:
                base_msg = f"🏆 **WINNER ANNOUNCEMENT!** 🏆\n\n🎉 Congratulations to the champions of **{theme}**! 🎉\n\n"
            
            # Add team and member info
            if len(member_details) >= 2:
                base_msg += f"**🎵 Winning Team:** `{team_name}`\n"
                base_msg += f"**👥 Members:** {member_details[0]['user'].mention} & {member_details[1]['user'].mention}\n"
                
                # Add song information if available
                if song_url:
                    base_msg += f"**🎧 Winning Song:** {song_url}\n"
                    
                    # Try to get Suno metadata for additional song details
                    if 'suno.com' in song_url.lower():
                        song_id = self._extract_suno_song_id(song_url)
                        if song_id:
                            metadata = await self._fetch_suno_metadata(song_id, guild)
                            if metadata and metadata.get('title'):
                                base_msg += f"**🎤 Title:** \"{metadata['title']}\"\n"
                                if metadata.get('duration'):
                                    base_msg += f"**⏱️ Duration:** {metadata['duration']:.1f}s\n"
                
                base_msg += "\n"
                
                # Add voting results if available
                if vote_counts:
                    base_msg += f"**📊 Final Results:**\n"
                    # Sort teams by votes, winner first
                    sorted_votes = sorted(vote_counts.items(), key=lambda x: x[1], reverse=True)
                    for i, (team, votes) in enumerate(sorted_votes[:5]):  # Show top 5
                        if team == team_name:
                            base_msg += f"🏆 **{team}**: {votes} votes\n"
                        else:
                            base_msg += f"• **{team}**: {votes} votes\n"
                    
                    if len(sorted_votes) > 5:
                        base_msg += f"... and {len(sorted_votes) - 5} more teams\n"
                    base_msg += "\n"
                
                # Add rep rewards info
                if rep_amount > 0:
                    base_msg += f"**🌸 Rep Rewards:**\n"
                    for detail in member_details:
                        base_msg += f"• {detail['user'].mention}: +{detail['gained']} petals (Total: {detail['total']} petals)\n"
                    base_msg += "\n"
                
                base_msg += "🔥 Incredible collaboration and amazing music! 🎵✨\n\n"
                base_msg += "🌐 **Listen to all tracks:** https://collabwarz.soundgarden.app\n"
                base_msg += "💡 **Commands:** Use `!info` for competition guide or `!status` for details\n\n"
                base_msg += "🔥 Get ready for next week's challenge!\n\n*New theme drops Monday morning!* 🚀"
            else:
                # Fallback if member info unavailable
                base_msg += f"**🎵 Winning Team:** `{team_name}`\n"
                if song_url:
                    base_msg += f"**🎧 Winning Song:** {song_url}\n"
                base_msg += "\n"
                base_msg += f"**🌸 Each member receives:** +{rep_amount} petals!\n\n"
                base_msg += "🔥 Incredible collaboration and amazing music! 🎵✨\n\n"
                base_msg += "🌐 **Listen to all tracks:** https://collabwarz.soundgarden.app\n"
                base_msg += "💡 **Commands:** Use `!info` for competition guide or `!status` for details\n\n"
                base_msg += "🔥 Get ready for next week's challenge!\n\n*New theme drops Monday morning!* 🚀"
            
            return base_msg
            
        except Exception as e:
            print(f"Error creating winner announcement with rep: {e}")
            # Fallback to simple announcement
            return f"🏆 **WINNER ANNOUNCEMENT!** 🏆\n\n🎉 Congratulations to team **{team_name}** for winning **{theme}**! 🎉\n\n� **Commands:** Use `!info` for competition guide or `!status` for details\n\n�🔥 Get ready for next week's challenge!\n\n*New theme drops Monday morning!* 🚀"
    
    async def announcement_loop(self):
        """Background task that checks and posts announcements"""
        await self.bot.wait_until_ready()
        
        while not self.bot.is_closed():
            try:
                for guild in self.bot.guilds:
                    await self.check_and_announce(guild)
            except Exception as e:
                print(f"Error in announcement loop: {e}")
            
            # Check every hour
            await asyncio.sleep(3600)
    
    async def check_and_announce(self, guild: discord.Guild):
        """Check if announcements need to be posted"""
        if not await self.config.guild(guild).auto_announce():
            return
            
        channel_id = await self.config.guild(guild).announcement_channel()
        if not channel_id:
            return
            
        channel = guild.get_channel(channel_id)
        if not channel:
            return
        
        now = datetime.utcnow()
        current_phase = await self.config.guild(guild).current_phase()
        theme = await self.config.guild(guild).current_theme()
        last_announcement = await self.config.guild(guild).last_announcement()
        winner_announced = await self.config.guild(guild).winner_announced()
        biweekly_mode = await self.config.guild(guild).biweekly_mode()
        
        # Check if this is a competition week (for bi-weekly mode)
        is_competition_week = await self._is_competition_week(guild)
        
        # In bi-weekly mode, during off weeks, set phase to inactive
        if biweekly_mode and not is_competition_week:
            if current_phase not in ["inactive", "paused"]:
                await self.config.guild(guild).current_phase.set("inactive")
            return  # Skip all announcements during off weeks
        
        # Calculate current phase based on day of week (same for both modes during active weeks)
        day = now.weekday()  # 0 = Monday, 6 = Sunday
        iso_year, iso_week, _ = now.isocalendar()
        
        # Regular weekly schedule (used for both modes during active weeks)
        if day < 4:  # Monday to Thursday
            expected_phase = "submission"
        elif day == 4 and now.hour < 12:  # Friday before noon
            expected_phase = "submission"
        else:  # Friday noon onwards to Sunday
            expected_phase = "voting"
        
        # Get current competition identifier for tracking
        competition_key = await self._get_competition_week_key(guild)
        current_week = iso_week  # Keep for backwards compatibility with existing code
        
        # Check for phase transitions and send appropriate announcements
        announcement_posted = False
        
        # 1. Check if we need to announce start of submission phase (Monday)
        # Also handle restart after cancelled week
        week_cancelled = await self.config.guild(guild).week_cancelled()
        face_off_active = await self.config.guild(guild).face_off_active()
        
        # Delay start if face-off is active (start Tuesday instead of Monday)
        should_restart = False
        if face_off_active:
            # Check if face-off deadline has passed
            face_off_deadline_str = await self.config.guild(guild).face_off_deadline()
            if face_off_deadline_str:
                face_off_deadline = datetime.fromisoformat(face_off_deadline_str)
                
                if now >= face_off_deadline:
                    # Face-off time is up, process results
                    await self._process_voting_end(guild)
                    
                    # Start new week on Tuesday if face-off just ended
                    if day == 1:  # Tuesday
                        should_restart = True
        else:
            # Check if we should start a new competition
            if biweekly_mode:
                # In bi-weekly mode, only start on Monday of odd weeks (competition weeks)
                should_restart = (is_competition_week and  # Only on competition weeks
                                 expected_phase == "submission" and 
                                 (current_phase != "submission" or current_phase == "cancelled" or week_cancelled) and 
                                 last_announcement != f"submission_start_{competition_key}" and
                                 day == 0)  # Monday only
            else:
                # Normal weekly start
                should_restart = (expected_phase == "submission" and 
                                 (current_phase != "submission" or current_phase == "cancelled" or week_cancelled) and 
                                 last_announcement != f"submission_start_{competition_key}" and
                                 day == 0)  # Monday only
        
        if should_restart:
            # Reset cancelled week flag
            if week_cancelled:
                await self.config.guild(guild).week_cancelled.set(False)
            
            # Check if we have a pending theme for this week
            await self._apply_next_week_theme_if_ready(guild)
            
            # Get the current theme (may have been updated)
            current_theme = await self.config.guild(guild).current_theme()
            
            await self._post_announcement(channel, guild, "submission_start", current_theme)
            await self.config.guild(guild).current_phase.set("submission")
            await self.config.guild(guild).last_announcement.set(f"submission_start_{competition_key}")
            await self.config.guild(guild).winner_announced.set(False)
            await self.config.guild(guild).theme_generation_done.set(False)  # Reset for next cycle
            await self.config.guild(guild).week_cancelled.set(False)  # Reset cancelled flag
            
            # Note: Team registrations are automatically separated by week, no need to clear
            announcement_posted = True
        
        # 2. Check if we need to announce start of voting phase
        elif (expected_phase == "voting" and 
              current_phase != "voting" and 
              last_announcement != f"voting_start_{competition_key}"):
            
            # In both modes, voting starts on Friday noon during active weeks
            should_start_voting = (day == 4 and now.hour >= 12)  # Friday noon
                
            if should_start_voting:
                # Check if we have enough teams to proceed with voting
                team_count = await self._count_participating_teams(guild)
                min_teams = await self.config.guild(guild).min_teams_required()
                
                if team_count < min_teams:
                    # Cancel the competition due to insufficient participation
                    await self._cancel_week_and_restart(guild, channel, theme)
                    announcement_posted = True
                else:
                    # Proceed with normal voting phase
                    await self._post_announcement(channel, guild, "voting_start", theme)
                    await self.config.guild(guild).current_phase.set("voting")
                    await self.config.guild(guild).last_announcement.set(f"voting_start_{competition_key}")
                    announcement_posted = True
        
        # 3. Check for reminder announcements 
        if not announcement_posted:
            # Same reminder schedule for both modes during active weeks
            # Submission reminder (Thursday evening)
            if (expected_phase == "submission" and 
                day == 3 and now.hour >= 18 and  # Thursday after 6 PM
                last_announcement != f"submission_reminder_{competition_key}"):
                
                reminder_text = "Friday 12:00"
                if biweekly_mode:
                    reminder_text += " (Next competition in 2 weeks)"
                
                await self._post_announcement(channel, guild, "reminder", theme, reminder_text)
                await self.config.guild(guild).last_announcement.set(f"submission_reminder_{competition_key}")
                announcement_posted = True
            
            # Voting reminder (Saturday evening)
            elif (expected_phase == "voting" and 
                  day == 5 and now.hour >= 18 and  # Saturday after 6 PM
                  last_announcement != f"voting_reminder_{competition_key}"):
                
                await self._post_announcement(channel, guild, "reminder", theme, "Sunday 23:59")
                await self.config.guild(guild).last_announcement.set(f"voting_reminder_{competition_key}")
                announcement_posted = True
        
        # 4. Check for winner announcement (Sunday evening after voting ends)
        # Same timing for both modes during active weeks
        should_announce_winner = (day == 6 and now.hour >= 20)  # Sunday after 8 PM
            
        if (not announcement_posted and 
            should_announce_winner and
            not winner_announced and
            last_announcement != f"winner_{competition_key}"):
            
            # Process voting results automatically
            await self._process_voting_end(guild)
            await self.config.guild(guild).last_announcement.set(f"winner_{competition_key}")
            # winner_announced will be set by _process_voting_end if successful
        
        # 5. Check for next theme generation (Sunday evening after winner announcement)
        theme_generation_done = await self.config.guild(guild).theme_generation_done()
        next_week_theme = await self.config.guild(guild).next_week_theme()
        
        # Same timing for both modes during active weeks
        should_generate_theme = (day == 6 and now.hour >= 21)  # Sunday after 9 PM
        
        if (not announcement_posted and
            should_generate_theme and
            winner_announced and
            not theme_generation_done and
            not next_week_theme):  # Only generate if no theme already set for next cycle
            
            await self._generate_next_week_theme(guild)
            await self.config.guild(guild).theme_generation_done.set(True)
    
    async def _post_announcement(self, channel, guild, announcement_type: str, theme: str, deadline: str = None, force: bool = False):
        """Helper method to post an announcement"""
        try:
            # Check if confirmation is required and not forced
            require_confirmation = await self.config.guild(guild).require_confirmation()
            admin_id = await self.config.guild(guild).admin_user_id()
            
            if require_confirmation and not force and admin_id:
                # Store pending announcement and request confirmation
                pending_data = {
                    "type": announcement_type,
                    "theme": theme,
                    "deadline": deadline,
                    "channel_id": channel.id,
                    "timestamp": datetime.utcnow().isoformat()
                }
                await self.config.guild(guild).pending_announcement.set(pending_data)
                
                # Send confirmation request to admin
                admin_user = self.bot.get_user(admin_id)
                if admin_user:
                    await self._send_confirmation_request(admin_user, guild, announcement_type, theme, deadline)
                    print(f"Confirmation request sent to admin for {announcement_type} in {guild.name}")
                    return
            
            # Special handling for winner announcements
            if announcement_type == "winner":
                # For winner announcements, we need team and member information
                # This will be handled by manual winner declaration instead
                announcement = await self.generate_announcement(guild, announcement_type, theme, deadline)
            else:
                # Generate normal announcement
                announcement = await self.generate_announcement(guild, announcement_type, theme, deadline)
            
            embed = discord.Embed(
                description=announcement,
                color=discord.Color.green()
            )
            embed.set_footer(text="SoundGarden's Collab Warz")
            
            # Check if @everyone ping is enabled
            use_everyone_ping = await self.config.guild(guild).use_everyone_ping()
            
            if use_everyone_ping:
                await channel.send("@everyone", embed=embed)
            else:
                await channel.send(embed=embed)
            print(f"Posted {announcement_type} announcement in {guild.name}")
            
            # Clear pending announcement if it was confirmed
            await self.config.guild(guild).pending_announcement.set(None)
            
        except Exception as e:
            print(f"Error posting announcement in {guild.name}: {e}")
    
    async def _send_confirmation_request(self, admin_user, guild, announcement_type: str, theme: str, deadline: str = None):
        """Send a confirmation request to the admin via DM"""
        try:
            # Generate preview of the announcement
            preview = await self.generate_announcement(guild, announcement_type, theme, deadline)
            
            embed = discord.Embed(
                title="🤖 Collab Warz - Confirmation Required",
                description=f"**Server:** {guild.name}\n**Type:** {announcement_type.replace('_', ' ').title()}",
                color=discord.Color.blue()
            )
            
            embed.add_field(
                name="📝 Proposed Announcement",
                value=preview[:1000] + ("..." if len(preview) > 1000 else ""),
                inline=False
            )
            
            embed.add_field(
                name="🎵 Current Theme",
                value=f"**{theme}**",
                inline=True
            )
            
            if deadline:
                embed.add_field(
                    name="⏰ Deadline",
                    value=deadline,
                    inline=True
                )
            
            # Determine timeout message
            if announcement_type == "submission_start":
                timeout_msg = "⏰ **Auto-posts at next Monday 9 AM UTC if no response**"
            else:
                timeout_minutes = (await self.config.guild(guild).confirmation_timeout()) // 60
                timeout_msg = f"⏰ **Auto-posts in {timeout_minutes} minutes if no response**"
            
            embed.add_field(
                name="📋 Actions Available",
                value=(
                    "✅ **React with ✅** to approve and post\n"
                    "❌ **React with ❌** to cancel\n"
                    "🔄 **React with 🔄** then reply `newtheme: Your Theme`\n"
                    f"💬 Or use `[p]cw confirm {guild.id}` to approve\n"
                    f"🚫 Or use `[p]cw deny {guild.id}` to cancel\n\n"
                    f"{timeout_msg}"
                ),
                inline=False
            )
            
            embed.set_footer(text=f"Guild ID: {guild.id} | Auto-expires in 30 minutes")
            
            message = await admin_user.send(embed=embed)
            
            # Add reaction options
            await message.add_reaction("✅")
            await message.add_reaction("❌")
            await message.add_reaction("🔄")
            
            # Start timeout task with smart timeout calculation
            if announcement_type == "submission_start":
                timeout = self._calculate_smart_timeout(announcement_type)
            else:
                timeout = await self.config.guild(guild).confirmation_timeout()
            
            self.bot.loop.create_task(self._handle_confirmation_timeout(guild, timeout))
            
        except Exception as e:
            print(f"Error sending confirmation request: {e}")
    
    async def _handle_confirmation_timeout(self, guild, timeout_seconds: int):
        """Handle automatic posting if no confirmation received within timeout"""
        await asyncio.sleep(timeout_seconds)
        
        # Check if there's still a pending announcement
        pending = await self.config.guild(guild).pending_announcement()
        if not pending:
            return  # Already handled
        
        try:
            # Auto-post the announcement
            channel = guild.get_channel(pending["channel_id"])
            if channel:
                await self._post_announcement(
                    channel, guild, pending["type"], 
                    pending["theme"], pending.get("deadline"), force=True
                )
                
                # Notify admin about auto-posting
                admin_id = await self.config.guild(guild).admin_user_id()
                if admin_id:
                    admin_user = self.bot.get_user(admin_id)
                    if admin_user:
                        try:
                            await admin_user.send(
                                f"⏰ **Auto-posted after timeout**\n"
                                f"Server: {guild.name}\n"
                                f"Type: {pending['type'].replace('_', ' ').title()}\n"
                                f"Theme: {pending['theme']}\n\n"
                                f"*No response received within {timeout_seconds//60} minutes*"
                            )
                        except:
                            pass  # DM might be blocked
                
                print(f"Auto-posted {pending['type']} announcement after timeout in {guild.name}")
        except Exception as e:
            print(f"Error auto-posting announcement in {guild.name}: {e}")
    
    async def _generate_next_week_theme(self, guild):
        """Generate theme for next week and request admin confirmation"""
        try:
            # Check if a theme is already set for next week
            existing_theme = await self.config.guild(guild).next_week_theme()
            if existing_theme:
                print(f"Theme already exists for next week in {guild.name}: {existing_theme}")
                return
            
            ai_url = await self.config.guild(guild).ai_api_url()
            ai_key = await self.config.guild(guild).ai_api_key()
            
            if not (ai_url and ai_key):
                print(f"No AI configuration for theme generation in {guild.name}")
                return
            
            # Generate new theme with AI
            suggested_theme = await self._generate_theme_with_ai(ai_url, ai_key, guild)
            
            if not suggested_theme:
                print(f"Failed to generate theme for {guild.name}")
                return
            
            # Store suggested theme
            await self.config.guild(guild).next_week_theme.set(suggested_theme)
            
            # Send confirmation request to admin
            admin_id = await self.config.guild(guild).admin_user_id()
            if admin_id:
                admin_user = self.bot.get_user(admin_id)
                if admin_user:
                    await self._send_theme_confirmation_request(admin_user, guild, suggested_theme)
                    
                    # Store pending theme confirmation
                    next_week = (datetime.utcnow().isocalendar()[1] + 1) % 53 or 1
                    await self.config.guild(guild).pending_theme_confirmation.set({
                        "theme": suggested_theme,
                        "week": next_week,
                        "timestamp": datetime.utcnow().isoformat()
                    })
                    
                    print(f"Theme generation request sent to admin for {guild.name}: {suggested_theme}")
        
        except Exception as e:
            print(f"Error generating next week theme in {guild.name}: {e}")
    
    async def _generate_theme_with_ai(self, api_url: str, api_key: str, guild) -> Optional[str]:
        """Generate a new theme using AI"""
        prompt = (
            "Generate a creative and inspiring theme for a weekly music collaboration competition. "
            "The theme should be 2-4 words, evocative, and spark creativity for musicians. "
            "Examples: 'Cosmic Dreams', 'Urban Legends', 'Ocean Depths', 'Heart Break', 'Forest Tales'. "
            "Never use 'Neon', 'Rain', 'City', 'Cracks', 'Coffee', 'Stains', 'Lights', 'Untold', 'Waves', 'Skyline', 'Midnight', 'Echoes', 'Shadows', 'Reflections', 'Whispers', 'Memories', 'Unfold', 'Embrace', 'Void', or similar overused words. "
            "Respond with ONLY the theme name, no quotes or additional text."
        )
        
        # Get configurable AI parameters
        ai_model = await self.config.guild(guild).ai_model() or "gpt-3.5-turbo"
        ai_temperature = await self.config.guild(guild).ai_temperature() or 0.9
        
        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    api_url,
                    headers={
                        "Authorization": f"Bearer {api_key}",
                        "Content-Type": "application/json"
                    },
                    json={
                        "model": ai_model,
                        "messages": [
                            {"role": "system", "content": "You are a creative theme generator for music competitions."},
                            {"role": "user", "content": prompt}
                        ],
                        "max_tokens": 20,
                        "temperature": ai_temperature
                    },
                    timeout=aiohttp.ClientTimeout(total=15)
                ) as response:
                    if response.status == 200:
                        data = await response.json()
                        theme = data["choices"][0]["message"]["content"].strip()
                        # Clean up the response (remove quotes, extra whitespace)
                        theme = theme.strip('"\'').strip()
                        return theme
        except Exception as e:
            print(f"AI theme generation error: {e}")
            return None
    
    async def _send_theme_confirmation_request(self, admin_user, guild, suggested_theme: str):
        """Send theme confirmation request to admin via DM"""
        try:
            current_theme = await self.config.guild(guild).current_theme()
            
            embed = discord.Embed(
                title="🎨 Next Week Theme - Confirmation Required",
                description=f"**Server:** {guild.name}\n**For:** Next week's competition",
                color=discord.Color.purple()
            )
            
            embed.add_field(
                name="🤖 AI Generated Theme",
                value=f"**{suggested_theme}**",
                inline=False
            )
            
            embed.add_field(
                name="📝 Current Theme",
                value=f"*{current_theme}* (this week)",
                inline=True
            )
            
            embed.add_field(
                name="📅 Timeline",
                value="• **Now**: Preview for next week\n• **Monday 9 AM**: Theme will be used\n• **You have until Monday morning** to decide",
                inline=False
            )
            
            embed.add_field(
                name="📋 Actions Available",
                value=(
                    "✅ **React with ✅** to approve AI theme\n"
                    "❌ **React with ❌** to keep current theme\n"
                    "🎨 **Reply with:** `nexttheme: Your Custom Theme`\n"
                    f"💬 Or use `[p]cw confirmtheme {guild.id}` to approve\n"
                    f"🚫 Or use `[p]cw denytheme {guild.id}` to reject\n\n"
                    "⏰ **If no response by Monday 9 AM: AI theme will be used automatically**"
                ),
                inline=False
            )
            
            embed.set_footer(text=f"Guild ID: {guild.id} | Theme for next week")
            
            message = await admin_user.send(embed=embed)
            
            # Add reaction options
            await message.add_reaction("✅")
            await message.add_reaction("❌")
            await message.add_reaction("🎨")
            
        except Exception as e:
            print(f"Error sending theme confirmation request: {e}")
    
    async def _apply_next_week_theme_if_ready(self, guild):
        """Apply next week theme if available and it's Monday"""
        try:
            next_week_theme = await self.config.guild(guild).next_week_theme()
            pending_confirmation = await self.config.guild(guild).pending_theme_confirmation()
            
            if next_week_theme:
                # Apply the AI-generated or confirmed theme
                await self.config.guild(guild).current_theme.set(next_week_theme)
                print(f"Applied next week theme in {guild.name}: {next_week_theme}")
                
                # Clear the next week theme
                await self.config.guild(guild).next_week_theme.set(None)
                await self.config.guild(guild).pending_theme_confirmation.set(None)
                
                # Notify admin that theme was applied
                admin_id = await self.config.guild(guild).admin_user_id()
                if admin_id:
                    admin_user = self.bot.get_user(admin_id)
                    if admin_user:
                        try:
                            await admin_user.send(
                                f"🎨 **Theme Applied for New Week**\n"
                                f"Server: {guild.name}\n"
                                f"New Theme: **{next_week_theme}**\n"
                                f"The new week has started with this theme!"
                            )
                        except:
                            pass  # DM might be blocked
                            
        except Exception as e:
            print(f"Error applying next week theme in {guild.name}: {e}")
    
    def _calculate_smart_timeout(self, announcement_type: str) -> int:
        """Calculate timeout based on announcement type and next submission phase"""
        now = datetime.utcnow()
        
        if announcement_type == "submission_start":
            # For submission start, use next Monday if we're not on Monday
            days_until_monday = (7 - now.weekday()) % 7  # 0 if Monday, else days until next Monday
            if days_until_monday == 0 and now.hour < 9:  # Monday before 9 AM
                # We're on Monday morning, use short timeout
                return 3600  # 1 hour
            elif days_until_monday == 0:  # Monday after 9 AM
                # Next Monday
                next_monday = now + timedelta(days=7)
            else:
                # Calculate next Monday
                next_monday = now + timedelta(days=days_until_monday)
            
            # Set to Monday 9 AM
            next_monday = next_monday.replace(hour=9, minute=0, second=0, microsecond=0)
            timeout_seconds = int((next_monday - now).total_seconds())
            
            # Minimum 1 hour, maximum 7 days
            return max(3600, min(timeout_seconds, 7*24*3600))
        
        else:
            # For other announcements, use configured timeout
            return 1800  # 30 minutes default
        
    async def generate_announcement(self, guild: discord.Guild, announcement_type: str, theme: str, deadline: Optional[str] = None) -> str:
        """
        Generate an announcement using AI.
        Falls back to template if AI is not configured.
        
        announcement_type: "submission_start", "voting_start", "reminder", "winner"
        """
        # Try AI generation first
        ai_url = await self.config.guild(guild).ai_api_url()
        ai_key = await self.config.guild(guild).ai_api_key()
        
        if ai_url and ai_key:
            try:
                announcement = await self._generate_with_ai(announcement_type, theme, deadline, ai_url, ai_key, guild)
                if announcement:
                    return announcement
            except Exception as e:
                print(f"AI generation failed: {e}")
        
        # Fallback to templates
        return await self._get_template_announcement(guild, announcement_type, theme, deadline)
    
    async def _generate_with_ai(self, announcement_type: str, theme: str, deadline: Optional[str], api_url: str, api_key: str, guild) -> Optional[str]:
        """Generate announcement using AI API (OpenAI-compatible format)"""
        
        # Generate Discord timestamp for deadline if not provided
        if not deadline:
            deadline_dt = self._get_next_deadline(announcement_type)
            deadline = self._create_discord_timestamp(deadline_dt, "R")  # Relative time
            deadline_full = self._create_discord_timestamp(deadline_dt, "F")  # Full date/time
        else:
            # If deadline is already provided, assume it's already formatted
            deadline_full = deadline
        
        prompts = {
            "submission_start": f"Create an exciting Discord announcement for a music collaboration competition called 'Collab Warz'. The submission phase is starting. This week's theme is '{theme}'. Include the deadline as '{deadline_full}' (this is a Discord timestamp that will show properly formatted). Make it enthusiastic, creative, and encourage participants. Keep it under 300 characters. Use emojis.",
            "voting_start": f"Create an engaging Discord announcement that voting has started for Collab Warz music competition with theme '{theme}'. Encourage everyone to listen and vote. Include the deadline as '{deadline_full}' (this is a Discord timestamp). Keep it under 300 characters. Use emojis.",
            "reminder": f"Create a friendly reminder Discord message that voting for Collab Warz (theme: '{theme}') ends {deadline} (this is a Discord timestamp showing relative time). Encourage people to vote if they haven't. Keep it under 200 characters. Use emojis.",
            "winner": f"Create a celebratory Discord announcement for the winner of last week's Collab Warz with theme '{theme}'. Make it exciting and congratulatory. Keep it under 250 characters. Use emojis."
        }
        
        prompt = prompts.get(announcement_type, "")
        
        # Get configurable AI parameters
        ai_model = await self.config.guild(guild).ai_model() or "gpt-3.5-turbo"
        ai_temperature = await self.config.guild(guild).ai_temperature() or 0.8
        ai_max_tokens = await self.config.guild(guild).ai_max_tokens() or 150
        
        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    api_url,
                    headers={
                        "Authorization": f"Bearer {api_key}",
                        "Content-Type": "application/json"
                    },
                    json={
                        "model": ai_model,
                        "messages": [
                            {"role": "system", "content": "You are a creative announcement writer for a music competition community."},
                            {"role": "user", "content": prompt}
                        ],
                        "max_tokens": ai_max_tokens,
                        "temperature": ai_temperature
                    },
                    timeout=aiohttp.ClientTimeout(total=15)
                ) as response:
                    if response.status == 200:
                        data = await response.json()
                        return data["choices"][0]["message"]["content"].strip()
        except Exception as e:
            print(f"AI API error: {e}")
            return None
    
    async def _get_template_announcement(self, guild, announcement_type: str, theme: str, deadline: Optional[str]) -> str:
        """Fallback template announcements with Discord timestamps"""
        
        # Check if bi-weekly mode is enabled
        biweekly_mode = await self.config.guild(guild).biweekly_mode()
        
        # Generate Discord timestamp for deadline if not provided
        if not deadline:
            deadline_dt = self._get_next_deadline(announcement_type)
            deadline = self._create_discord_timestamp(deadline_dt, "R")  # Relative time
            deadline_full = self._create_discord_timestamp(deadline_dt, "F")  # Full date/time
        else:
            # If deadline is already provided, assume it's already formatted
            deadline_full = deadline
        
        # Create mode-specific text
        if biweekly_mode:
            cycle_text = "🎵 **Collab Warz - COMPETITION WEEK!** 🎵\n\n✨ **This week's theme:** **{theme}** ✨\n\n📝 **Submission Phase:** Monday to Friday noon\n🗳️ **Voting Phase:** Friday noon to Sunday\n\nTeam up with someone and create magic together! 🤝"
            winner_next = "🔥 Enjoy next week's break, then get ready for the next competition!\n\n*Next competition starts in 2 weeks!* 🚀"
            schedule_info = "📅 **Bi-Weekly Schedule:** Competition every other week (odd weeks only)"
        else:
            cycle_text = "🎵 **Collab Warz - NEW WEEK STARTS!** 🎵\n\n✨ **This week's theme:** **{theme}** ✨\n\n📝 **Submission Phase:** Monday to Friday noon\n🗳️ **Voting Phase:** Friday noon to Sunday\n\nTeam up with someone and create magic together! 🤝"
            winner_next = "🔥 Get ready for next week's challenge!\n\n*New theme drops Monday morning!* 🚀"
            schedule_info = ""
        
        templates = {
            "submission_start": f"{cycle_text.format(theme=theme)}\n\n**📋 How to Submit (Discord):**\nIn ONE message, include:\n• `Team name: YourTeamName`\n• Tag your partner: `@username`\n• Your Suno.com link (only accepted format)\n\n**🌐 Alternative:** Submit & vote on our website:\n**https://collabwarz.soundgarden.app**\n\n**💡 Need Help?** Use `!info` for submission guide or `!status` for current competition status\n\n{schedule_info}\n\n⏰ **Submissions deadline:** {deadline_full}",
            
            "voting_start": f"🗳️ **VOTING IS NOW OPEN!** 🗳️\n\n🎵 **Theme:** **{theme}**\n\nThe submissions are in! Time to listen and vote for your favorites! 🎧\n\n**🌐 Listen & Vote:** https://collabwarz.soundgarden.app\n\n**💡 Commands:** Use `!info` for competition guide or `!status` for detailed status\n\nEvery vote counts - support the artists! 💫\n\n⏰ **Voting closes:** {deadline_full}",
            
            "reminder": f"⏰ **FINAL CALL!** ⏰\n\n{'🎵 Submissions' if 'submission' in announcement_type else '🗳️ Voting'} for **{theme}** ends {deadline}!\n\n{'Submit your collaboration now!' if 'submission' in announcement_type else 'Cast your votes and support the artists!'} 🎶\n\n🌐 **Website:** https://collabwarz.soundgarden.app\n💡 **Help:** Use `!info` or `!status` for guidance\n\n{'⏰ Last chance to team up and create!' if 'submission' in announcement_type else '⏰ Every vote matters!'}",
            
            "winner": f"🏆 **WINNER ANNOUNCEMENT!** 🏆\n\n🎉 Congratulations to the champions of **{theme}**! 🎉\n\nIncredible collaboration and amazing music! 🎵✨\n\n🌐 **Listen to all tracks:** https://collabwarz.soundgarden.app\n💡 **Commands:** Use `!info` for competition guide or `!status` for details\n\n{winner_next}"
        }
        
        return templates.get(announcement_type, f"Collab Warz update: {theme}")
    
    @commands.group(name="collabwarz", aliases=["cw"])
    @checks.admin_or_permissions(manage_guild=True)
    async def collabwarz(self, ctx):
        """Collab Warz competition management commands"""
        if ctx.invoked_subcommand is None:
            await ctx.send_help(ctx.command)
    
    @collabwarz.command(name="setchannel")
    async def set_channel(self, ctx, channel: discord.TextChannel):
        """Set the announcement channel for Collab Warz"""
        await self.config.guild(ctx.guild).announcement_channel.set(channel.id)
        await ctx.send(f"✅ Announcement channel set to {channel.mention}")
    
    @collabwarz.command(name="settheme")
    async def set_theme(self, ctx, *, theme: str):
        """Set the current competition theme"""
        await self.config.guild(ctx.guild).current_theme.set(theme)
        await ctx.send(f"✅ Theme set to: **{theme}**")
    
    @collabwarz.command(name="setphase")
    async def set_phase(self, ctx, phase: str):
        """Set the current competition phase"""
        phase = phase.lower()
        valid_phases = ["submission", "voting", "cancelled", "paused", "ended", "inactive"]
        
        if phase not in valid_phases:
            embed = discord.Embed(
                title="❌ Invalid Phase",
                color=discord.Color.red()
            )
            embed.add_field(
                name="Valid phases:",
                value=(
                    "• `submission` - 🎵 Users can submit collaborations\n"
                    "• `voting` - 🗳️ Voting on submissions is active\n"
                    "• `cancelled` - ❌ Current week cancelled\n"
                    "• `paused` - ⏸️ Competition temporarily on hold\n"
                    "• `ended` - 🏁 Current cycle completed\n"
                    "• `inactive` - ⏰ No competition running"
                ),
                inline=False
            )
            embed.set_footer(text="Use: [p]cw setphase <phase>")
            await ctx.send(embed=embed)
            return
        
        await self.config.guild(ctx.guild).current_phase.set(phase)
        
        # Create status embed with phase-specific information
        phase_info = {
            "submission": ("🎵", "Submission Phase Active", "Users can now submit their collaborations!"),
            "voting": ("🗳️", "Voting Phase Active", "Users can vote on submitted collaborations!"),
            "cancelled": ("❌", "Week Cancelled", "Current competition week has been cancelled."),
            "paused": ("⏸️", "Competition Paused", "Competition is temporarily on hold."),
            "ended": ("🏁", "Competition Ended", "This competition cycle is complete."),
            "inactive": ("⏰", "Competition Inactive", "No competition currently running.")
        }
        
        emoji, title, description = phase_info[phase]
        
        embed = discord.Embed(
            title=f"{emoji} {title}",
            description=description,
            color=discord.Color.green() if phase in ["submission", "voting"] else discord.Color.orange()
        )
        embed.add_field(
            name="Current Status",
            value=f"Phase set to: **{phase.title()}**",
            inline=False
        )
        
        await ctx.send(embed=embed)
    
    @collabwarz.command(name="help")
    async def show_help(self, ctx):
        """Show detailed help for Collab Warz commands"""
        embed = discord.Embed(
            title="🎵 Collab Warz Commands Help",
            color=discord.Color.blue()
        )
        
        embed.add_field(
            name="📋 Basic Setup",
            value=(
                "`[p]cw setchannel #channel` - Set announcement channel\n"
                "`[p]cw settestchannel #channel` - Set test channel\n"
                "`[p]cw settheme Theme` - Change theme\n"
                "`[p]cw everyone` - Toggle @everyone ping in announcements\n"
                "`[p]cw biweekly` - Toggle bi-weekly mode (alternating weeks on/off)\n"
                "`[p]cw timeout 30` - Set timeout for non-submission confirmations\n"
                "`[p]cw status` - View current status"
            ),
            inline=False
        )
        
        embed.add_field(
            name="🔧 Week Management", 
            value=(
                "`[p]cw interrupt [theme]` - 🔄 **Interrupt & restart week**\n"
                "`[p]cw changetheme Theme` - 🎨 **Change theme only**\n"
                "`[p]cw nextweek [theme]` - Start new week\n"
                "`[p]cw reset` - Reset announcement cycle"
            ),
            inline=False
        )
        
        embed.add_field(
            name="🛡️ Admin Management",
            value=(
                "`[p]cw setadmin @user` - Set primary admin\n"
                "`[p]cw addadmin @user` - Add additional admin\n"
                "`[p]cw removeadmin @user` - Remove admin\n"
                "`[p]cw listadmins` - List all admins\n"
                "`[p]cw adminstatus [@user]` - Check admin access"
            ),
            inline=False
        )
        
        embed.add_field(
            name="✅ Confirmation System",
            value=(
                "`[p]cw confirmation` - Toggle confirmation mode\n"
                "`[p]cw confirm [guild_id]` - Approve announcement\n"
                "`[p]cw deny [guild_id]` - Cancel announcement\n"
                "`[p]cw pending` - Show pending announcements"
            ),
            inline=False
        )
        
        embed.add_field(
            name="� AI Theme Generation",
            value=(
                "`[p]cw setai endpoint key` - Configure AI API\n"
                "`[p]cw generatetheme` - Generate theme for next week\n"
                "`[p]cw setnexttheme \"Theme\"` - Manually set next week's theme\n"
                "`[p]cw confirmtheme [guild_id]` - Approve AI theme\n"
                "`[p]cw denytheme [guild_id]` - Reject AI theme\n"
                "🔄 **Auto-generated Sundays for next week**"
            ),
            inline=False
        )
        
        embed.add_field(
            name="👥 Team Management",
            value=(
                "`[p]cw minteams 2` - Set minimum teams to start voting\n"
                "`[p]cw setsubmissionchannel #channel` - Set submissions channel\n"
                "`[p]cw countteams` - Count current participating teams\n"
                "`[p]cw togglevalidation` - Enable/disable Discord submission validation\n"
                "`[p]cw listteams` - List all registered teams this week\n"
                "`[p]cw clearteams [week]` - Clear team registrations (PERMANENT)\n"
                "⚠️ **Week cancels if insufficient teams by Friday noon**"
            ),
            inline=False
        )
        
        embed.add_field(
            name="📊 History & Statistics",
            value=(
                "`[p]cw history [weeks]` - Show team participation history\n"
                "`[p]cw teamstats [@user]` - User stats or server overview\n"
                "`[p]cw searchteams query` - Search teams by name or member\n"
                "📈 **All team data is permanently preserved**"
            ),
            inline=False
        )
        
        embed.add_field(
            name="🗳️ Integrated Voting System",
            value=(
                "`[p]cw checkvotes` - Check current voting results\n"
                "🌐 **Vote via integrated API** (`/api/public/voting`)\n"
                "🤖 **Winners determined automatically by vote count**\n"
                "⚔️ **24h face-off for ties, random selection if still tied**"
            ),
            inline=False
        )
        
        embed.add_field(
            name="🌸 Rep Rewards (AutoReputation)",
            value=(
                "`[p]cw setrepamount 2` - Set petals given to winners\n"
                "`[p]cw declarewinner \"Team\" @user1 @user2` - 🚨 Manual override only\n"
                "`[p]cw winners [weeks]` - Show recent winners and rep status\n"
                "🏆 **Winners automatically get petals via AutoReputation cog**"
            ),
            inline=False
        )
        
        embed.add_field(
            name="🧪 Testing & Manual",
            value=(
                "`[p]cw test` - 🧪 **Test all announcements (in test channel)**\n"
                "`[p]cw announce type` - Manual announcement\n"
                "`[p]cw forcepost type [theme]` - Emergency post\n"
                "`[p]cw schedule` - View weekly schedule"
            ),
            inline=False
        )
        
        embed.add_field(
            name="🎵 Song Metadata & API",
            value=(
                "`[p]cw apiserver start/stop/status` - Control integrated API server\n"
                "`[p]cw testpublicapi` - Test all public API endpoints\n"
                "`[p]cw sunoconfig enable/disable` - Toggle Suno metadata integration\n"
                "`[p]cw testsuno <url>` - Test Suno API with song URL\n"
                "`[p]cw testsunourl <url>` - Test Suno URL validation\n"
                "🎧 **Automatic song metadata from Suno.com**"
            ),
            inline=False
        )
        
        embed.add_field(
            name="📱 DM Confirmation Controls",
            value=(
                "**Weekly Announcements:**\n"
                "✅ **React to approve immediately**\n"
                "❌ **React to cancel**\n" 
                "🔄 **React, then reply:** `newtheme: New Theme`\n"
                "⏰ **Auto-posts if no response within timeout**\n\n"
                "**Theme Confirmations:**\n"
                "✅ **React to approve AI theme**\n"
                "❌ **React to keep current theme**\n"
                "🎨 **React, then reply:** `nexttheme: Custom Theme`"
            ),
            inline=False
        )
        
        embed.add_field(
            name="🌐 Website Integration",
            value=(
                "**https://collabwarz.soundgarden.app**\n"
                "• 🎵 **Submit songs** via web form\n"
                "• 🎧 **Listen to all submissions** with audio player\n"
                "• 🗳️ **Vote for your favorites** (only way to vote!)\n"
                "• 📊 **View live results** and competition history\n"
                "• 📱 **Mobile-friendly** interface"
            ),
            inline=False
        )
        
        embed.add_field(
            name="👥 Public Commands (Everyone Can Use)",
            value=(
                "`!info` - Competition guide & submission format\n"
                "`!status` - Current status & detailed information\n\n"
                "**These commands are available to all users!**"
            ),
            inline=False
        )
        
        embed.set_footer(text="Admin permissions required for most commands • !info and !status are public")
        
        await ctx.send(embed=embed)

    @collabwarz.command(name="announce")
    async def manual_announce(self, ctx, announcement_type: str):
        """
        Manually post an announcement
        Types: submission_start, voting_start, reminder, winner
        """
        if announcement_type not in ["submission_start", "voting_start", "reminder", "winner"]:
            await ctx.send("❌ Invalid type. Use: submission_start, voting_start, reminder, or winner")
            return
        
        channel_id = await self.config.guild(ctx.guild).announcement_channel()
        if not channel_id:
            await ctx.send("❌ Please set an announcement channel first using `[p]cw setchannel`")
            return
        
        channel = ctx.guild.get_channel(channel_id)
        if not channel:
            await ctx.send("❌ Announcement channel not found")
            return
        
        theme = await self.config.guild(ctx.guild).current_theme()
        deadline = "Soon"  # In production, get from config
        
        async with ctx.typing():
            announcement = await self.generate_announcement(ctx.guild, announcement_type, theme, deadline)
            
            embed = discord.Embed(
                description=announcement,
                color=discord.Color.green()
            )
            embed.set_footer(text="SoundGarden's Collab Warz")
            
            await channel.send(embed=embed)
            await ctx.send(f"✅ Announcement posted in {channel.mention}")
    
    @collabwarz.command(name="setai")
    async def set_ai_config(self, ctx, api_url: str, api_key: str, model: str = None):
        """Set AI API configuration (API key will be hidden)"""
        await self.config.guild(ctx.guild).ai_api_url.set(api_url)
        await self.config.guild(ctx.guild).ai_api_key.set(api_key)
        
        if model:
            await self.config.guild(ctx.guild).ai_model.set(model)
        
        # Delete the message to hide the API key
        try:
            await ctx.message.delete()
        except:
            pass
        
        model_info = f" (Model: {model})" if model else ""
        await ctx.send(f"✅ AI configuration set{model_info} (message deleted for security)", delete_after=10)
    
    @collabwarz.command(name="aimodel")
    async def set_ai_model(self, ctx, model: str):
        """Set AI model (e.g., gpt-4, gpt-3.5-turbo, claude-3-sonnet, llama3)"""
        await self.config.guild(ctx.guild).ai_model.set(model)
        await ctx.send(f"✅ AI model set to: **{model}**")
    
    @collabwarz.command(name="aitemp")
    async def set_ai_temperature(self, ctx, temperature: float):
        """Set AI creativity/temperature (0.0-2.0, default 0.8)"""
        if not 0.0 <= temperature <= 2.0:
            await ctx.send("❌ Temperature must be between 0.0 and 2.0")
            return
        
        await self.config.guild(ctx.guild).ai_temperature.set(temperature)
        await ctx.send(f"✅ AI temperature set to: **{temperature}**")
    
    @collabwarz.command(name="aitokens")
    async def set_ai_max_tokens(self, ctx, max_tokens: int):
        """Set AI maximum tokens (50-500, default 150)"""
        if not 50 <= max_tokens <= 500:
            await ctx.send("❌ Max tokens must be between 50 and 500")
            return
        
        await self.config.guild(ctx.guild).ai_max_tokens.set(max_tokens)
        await ctx.send(f"✅ AI max tokens set to: **{max_tokens}**")
    
    @collabwarz.command(name="everyone")
    async def toggle_everyone_ping(self, ctx):
        """Toggle @everyone ping in announcements"""
        current = await self.config.guild(ctx.guild).use_everyone_ping()
        new_value = not current
        
        await self.config.guild(ctx.guild).use_everyone_ping.set(new_value)
        
        status = "✅ Enabled" if new_value else "❌ Disabled"
        await ctx.send(f"{status} @everyone ping in announcements")
    
    @collabwarz.command(name="biweekly")
    async def toggle_biweekly_mode(self, ctx):
        """Toggle bi-weekly competition mode (alternating weeks: on/off/on/off)"""
        current = await self.config.guild(ctx.guild).biweekly_mode()
        new_value = not current
        
        await self.config.guild(ctx.guild).biweekly_mode.set(new_value)
        
        embed = discord.Embed(
            title="🗓️ Bi-Weekly Mode Configuration",
            color=discord.Color.green() if new_value else discord.Color.orange()
        )
        
        if new_value:
            embed.add_field(
                name="✅ Bi-Weekly Mode Enabled",
                value=(
                    "• **Week 1**: Normal Collab Warz (Mon-Fri submissions, Fri-Sun voting)\n"
                    "• **Week 2**: Off week (no competition, paused)\n"
                    "• **Week 3**: Normal Collab Warz (resumes)\n"
                    "• **Week 4**: Off week (no competition, paused)\n"
                    "• **Pattern continues**: Alternating active/off weeks"
                ),
                inline=False
            )
            embed.add_field(
                name="🔄 Schedule Pattern",
                value="Odd weeks (1, 3, 5, etc.) = Active\nEven weeks (2, 4, 6, etc.) = Off",
                inline=False
            )
        else:
            embed.add_field(
                name="❌ Bi-Weekly Mode Disabled",
                value=(
                    "• **Competition cycle:** Weekly\n"
                    "• **Submission phase:** Monday-Friday noon\n"
                    "• **Voting phase:** Friday noon-Sunday\n"
                    "• **Winner announcement:** Sunday evening\n"
                    "• **Next week starts:** Following Monday"
                ),
                inline=False
            )
        
        embed.add_field(
            name="⚠️ Important Note",
            value="In bi-weekly mode, competitions only run during odd-numbered weeks. Even weeks will be automatically set to 'inactive' phase.",
            inline=False
        )
        
        embed.set_footer(text="Use `[p]cw status` to see current competition information")
        
        await ctx.send(embed=embed)
    
    @collabwarz.command(name="generatetheme")
    async def generate_theme_manual(self, ctx):
        """Generate theme for next week using AI"""
        # Check if theme already exists
        existing_theme = await self.config.guild(ctx.guild).next_week_theme()
        if existing_theme:
            await ctx.send(f"⚠️ **Theme already exists for next week:** {existing_theme}\n"
                          f"Generating a new theme will replace it. Continue anyway...")
        
        ai_url = await self.config.guild(ctx.guild).ai_api_url()
        ai_key = await self.config.guild(ctx.guild).ai_api_key()
        
        if not (ai_url and ai_key):
            await ctx.send("❌ AI not configured. Use `[p]cw setai` first.")
            return
        
        await ctx.send("🤖 Generating theme for next week...")
        
        suggested_theme = await self._generate_theme_with_ai(ai_url, ai_key, ctx.guild)
        
        if not suggested_theme:
            await ctx.send("❌ Failed to generate theme. Try again later.")
            return
        
        # Store suggested theme for next week
        await self.config.guild(ctx.guild).next_week_theme.set(suggested_theme)
        
        # Send confirmation request to admin
        admin_id = await self.config.guild(ctx.guild).admin_user_id()
        if admin_id:
            admin_user = ctx.guild.get_member(admin_id)
            if admin_user and admin_user.id == ctx.author.id:
                # Admin is generating manually, send them the confirmation
                await self._send_theme_confirmation_request(admin_user, ctx.guild, suggested_theme)
                await ctx.send(f"✅ Theme generated: **{suggested_theme}**\nCheck your DMs for confirmation options.")
            else:
                await ctx.send(f"✅ Theme generated for next week: **{suggested_theme}**\nAdmin will receive confirmation request.")
        else:
            await ctx.send(f"✅ Theme generated for next week: **{suggested_theme}**\nNo admin configured for confirmation.")
    
    @collabwarz.command(name="confirmtheme")
    async def confirm_next_theme(self, ctx, guild_id: int = None):
        """Confirm the AI-generated theme for next week"""
        if guild_id is None:
            guild_id = ctx.guild.id
        
        target_guild = self.bot.get_guild(guild_id)
        if not target_guild:
            await ctx.send("❌ Guild not found")
            return
        
        # Check if user is the designated admin
        admin_id = await self.config.guild(target_guild).admin_user_id()
        if admin_id != ctx.author.id:
            await ctx.send("❌ You are not authorized to confirm themes for this server")
            return
        
        pending_theme = await self.config.guild(target_guild).pending_theme_confirmation()
        if not pending_theme:
            await ctx.send("❌ No pending theme confirmation for this server")
            return
        
        # Confirm the theme
        theme = pending_theme["theme"]
        await self.config.guild(target_guild).next_week_theme.set(theme)
        await self.config.guild(target_guild).pending_theme_confirmation.set(None)
        
        await ctx.send(f"✅ Theme confirmed for next week: **{theme}**")
    
    @collabwarz.command(name="denytheme")
    async def deny_next_theme(self, ctx, guild_id: int = None):
        """Deny the AI-generated theme and keep current theme for next week"""
        if guild_id is None:
            guild_id = ctx.guild.id
        
        target_guild = self.bot.get_guild(guild_id)
        if not target_guild:
            await ctx.send("❌ Guild not found")
            return
        
        # Check if user is the designated admin
        admin_id = await self.config.guild(target_guild).admin_user_id()
        if admin_id != ctx.author.id:
            await ctx.send("❌ You are not authorized to deny themes for this server")
            return
        
        pending_theme = await self.config.guild(target_guild).pending_theme_confirmation()
        if not pending_theme:
            await ctx.send("❌ No pending theme confirmation for this server")
            return
        
        # Deny the theme - keep current theme for next week
        current_theme = await self.config.guild(target_guild).current_theme()
        await self.config.guild(target_guild).next_week_theme.set(current_theme)
        await self.config.guild(target_guild).pending_theme_confirmation.set(None)
        
        await ctx.send(f"❌ AI theme denied. Next week will use current theme: **{current_theme}**")
    
    @collabwarz.command(name="setnexttheme")
    async def set_next_theme(self, ctx, *, theme: str):
        """Set the theme for next week (will be applied on Monday)"""
        # Check if user is admin
        if not await self._is_user_admin(ctx.guild, ctx.author):
            await ctx.send("❌ You need admin permissions to set next week's theme")
            return
        
        # Check current theme to show in confirmation
        current_theme = await self.config.guild(ctx.guild).current_theme()
        existing_next_theme = await self.config.guild(ctx.guild).next_week_theme()
        
        # Set the next week theme
        await self.config.guild(ctx.guild).next_week_theme.set(theme)
        
        # Clear any pending theme confirmation since admin manually set it
        await self.config.guild(ctx.guild).pending_theme_confirmation.set(None)
        
        embed = discord.Embed(
            title="🎨 Next Week Theme Set",
            color=discord.Color.green()
        )
        
        embed.add_field(
            name="📝 Current Theme",
            value=f"*{current_theme}* (this week)",
            inline=False
        )
        
        if existing_next_theme:
            embed.add_field(
                name="🔄 Previous Next Week Theme",
                value=f"~~{existing_next_theme}~~ (replaced)",
                inline=False
            )
        
        embed.add_field(
            name="🎵 New Next Week Theme",
            value=f"**{theme}**",
            inline=False
        )
        
        embed.add_field(
            name="📅 When Applied",
            value="• **Monday 9:00 AM UTC**: Theme will automatically become active\n• **Before Monday**: You can change it again with `[p]cw setnexttheme`\n• **Overrides**: Any AI-generated themes for next week",
            inline=False
        )
        
        embed.set_footer(text="Theme will be applied automatically on the next Monday morning")
        
        await ctx.send(embed=embed)
    
    @collabwarz.command(name="syncdata")
    async def sync_existing_data(self, ctx):
        """🔄 Sync existing competition data into comprehensive tracking system"""
        
        embed = discord.Embed(
            title="🔄 Sync Existing Data",
            description="This will migrate existing competition data into the new comprehensive tracking system.",
            color=discord.Color.orange()
        )
        
        embed.add_field(
            name="⚠️ What this does:",
            value=(
                "• Converts existing team submissions to normalized database\n"
                "• Creates artist profiles from competition history\n"
                "• Builds song database from past submissions\n"
                "• Populates week data from competition history\n"
                "• **Safe operation** - does not modify existing data"
            ),
            inline=False
        )
        
        embed.add_field(
            name="🔄 Data Sources:",
            value=(
                "• `team_members` config (existing teams)\n"
                "• `competition_history` (past results)\n"
                "• `weekly_winners` (winner records)\n"
                "• Current Discord member data"
            ),
            inline=False
        )
        
        embed.set_footer(text="React with 🔄 to start sync or ❌ to cancel")
        
        message = await ctx.send(embed=embed)
        await message.add_reaction("🔄")
        await message.add_reaction("❌")
        
        def check(reaction, user):
            return (user == ctx.author and 
                   reaction.message.id == message.id and 
                   str(reaction.emoji) in ["🔄", "❌"])
        
        try:
            reaction, user = await self.bot.wait_for('reaction_add', timeout=30.0, check=check)
            
            if str(reaction.emoji) == "🔄":
                await self._perform_data_sync(ctx, message)
            else:
                cancelled_embed = discord.Embed(
                    title="❌ Cancelled",
                    description="Data sync cancelled.",
                    color=discord.Color.gray()
                )
                await message.edit(embed=cancelled_embed, view=None)
                
        except asyncio.TimeoutError:
            timeout_embed = discord.Embed(
                title="⏰ Timeout",
                description="Data sync timed out.",
                color=discord.Color.gray()
            )
            await message.edit(embed=timeout_embed, view=None)
    
    async def _perform_data_sync(self, ctx, message):
        """Perform the actual data synchronization"""
        try:
            guild = ctx.guild
            
            progress_embed = discord.Embed(
                title="🔄 Syncing Data...",
                description="Migrating existing data to comprehensive tracking system.",
                color=discord.Color.blue()
            )
            await message.edit(embed=progress_embed)
            
            # Initialize counters
            artists_created = 0
            teams_created = 0
            songs_created = 0
            weeks_created = 0
            
            # Get existing data
            team_members = await self.config.guild(guild).team_members()
            competition_history = await self.config.guild(guild).competition_history()
            weekly_winners = await self.config.guild(guild).weekly_winners()
            
            # Sync team members first
            for week_key, week_teams in team_members.items():
                # Update or create week data
                theme = f"Week {week_key}"  # Default theme
                await self._update_week_data(guild, week_key, theme, "completed")
                weeks_created += 1
                
                for team_name, member_ids in week_teams.items():
                    if len(member_ids) >= 2:  # Valid team
                        # Create artists
                        for member_id in member_ids:
                            await self._get_or_create_artist(guild, member_id)
                            artists_created += 1
                        
                        # Create team
                        team_id = await self._get_or_create_team(guild, team_name, member_ids, week_key)
                        teams_created += 1
                        
                        # Create placeholder song (we don't have URLs from old system)
                        song_id = await self._record_song_submission(
                            guild, team_id, week_key, 
                            f"https://suno.com/legacy/{team_id}_{week_key}",
                            f"{team_name} - {week_key}"
                        )
                        songs_created += 1
            
            # Sync winner data
            for week_key, winner_data in weekly_winners.items():
                if "team_name" in winner_data and "members" in winner_data:
                    team_name = winner_data["team_name"]
                    member_ids = winner_data["members"]
                    
                    # Find the team and song
                    teams_db = await self.config.guild(guild).teams_db()
                    for team_id, team_data in teams_db.items():
                        if (team_data["name"] == team_name and 
                            set(str(uid) for uid in member_ids) == set(team_data["members"])):
                            
                            # Find song for this week
                            if week_key in team_data["songs_by_week"]:
                                for song_id in team_data["songs_by_week"][week_key]:
                                    # Mark as winner (simplified vote results)
                                    vote_results = {str(song_id): 10}  # Placeholder votes
                                    await self._finalize_week_results(guild, week_key, int(team_id), song_id, vote_results)
                                    break
                            break
            
            # Final success message
            success_embed = discord.Embed(
                title="✅ Data Sync Complete!",
                description="Successfully migrated existing data to comprehensive tracking system.",
                color=discord.Color.green()
            )
            
            success_embed.add_field(
                name="📊 Migration Results",
                value=(
                    f"**Artists Created:** {artists_created}\n"
                    f"**Teams Processed:** {teams_created}\n"
                    f"**Songs Recorded:** {songs_created}\n"
                    f"**Weeks Processed:** {weeks_created}"
                ),
                inline=False
            )
            
            success_embed.add_field(
                name="🚀 What's Now Available",
                value=(
                    "• Comprehensive artist profiles and statistics\n"
                    "• Team history and collaboration tracking\n"
                    "• Song database with competition context\n"
                    "• Rich API endpoints for frontend access\n"
                    "• Advanced leaderboards and analytics"
                ),
                inline=False
            )
            
            success_embed.add_field(
                name="🔗 API Access",
                value="Use `[p]cw testpublicapi` to see available endpoints",
                inline=False
            )
            
            await message.edit(embed=success_embed)
            
        except Exception as e:
            error_embed = discord.Embed(
                title="❌ Sync Failed",
                description=f"Error during data sync: {str(e)}",
                color=discord.Color.red()
            )
            await message.edit(embed=error_embed)
            print(f"Data sync error: {e}")
    
    @collabwarz.command(name="reviewsuno")
    async def review_suno_matches(self, ctx):
        """🔍 Review unmatched Suno authors and manually link them to Discord members"""
        
        unmatched_authors = await self.config.guild(ctx.guild).unmatched_suno_authors()
        
        if not unmatched_authors:
            embed = discord.Embed(
                title="✅ All Suno Authors Matched",
                description="No unmatched Suno authors found! All song authors have been successfully linked to Discord profiles.",
                color=discord.Color.green()
            )
            await ctx.send(embed=embed)
            return
        
        embed = discord.Embed(
            title="🔍 Unmatched Suno Authors Review",
            description=f"Found **{len(unmatched_authors)}** Suno authors that couldn't be auto-matched to Discord members.",
            color=discord.Color.orange()
        )
        
        # Show first few unmatched authors
        count = 0
        for handle, data in list(unmatched_authors.items())[:5]:
            count += 1
            
            # Get team member names for latest appearance
            latest_appearance = data["team_appearances"][-1] if data["team_appearances"] else {}
            member_names = []
            if latest_appearance:
                for member_id in latest_appearance.get("team_members", []):
                    member = ctx.guild.get_member(int(member_id))
                    member_names.append(member.display_name if member else f"User-{member_id}")
            
            embed.add_field(
                name=f"{count}. @{handle}",
                value=(
                    f"**Name:** {data.get('author_name', 'Unknown')}\n"
                    f"**Profile:** [Suno Profile]({data['profile_url']})\n"
                    f"**Appearances:** {len(data['team_appearances'])}\n"
                    f"**Latest Team:** {', '.join(member_names) if member_names else 'Unknown'}\n"
                    f"**First Seen:** {data['first_seen'][:10]}"
                ),
                inline=True
            )
        
        if len(unmatched_authors) > 5:
            embed.add_field(
                name=f"➕ And {len(unmatched_authors) - 5} more...",
                value="Use commands below to manage matches",
                inline=False
            )
        
        embed.add_field(
            name="🔧 Management Commands",
            value=(
                "`[p]cw linksunouser @handle @discord_user` - Link Suno author to Discord member\n"
                "`[p]cw clearunmatched @handle` - Remove from unmatched list\n"
                "`[p]cw clearallunmatched` - Clear entire unmatched list"
            ),
            inline=False
        )
        
        embed.set_footer(text="💡 Tip: Artists can also self-link by setting their Suno profile in their artist data")
        
        await ctx.send(embed=embed)
    
    @collabwarz.command(name="linksunouser")
    async def link_suno_user(self, ctx, suno_handle: str, discord_user: discord.Member):
        """🔗 Manually link a Suno author to a Discord member"""
        
        # Remove @ if provided
        suno_handle = suno_handle.lstrip('@')
        
        unmatched_authors = await self.config.guild(ctx.guild).unmatched_suno_authors()
        
        if suno_handle not in unmatched_authors:
            embed = discord.Embed(
                title="❌ Suno Author Not Found",
                description=f"Suno author `@{suno_handle}` is not in the unmatched list.",
                color=discord.Color.red()
            )
            embed.add_field(
                name="💡 Note",
                value="This author may have already been matched or never submitted a song.",
                inline=False
            )
            await ctx.send(embed=embed)
            return
        
        # Update artist profile with Suno link
        await self._update_artist_suno_profile(ctx.guild, discord_user.id, f"https://suno.com/@{suno_handle}")
        
        # Remove from unmatched list
        author_data = unmatched_authors.pop(suno_handle)
        await self.config.guild(ctx.guild).unmatched_suno_authors.set(unmatched_authors)
        
        embed = discord.Embed(
            title="✅ Suno Profile Linked Successfully",
            color=discord.Color.green()
        )
        
        embed.add_field(
            name="🎵 Suno Author",
            value=f"**@{suno_handle}** ({author_data.get('author_name', 'Unknown')})",
            inline=True
        )
        
        embed.add_field(
            name="👤 Discord Member",
            value=f"{discord_user.mention}\n({discord_user.display_name})",
            inline=True
        )
        
        embed.add_field(
            name="📊 Historical Data",
            value=f"**Appearances:** {len(author_data['team_appearances'])}\n**Profile:** [Suno Profile](https://suno.com/@{suno_handle})",
            inline=False
        )
        
        await ctx.send(embed=embed)
    
    @collabwarz.command(name="clearunmatched")
    async def clear_unmatched_author(self, ctx, suno_handle: str):
        """🗑️ Remove a Suno author from the unmatched list"""
        
        # Remove @ if provided
        suno_handle = suno_handle.lstrip('@')
        
        unmatched_authors = await self.config.guild(ctx.guild).unmatched_suno_authors()
        
        if suno_handle not in unmatched_authors:
            await ctx.send(f"❌ Suno author `@{suno_handle}` not found in unmatched list.")
            return
        
        # Remove the author
        removed_data = unmatched_authors.pop(suno_handle)
        await self.config.guild(ctx.guild).unmatched_suno_authors.set(unmatched_authors)
        
        embed = discord.Embed(
            title="🗑️ Unmatched Author Removed",
            description=f"Removed `@{suno_handle}` from the unmatched authors list.",
            color=discord.Color.blue()
        )
        
        embed.add_field(
            name="ℹ️ Removed Data",
            value=(
                f"**Name:** {removed_data.get('author_name', 'Unknown')}\n"
                f"**Appearances:** {len(removed_data['team_appearances'])}\n"
                f"**First Seen:** {removed_data['first_seen'][:10]}"
            ),
            inline=False
        )
        
        await ctx.send(embed=embed)
    
    @collabwarz.command(name="clearallunmatched")
    async def clear_all_unmatched(self, ctx):
        """🗑️ Clear the entire unmatched Suno authors list"""
        
        unmatched_authors = await self.config.guild(ctx.guild).unmatched_suno_authors()
        
        if not unmatched_authors:
            await ctx.send("✅ No unmatched authors to clear.")
            return
        
        count = len(unmatched_authors)
        
        # Clear the list
        await self.config.guild(ctx.guild).unmatched_suno_authors.set({})
        
        embed = discord.Embed(
            title="🗑️ All Unmatched Authors Cleared",
            description=f"Removed **{count}** unmatched Suno authors from the tracking list.",
            color=discord.Color.blue()
        )
        
        embed.add_field(
            name="ℹ️ Note",
            value="Future song submissions will attempt to match authors again. Previously matched profiles remain linked.",
            inline=False
        )
        
        await ctx.send(embed=embed)
    
    @collabwarz.command(name="status")
    async def show_status(self, ctx):
        """Show current Collab Warz configuration"""
        channel_id = await self.config.guild(ctx.guild).announcement_channel()
        theme = await self.config.guild(ctx.guild).current_theme()
        phase = await self.config.guild(ctx.guild).current_phase()
        auto = await self.config.guild(ctx.guild).auto_announce()
        last_announcement = await self.config.guild(ctx.guild).last_announcement()
        winner_announced = await self.config.guild(ctx.guild).winner_announced()
        biweekly_mode = await self.config.guild(ctx.guild).biweekly_mode()
        
        channel = ctx.guild.get_channel(channel_id) if channel_id else None
        
        # Calculate expected phase
        now = datetime.utcnow()
        day = now.weekday()
        iso_year, iso_week, _ = now.isocalendar()
        
        is_competition_week = await self._is_competition_week(ctx.guild)
        
        if biweekly_mode and not is_competition_week:
            expected_phase = "inactive"  # Off week
        else:
            expected_phase = "submission" if day <= 2 else "voting"
        
        current_week = iso_week
        competition_key = await self._get_competition_week_key(ctx.guild)
        
        embed = discord.Embed(
            title="🎵 Collab Warz Status",
            color=discord.Color.green()
        )
        embed.add_field(name="Current Theme", value=f"**{theme}**", inline=True)
        embed.add_field(name="Current Phase", value=f"**{phase.title()}**", inline=True)
        embed.add_field(name="Expected Phase", value=f"**{expected_phase.title()}**", inline=True)
        
        # Competition mode and timing info
        if biweekly_mode:
            week_type = "Active" if is_competition_week else "Off"
            embed.add_field(name="Competition Mode", value="🗓️ **Bi-Weekly** (alternating weeks)", inline=True)
            embed.add_field(name="Current Week", value=f"**{competition_key}** ({week_type} week)", inline=True)
        else:
            embed.add_field(name="Competition Mode", value="📅 **Weekly**", inline=True)
            embed.add_field(name="Current Week", value=f"**{competition_key}**", inline=True)
        
        # Next week theme status
        next_week_theme = await self.config.guild(ctx.guild).next_week_theme()
        theme_generation_done = await self.config.guild(ctx.guild).theme_generation_done()
        
        next_theme_status = "⚠️ Not set"
        if next_week_theme:
            next_theme_status = f"**{next_week_theme}** ✅"
        elif theme_generation_done:
            next_theme_status = "🔄 Pending confirmation"
        
        next_theme_label = "Next Cycle Theme" if biweekly_mode else "Next Week Theme"
        embed.add_field(name=next_theme_label, value=next_theme_status, inline=True)
        embed.add_field(name="Auto-Announce", value="✅ Enabled" if auto else "❌ Disabled", inline=True)
        embed.add_field(name="Winner Announced", value="✅ Yes" if winner_announced else "❌ No", inline=True)
        
        # Confirmation settings
        require_confirmation = await self.config.guild(ctx.guild).require_confirmation()
        admin_id = await self.config.guild(ctx.guild).admin_user_id()
        admin_user = ctx.guild.get_member(admin_id) if admin_id else None
        pending = await self.config.guild(ctx.guild).pending_announcement()
        timeout = await self.config.guild(ctx.guild).confirmation_timeout()
        test_channel_id = await self.config.guild(ctx.guild).test_channel()
        test_channel = ctx.guild.get_channel(test_channel_id) if test_channel_id else None
        
        embed.add_field(name="Announcement Channel", value=channel.mention if channel else "⚠️ Not set", inline=False)
        embed.add_field(name="Test Channel", value=test_channel.mention if test_channel else "⚠️ Not set (will use announcement channel)", inline=False)
        
        # @everyone ping status
        use_everyone_ping = await self.config.guild(ctx.guild).use_everyone_ping()
        
        embed.add_field(
            name="Announcement Settings", 
            value=f"@everyone ping: {'✅ Enabled' if use_everyone_ping else '❌ Disabled'}",
            inline=False
        )
        
        embed.add_field(
            name="Confirmation Mode", 
            value=f"{'✅ Enabled' if require_confirmation else '❌ Disabled'}" + 
                  (f"\nAdmin: {admin_user.mention}" if admin_user else "\n⚠️ No admin set" if require_confirmation else "") +
                  (f"\nTimeout: {timeout//60} minutes" if require_confirmation else ""),
            inline=False
        )
        
        if pending:
            embed.add_field(
                name="⏳ Pending Announcement", 
                value=f"Type: {pending['type'].replace('_', ' ').title()}\nTheme: {pending['theme']}",
                inline=False
            )
        
        # Check for next week theme information
        next_week_theme = await self.config.guild(ctx.guild).next_week_theme()
        ai_endpoint = await self.config.guild(ctx.guild).ai_api_url()
        ai_key = await self.config.guild(ctx.guild).ai_api_key()
        ai_model = await self.config.guild(ctx.guild).ai_model() or "gpt-3.5-turbo"
        ai_temp = await self.config.guild(ctx.guild).ai_temperature() or 0.8
        ai_tokens = await self.config.guild(ctx.guild).ai_max_tokens() or 150
        ai_enabled = bool(ai_endpoint and ai_key)
        
        theme_status = "❌ No AI configuration"
        if ai_enabled:
            if next_week_theme:
                theme_status = f"✅ Ready: **{next_week_theme}**"
            else:
                theme_status = "⏳ Will be generated Sunday"
        
        # Team participation info
        team_count = await self._count_participating_teams(ctx.guild)
        min_teams = await self.config.guild(ctx.guild).min_teams_required()
        week_cancelled = await self.config.guild(ctx.guild).week_cancelled()
        submission_channel_id = await self.config.guild(ctx.guild).submission_channel()
        
        if submission_channel_id:
            submission_channel = ctx.guild.get_channel(submission_channel_id)
            sub_channel_text = submission_channel.mention if submission_channel else "❌ Channel not found"
        else:
            sub_channel_text = "⚠️ Not set (using announcement channel)"
        
        team_status_color = "✅" if team_count >= min_teams else "❌"
        team_status_text = f"{team_status_color} **{team_count}** / **{min_teams}** teams"
        
        if week_cancelled:
            team_status_text += "\n⚠️ **Week was cancelled** (insufficient teams)"
        
        # Validation status
        validate_enabled = await self.config.guild(ctx.guild).validate_discord_submissions()
        validation_text = f"Validation: {'✅ Enabled' if validate_enabled else '❌ Disabled'}"
        
        embed.add_field(
            name="📊 Team Participation",
            value=f"{team_status_text}\nSubmission channel: {sub_channel_text}\n{validation_text}",
            inline=False
        )
        
        embed.add_field(
            name="🎨 Next Week Theme",
            value=theme_status,
            inline=False
        )
        
        embed.add_field(
            name="🤖 AI Configuration",
            value=(f"Status: {'✅ Configured' if ai_enabled else '❌ Not configured'}\n" +
                   (f"Model: **{ai_model}**\nTemperature: **{ai_temp}**\nMax Tokens: **{ai_tokens}**" if ai_enabled else "Use `[p]cw setai` to configure")),
            inline=False
        )
        
        # Rep rewards configuration
        admin_channel_id = await self.config.guild(ctx.guild).admin_channel()
        rep_amount = await self.config.guild(ctx.guild).rep_reward_amount()
        admin_channel = ctx.guild.get_channel(admin_channel_id) if admin_channel_id else None
        
        rep_status = "✅ Configured" if admin_channel and rep_amount > 0 else "❌ Not configured"
        rep_details = []
        if admin_channel:
            rep_details.append(f"Admin channel: {admin_channel.mention}")
        else:
            rep_details.append("Admin channel: ⚠️ Not set")
        
        rep_details.append(f"Reward amount: **{rep_amount} petals**" if rep_amount > 0 else "Rewards: **Disabled**")
        
        embed.add_field(
            name="🌸 Rep Rewards (AutoReputation)",
            value=f"Status: {rep_status}\n" + "\n".join(rep_details),
            inline=False
        )
        
        if last_announcement:
            embed.add_field(name="Last Announcement", value=f"`{last_announcement}`", inline=False)
        
        # Show next expected announcements
        next_events = []
        if expected_phase == "submission":
            if day <= 3:  # Monday to Thursday
                next_events.append("🔔 Submission reminder: Thursday evening")
            next_events.append("🔔 Voting starts: Friday noon")
        else:  # voting phase
            if day == 4 or day == 5:  # Friday or Saturday
                next_events.append("🔔 Voting reminder: Saturday evening") 
            next_events.append("🔔 Winner announcement: Sunday evening")
            next_events.append("🔔 New week starts: Monday morning")
        
        if next_events:
            embed.add_field(name="Upcoming Events", value="\n".join(next_events), inline=False)
        
        embed.add_field(
            name="🌐 Website",
            value="**https://collabwarz.soundgarden.app**\nSubmit songs, listen to tracks & vote!",
            inline=False
        )
        
        embed.set_footer(text=f"Current time: {now.strftime('%A, %H:%M UTC')}")
        
        await ctx.send(embed=embed)
    
    @collabwarz.command(name="info")
    async def show_info(self, ctx):
        """Show basic competition information and submission format (public access)"""
        current_theme = await self.config.guild(ctx.guild).current_theme()
        current_phase = await self.config.guild(ctx.guild).current_phase()
        
        embed = discord.Embed(
            title="🎵 Collab Warz - Competition Info",
            color=discord.Color.blue()
        )
        
        embed.add_field(
            name="📊 Current Status",
            value=(
                f"**Theme:** {current_theme}\n"
                f"**Phase:** {current_phase.title()}\n"
                f"**Website:** https://collabwarz.soundgarden.app"
            ),
            inline=False
        )
        
        embed.add_field(
            name="📋 How to Submit (Discord)",
            value=(
                "**In ONE message, include:**\n"
                "• `Team name: YourTeamName`\n"
                "• Tag your partner: `@username`\n"
                "• Your Suno.com link (only accepted format)\n\n"
                "**Example:**\n"
                "```\nTeam name: Sonic Wizards\n"
                "@john Check out our collab!\n"
                "https://suno.com/song/example123\n```"
            ),
            inline=False
        )
        
        embed.add_field(
            name="🌐 Website Features",
            value=(
                "**https://collabwarz.soundgarden.app**\n"
                "• 🎵 Submit songs via web form\n"
                "• 🎧 Listen to all submissions\n"
                "• 🗳️ Vote for your favorites\n"
                "• 📊 View live results & history\n"
                "• 📱 Mobile-friendly interface"
            ),
            inline=False
        )
        
        embed.add_field(
            name="📅 Weekly Schedule",
            value=(
                "**Monday:** New theme announced\n"
                "**Monday-Friday noon:** Submission phase\n"
                "**Friday noon-Sunday:** Voting phase\n"
                "**Sunday evening:** Results announced"
            ),
            inline=False
        )
        
        embed.set_footer(text="Use `[p]cw status` for detailed technical status")
        await ctx.send(embed=embed)
    
    @collabwarz.command(name="toggle")
    async def toggle_auto(self, ctx):
        """Toggle automatic announcements"""
        current = await self.config.guild(ctx.guild).auto_announce()
        await self.config.guild(ctx.guild).auto_announce.set(not current)
        
        status = "enabled" if not current else "disabled"
        await ctx.send(f"✅ Automatic announcements {status}")
    
    @collabwarz.command(name="schedule")
    async def show_schedule(self, ctx):
        """Show the weekly schedule for Collab Warz"""
        embed = discord.Embed(
            title="📅 Collab Warz Weekly Schedule",
            color=discord.Color.blue()
        )
        
        embed.add_field(
            name="🎵 Submission Phase",
            value="**Monday - Friday noon**\n• New theme announced Monday morning\n• Reminder Thursday evening\n• Deadline: Friday 12:00 UTC",
            inline=False
        )
        
        embed.add_field(
            name="🗳️ Voting Phase", 
            value="**Friday noon - Sunday**\n• Voting opens Friday noon\n• Reminder Saturday evening\n• Results: Sunday evening",
            inline=False
        )
        
        embed.add_field(
            name="🏆 Winner Announcement",
            value="**Sunday Evening**\n• Results announced after voting closes\n• Preparation for next week's theme",
            inline=False
        )
        
        await ctx.send(embed=embed)
    
    @collabwarz.command(name="reset")
    async def reset_cycle(self, ctx):
        """Reset the announcement cycle (admin only)"""
        await self.config.guild(ctx.guild).last_announcement.set(None)
        await self.config.guild(ctx.guild).winner_announced.set(False)
        
        # Determine current phase
        now = datetime.utcnow()
        day = now.weekday()
        expected_phase = "submission" if day <= 2 else "voting"
        await self.config.guild(ctx.guild).current_phase.set(expected_phase)
        
        await ctx.send(f"✅ Announcement cycle reset. Current phase: **{expected_phase}**")
    
    @collabwarz.command(name="nextweek")
    async def force_next_week(self, ctx, *, theme: str = None):
        """Force start the next week with optional new theme"""
        if theme:
            await self.config.guild(ctx.guild).current_theme.set(theme)
        
        # Reset for new week
        await self.config.guild(ctx.guild).last_announcement.set(None)
        await self.config.guild(ctx.guild).winner_announced.set(False)
        await self.config.guild(ctx.guild).current_phase.set("submission")
        
        current_theme = await self.config.guild(ctx.guild).current_theme()
        
        # Post new week announcement
        channel_id = await self.config.guild(ctx.guild).announcement_channel()
        if channel_id:
            channel = ctx.guild.get_channel(channel_id)
            if channel:
                await self._post_announcement(channel, ctx.guild, "submission_start", current_theme)
        
        await ctx.send(f"🎵 **New week started!**\nTheme: **{current_theme}**\nPhase: **Submission**")
    
    @collabwarz.command(name="pause")
    async def pause_competition(self, ctx, *, reason: str = None):
        """Pause the current competition temporarily"""
        await self.config.guild(ctx.guild).current_phase.set("paused")
        
        embed = discord.Embed(
            title="⏸️ Competition Paused",
            description="The competition has been temporarily paused by an admin.",
            color=discord.Color.orange()
        )
        
        if reason:
            embed.add_field(name="Reason", value=reason, inline=False)
        
        embed.add_field(
            name="What happens now?",
            value=(
                "• All submissions are temporarily blocked\n"
                "• Current progress is preserved\n"
                "• Use `[p]cw resume` to continue\n"
                "• Use `[p]cw setphase submission` to restart submissions"
            ),
            inline=False
        )
        
        await ctx.send(embed=embed)
    
    @collabwarz.command(name="resume")
    async def resume_competition(self, ctx):
        """Resume a paused competition"""
        current_phase = await self.config.guild(ctx.guild).current_phase()
        
        if current_phase != "paused":
            await ctx.send(f"❌ Competition is not paused (current phase: {current_phase})")
            return
        
        # Resume to submission phase by default
        await self.config.guild(ctx.guild).current_phase.set("submission")
        
        embed = discord.Embed(
            title="▶️ Competition Resumed",
            description="The competition has been resumed! Submissions are now open again.",
            color=discord.Color.green()
        )
        
        current_theme = await self.config.guild(ctx.guild).current_theme()
        if current_theme:
            embed.add_field(name="Current Theme", value=current_theme, inline=False)
        
        await ctx.send(embed=embed)
    
    @collabwarz.command(name="cancelweek")
    async def cancel_current_week(self, ctx, *, reason: str = None):
        """Cancel the current competition week"""
        await self.config.guild(ctx.guild).current_phase.set("cancelled")
        await self.config.guild(ctx.guild).week_cancelled.set(True)
        
        embed = discord.Embed(
            title="❌ Week Cancelled",
            description="This week's competition has been cancelled by an admin.",
            color=discord.Color.red()
        )
        
        if reason:
            embed.add_field(name="Reason", value=reason, inline=False)
        
        embed.add_field(
            name="What happens next?",
            value=(
                "• All submissions for this week are void\n"
                "• No voting will take place\n"
                "• Competition will restart next Monday\n"
                "• Use `[p]cw nextweek` to start a new week immediately"
            ),
            inline=False
        )
        
        await ctx.send(embed=embed)
    
    @collabwarz.command(name="endweek")
    async def end_current_week(self, ctx, *, message: str = None):
        """Manually end the current competition week"""
        await self.config.guild(ctx.guild).current_phase.set("ended")
        
        embed = discord.Embed(
            title="🏁 Week Ended",
            description="This week's competition has been manually ended by an admin.",
            color=discord.Color.blue()
        )
        
        if message:
            embed.add_field(name="Admin Message", value=message, inline=False)
        
        embed.add_field(
            name="What happens next?",
            value=(
                "• No more submissions or voting\n"
                "• Results are finalized\n"
                "• Use `[p]cw nextweek` to start a new competition\n"
                "• Winners can still be declared manually if needed"
            ),
            inline=False
        )
        
        await ctx.send(embed=embed)
    
    @collabwarz.command(name="test")
    async def test_announcements(self, ctx):
        """Test all announcement types in test channel"""
        # Try test channel first, fallback to announcement channel
        test_channel_id = await self.config.guild(ctx.guild).test_channel()
        announcement_channel_id = await self.config.guild(ctx.guild).announcement_channel()
        
        channel_id = test_channel_id or announcement_channel_id
        if not channel_id:
            await ctx.send("❌ Please set a test channel with `[p]cw settestchannel` or announcement channel with `[p]cw setchannel`")
            return
        
        channel = ctx.guild.get_channel(channel_id)
        if not channel:
            await ctx.send("❌ Test/announcement channel not found")
            return
        
        theme = await self.config.guild(ctx.guild).current_theme()
        
        # Indicate where tests will be posted
        channel_type = "test" if channel_id == test_channel_id else "announcement"
        await ctx.send(f"🧪 Testing all announcement types in {channel.mention} ({channel_type} channel)...")
        
        # Post test header
        test_header = discord.Embed(
            title="🧪 ANNOUNCEMENT TESTS",
            description="Testing all announcement types - ignore these messages",
            color=discord.Color.orange()
        )
        test_header.set_footer(text="Test Mode - SoundGarden's Collab Warz")
        await channel.send(embed=test_header)
        
        # Test each announcement type
        test_types = [
            ("submission_start", "Submission Start"),
            ("voting_start", "Voting Start"), 
            ("reminder", "Reminder (Wednesday deadline)"),
            ("winner", "Winner Announcement")
        ]
        
        for ann_type, description in test_types:
            try:
                deadline = "Wednesday 23:59" if "reminder" in ann_type else None
                # Force post to bypass confirmation for tests
                await self._test_post_announcement(channel, ctx.guild, ann_type, theme, deadline)
                await ctx.send(f"✅ {description} - Posted")
                await asyncio.sleep(2)  # Small delay between posts
            except Exception as e:
                await ctx.send(f"❌ {description} - Error: {e}")
        
        # Post test footer
        test_footer = discord.Embed(
            title="🧪 TESTS COMPLETE",
            description="All announcement tests finished",
            color=discord.Color.green()
        )
        await channel.send(embed=test_footer)
        
        await ctx.send("🧪 Test complete!")
    
    async def _test_post_announcement(self, channel, guild, announcement_type: str, theme: str, deadline: str = None):
        """Helper method to post test announcements (bypasses confirmation)"""
        try:
            announcement = await self.generate_announcement(guild, announcement_type, theme, deadline)
            
            embed = discord.Embed(
                description=announcement,
                color=discord.Color.orange()  # Different color for tests
            )
            embed.set_footer(text="🧪 TEST MODE - SoundGarden's Collab Warz")
            
            await channel.send(embed=embed)
            print(f"Posted TEST {announcement_type} announcement in {guild.name}")
            
        except Exception as e:
            print(f"Error posting test announcement in {guild.name}: {e}")
    
    @collabwarz.command(name="setadmin")
    async def set_admin(self, ctx, user: discord.Member = None):
        """Set the primary admin user for confirmation requests"""
        if user is None:
            user = ctx.author
        
        await self.config.guild(ctx.guild).admin_user_id.set(user.id)
        await ctx.send(f"✅ Primary admin set to {user.mention} for confirmation requests")
    
    @collabwarz.command(name="addadmin")
    async def add_admin(self, ctx, user: discord.Member):
        """Add a user to the additional admins list"""
        admin_ids = await self.config.guild(ctx.guild).admin_user_ids()
        
        if user.id in admin_ids:
            await ctx.send(f"❌ {user.mention} is already an admin")
            return
        
        admin_ids.append(user.id)
        await self.config.guild(ctx.guild).admin_user_ids.set(admin_ids)
        await ctx.send(f"✅ Added {user.mention} as an admin")
    
    @collabwarz.command(name="removeadmin")
    async def remove_admin(self, ctx, user: discord.Member):
        """Remove a user from the additional admins list"""
        admin_ids = await self.config.guild(ctx.guild).admin_user_ids()
        
        if user.id not in admin_ids:
            await ctx.send(f"❌ {user.mention} is not in the additional admins list")
            return
        
        admin_ids.remove(user.id)
        await self.config.guild(ctx.guild).admin_user_ids.set(admin_ids)
        await ctx.send(f"✅ Removed {user.mention} from admins list")
    
    @collabwarz.command(name="listadmins")
    async def list_admins(self, ctx):
        """List all configured admins"""
        # Get primary admin
        primary_admin_id = await self.config.guild(ctx.guild).admin_user_id()
        admin_ids = await self.config.guild(ctx.guild).admin_user_ids()
        
        embed = discord.Embed(
            title="🛡️ Bot Administrators",
            color=discord.Color.blue(),
            timestamp=datetime.utcnow()
        )
        
        # Primary admin
        if primary_admin_id:
            primary_admin = ctx.guild.get_member(primary_admin_id)
            if primary_admin:
                embed.add_field(
                    name="Primary Admin",
                    value=f"{primary_admin.mention} ({primary_admin.display_name})",
                    inline=False
                )
            else:
                embed.add_field(
                    name="Primary Admin",
                    value=f"<@{primary_admin_id}> (User not found)",
                    inline=False
                )
        else:
            embed.add_field(
                name="Primary Admin",
                value="Not set",
                inline=False
            )
        
        # Additional admins
        if admin_ids:
            admin_mentions = []
            for admin_id in admin_ids:
                admin = ctx.guild.get_member(admin_id)
                if admin:
                    admin_mentions.append(f"{admin.mention} ({admin.display_name})")
                else:
                    admin_mentions.append(f"<@{admin_id}> (User not found)")
            
            embed.add_field(
                name="Additional Admins",
                value="\n".join(admin_mentions) if admin_mentions else "None",
                inline=False
            )
        else:
            embed.add_field(
                name="Additional Admins", 
                value="None",
                inline=False
            )
        
        # Permission-based admins
        permission_admins = []
        for member in ctx.guild.members:
            if hasattr(member, 'guild_permissions') and (
                member.guild_permissions.administrator or 
                member.guild_permissions.manage_messages or
                member.guild_permissions.manage_guild
            ):
                if (member.id != primary_admin_id and 
                    member.id not in admin_ids and
                    not member.bot):
                    permission_admins.append(f"{member.mention} ({member.display_name})")
        
        if permission_admins:
            # Limit to first 10 to avoid embed limits
            if len(permission_admins) > 10:
                permission_admins = permission_admins[:10]
                permission_admins.append("... and more")
            
            embed.add_field(
                name="Permission-Based Admins",
                value="\n".join(permission_admins),
                inline=False
            )
        
        embed.set_footer(text="Users with Administrator, Manage Messages, or Manage Guild permissions also have admin access")
        await ctx.send(embed=embed)
    
    @collabwarz.command(name="adminstatus")
    async def admin_status(self, ctx, user: discord.Member = None):
        """Check if a user has admin access and how they got it"""
        if user is None:
            user = ctx.author
        
        is_admin = await self._is_user_admin(ctx.guild, user)
        
        embed = discord.Embed(
            title=f"🛡️ Admin Status: {user.display_name}",
            color=discord.Color.green() if is_admin else discord.Color.red(),
            timestamp=datetime.utcnow()
        )
        
        embed.add_field(
            name="Overall Status",
            value="✅ **HAS ADMIN ACCESS**" if is_admin else "❌ **NO ADMIN ACCESS**",
            inline=False
        )
        
        # Check each level
        primary_admin_id = await self.config.guild(ctx.guild).admin_user_id()
        admin_ids = await self.config.guild(ctx.guild).admin_user_ids()
        
        access_methods = []
        
        if primary_admin_id == user.id:
            access_methods.append("🔑 **Primary Admin** (receives confirmation DMs)")
        
        if user.id in admin_ids:
            access_methods.append("👥 **Additional Admin** (added via `addadmin` command)")
        
        if hasattr(user, 'guild_permissions'):
            perms = []
            if user.guild_permissions.administrator:
                perms.append("Administrator")
            if user.guild_permissions.manage_messages:
                perms.append("Manage Messages")
            if user.guild_permissions.manage_guild:
                perms.append("Manage Guild")
            
            if perms:
                access_methods.append(f"🛡️ **Discord Permissions**: {', '.join(perms)}")
        
        if access_methods:
            embed.add_field(
                name="Access Methods",
                value="\n".join(access_methods),
                inline=False
            )
        else:
            embed.add_field(
                name="Access Methods",
                value="None - User does not have admin access",
                inline=False
            )
        
        embed.add_field(
            name="Admin Capabilities",
            value="• Execute all bot commands\n• Bypass message moderation\n• Control competition phases\n• Manage API settings\n• Access admin web panel" if is_admin else "No admin capabilities",
            inline=False
        )
        
        await ctx.send(embed=embed)
    
    @collabwarz.command(name="settestchannel")
    async def set_test_channel(self, ctx, channel: discord.TextChannel):
        """Set the test channel for testing announcements"""
        await self.config.guild(ctx.guild).test_channel.set(channel.id)
        await ctx.send(f"✅ Test channel set to {channel.mention}")
    
    @collabwarz.command(name="timeout")
    async def set_confirmation_timeout(self, ctx, minutes: int):
        """Set confirmation timeout in minutes for non-submission announcements (default: 30)"""
        if minutes < 5 or minutes > 120:
            await ctx.send("❌ Timeout must be between 5 and 120 minutes")
            return
        
        await self.config.guild(ctx.guild).confirmation_timeout.set(minutes * 60)
        await ctx.send(f"✅ Confirmation timeout set to {minutes} minutes\n*Note: Submission start announcements use smart timeout (until Monday 9 AM UTC)*")
    
    @collabwarz.command(name="confirmation")
    async def toggle_confirmation(self, ctx):
        """Toggle confirmation requirement for announcements"""
        current = await self.config.guild(ctx.guild).require_confirmation()
        await self.config.guild(ctx.guild).require_confirmation.set(not current)
        
        status = "enabled" if not current else "disabled"
        
        if not current:
            admin_id = await self.config.guild(ctx.guild).admin_user_id()
            if not admin_id:
                await ctx.send(f"✅ Confirmation {status}, but no admin set. Use `[p]cw setadmin @user` to set one.")
            else:
                admin_user = ctx.guild.get_member(admin_id)
                await ctx.send(f"✅ Confirmation {status}. Admin: {admin_user.mention if admin_user else 'Unknown'}")
        else:
            await ctx.send(f"✅ Confirmation {status}. Announcements will post automatically.")
    
    @collabwarz.command(name="minteams")
    async def set_min_teams(self, ctx, count: int):
        """Set minimum number of teams required to start voting (default: 2)"""
        if count < 1 or count > 10:
            await ctx.send("❌ Minimum teams must be between 1 and 10")
            return
        
        await self.config.guild(ctx.guild).min_teams_required.set(count)
        await ctx.send(f"✅ Minimum teams required set to: **{count}**\nIf fewer than {count} teams submit by Friday noon, the week will be cancelled and restarted Monday.")
    
    @collabwarz.command(name="setsubmissionchannel")
    async def set_submission_channel(self, ctx, channel: discord.TextChannel):
        """Set the channel where submissions are posted for team counting"""
        await self.config.guild(ctx.guild).submission_channel.set(channel.id)
        await ctx.send(f"✅ Submission channel set to {channel.mention}\nThis channel will be monitored to count participating teams.")
    
    @collabwarz.command(name="countteams")
    async def count_teams_manual(self, ctx):
        """Manually count current participating teams"""
        # Get detailed breakdown for debugging
        week_key = await self._get_competition_week_key(ctx.guild)
        
        # Count Discord registered teams
        submitted_teams = await self.config.guild(ctx.guild).submitted_teams()
        discord_teams = set(submitted_teams.get(week_key, []))
        
        # Count web submissions  
        submissions = await self._get_submissions_safe(ctx.guild)
        web_teams = set(submissions.keys())
        
        # Count raw submissions if validation is disabled
        validate_enabled = await self.config.guild(ctx.guild).validate_discord_submissions()
        raw_count = 0
        if not validate_enabled:
            raw_count = await self._count_raw_submissions(ctx.guild)
        
        # Total unique teams
        all_teams = discord_teams.union(web_teams)
        team_count = max(len(all_teams), raw_count) if not validate_enabled else len(all_teams)
        
        min_teams = await self.config.guild(ctx.guild).min_teams_required()
        
        submission_channel_id = await self.config.guild(ctx.guild).submission_channel()
        if submission_channel_id:
            channel = ctx.guild.get_channel(submission_channel_id)
            channel_name = channel.mention if channel else "Unknown"
        else:
            channel_name = "⚠️ Not set (using announcement channel)"
        
        embed = discord.Embed(
            title="📊 Team Count Status",
            color=discord.Color.green() if team_count >= min_teams else discord.Color.red()
        )
        
        embed.add_field(
            name="📈 Total Teams",
            value=f"**{team_count}** teams found",
            inline=True
        )
        
        embed.add_field(
            name="🎯 Required",
            value=f"**{min_teams}** minimum",
            inline=True
        )
        
        embed.add_field(
            name="✅ Status",
            value="✅ Sufficient" if team_count >= min_teams else "❌ Insufficient",
            inline=True
        )
        
        # Breakdown
        breakdown_value = f"🤖 **Discord:** {len(discord_teams)} teams\n🌐 **Web:** {len(web_teams)} teams"
        if not validate_enabled and raw_count > 0:
            breakdown_value += f"\n📝 **Raw messages:** {raw_count}"
        
        embed.add_field(
            name="📊 Breakdown",
            value=breakdown_value,
            inline=False
        )
        
        embed.add_field(
            name="📍 Submission Channel",
            value=channel_name,
            inline=False
        )
        
        embed.set_footer(text=f"Week: {week_key} • Validation: {'ON' if validate_enabled else 'OFF'}")
        
        await ctx.send(embed=embed)
    
    @collabwarz.command(name="togglevalidation")
    async def toggle_submission_validation(self, ctx):
        """Toggle Discord submission validation on/off"""
        current = await self.config.guild(ctx.guild).validate_discord_submissions()
        await self.config.guild(ctx.guild).validate_discord_submissions.set(not current)
        
        status = "enabled" if not current else "disabled"
        
        embed = discord.Embed(
            title="🔍 Submission Validation",
            color=discord.Color.green() if not current else discord.Color.red()
        )
        
        if not current:
            embed.description = (
                "✅ **Discord submission validation ENABLED**\n\n"
                "Users must include:\n"
                "• `Team name: YourTeamName`\n"
                "• @mention of their partner\n"
                "• Suno.com link (only accepted format)\n\n"
                "Invalid submissions will receive error messages."
            )
        else:
            embed.description = (
                "❌ **Discord submission validation DISABLED**\n\n"
                "All submissions will be accepted without validation.\n"
                "Team counting will use raw message detection."
            )
        
        await ctx.send(embed=embed)
    
    @collabwarz.command(name="autodeletemsgs")
    async def toggle_auto_delete_messages(self, ctx):
        """Toggle automatic deletion of invalid messages on/off"""
        current = await self.config.guild(ctx.guild).auto_delete_messages()
        await self.config.guild(ctx.guild).auto_delete_messages.set(not current)
        
        status = "enabled" if not current else "disabled"
        
        embed = discord.Embed(
            title="🗑️ Auto-Delete Messages",
            color=discord.Color.green() if not current else discord.Color.red()
        )
        
        if not current:
            embed.description = (
                "✅ **Automatic message deletion ENABLED**\n\n"
                "**Bot will delete:**\n"
                "• Invalid submissions with error explanation\n"
                "• Messages when bot is inactive\n" 
                "• Messages during wrong phases\n"
                "• Non-submission messages in submission channel\n\n"
                "**Admins are always exempt from deletion.**"
            )
        else:
            embed.description = (
                "❌ **Automatic message deletion DISABLED**\n\n"
                "**Bot will only:**\n"
                "• Send warning messages (no deletion)\n"
                "• React to valid submissions\n"
                "• Allow all messages to remain\n\n"
                "**Useful for debugging or less restrictive moderation.**"
            )
        
        await ctx.send(embed=embed)
    
    @collabwarz.command(name="listteams")
    async def list_current_teams(self, ctx):
        """List all registered teams for current competition cycle"""
        week_key = await self._get_competition_week_key(ctx.guild)
        submitted_teams = await self.config.guild(ctx.guild).submitted_teams()
        team_members = await self.config.guild(ctx.guild).team_members()
        
        week_teams = submitted_teams.get(week_key, [])
        week_members = team_members.get(week_key, {})
        
        embed = discord.Embed(
            title=f"📋 Registered Teams - {week_key}",
            color=discord.Color.blue()
        )
        
        if not week_teams:
            embed.description = "No teams registered yet this week."
        else:
            team_list = []
            for team_name in week_teams:
                if team_name in week_members:
                    members = week_members[team_name]
                    member_mentions = []
                    for user_id in members:
                        user = ctx.guild.get_member(user_id)
                        member_mentions.append(user.mention if user else f"<@{user_id}>")
                    team_list.append(f"**{team_name}**: {' & '.join(member_mentions)}")
                else:
                    team_list.append(f"**{team_name}**: Members unknown")
            
            embed.description = "\n".join(team_list)
        
        embed.set_footer(text=f"Total: {len(week_teams)} teams")
        await ctx.send(embed=embed)
    
    @collabwarz.command(name="clearteams")
    async def clear_week_teams(self, ctx, week: str = None):
        """Clear team registrations for specified competition cycle (or current cycle) - ADMIN USE ONLY"""
        if week is None:
            week = await self._get_competition_week_key(ctx.guild)
        
        # Show warning about permanent deletion
        embed = discord.Embed(
            title="⚠️ Clear Team Registrations",
            description=f"This will **permanently delete** all team registrations for `{week}`.\n\n"
                       f"**This action cannot be undone and will affect historical data!**",
            color=discord.Color.red()
        )
        
        submitted_teams = await self.config.guild(ctx.guild).submitted_teams()
        team_members = await self.config.guild(ctx.guild).team_members()
        
        week_teams = submitted_teams.get(week, [])
        if week_teams:
            embed.add_field(
                name=f"Teams to be deleted ({len(week_teams)})",
                value=", ".join(f"`{team}`" for team in week_teams[:10]) + 
                      (f"\n... and {len(week_teams) - 10} more" if len(week_teams) > 10 else ""),
                inline=False
            )
        else:
            embed.add_field(name="No teams found", value=f"Week `{week}` has no registered teams.", inline=False)
            await ctx.send(embed=embed)
            return
        
        embed.set_footer(text="React with ✅ to confirm deletion or ❌ to cancel")
        
        message = await ctx.send(embed=embed)
        await message.add_reaction("✅")
        await message.add_reaction("❌")
        
        def check(reaction, user):
            return (user == ctx.author and 
                   reaction.message.id == message.id and 
                   str(reaction.emoji) in ["✅", "❌"])
        
        try:
            reaction, user = await self.bot.wait_for('reaction_add', timeout=30.0, check=check)
            
            if str(reaction.emoji) == "✅":
                # Proceed with deletion
                if week in submitted_teams:
                    del submitted_teams[week]
                    await self.config.guild(ctx.guild).submitted_teams.set(submitted_teams)
                
                if week in team_members:
                    del team_members[week]
                    await self.config.guild(ctx.guild).team_members.set(team_members)
                
                await message.edit(embed=discord.Embed(
                    title="✅ Teams Cleared",
                    description=f"Successfully deleted all team registrations for week `{week}`",
                    color=discord.Color.green()
                ))
            else:
                await message.edit(embed=discord.Embed(
                    title="❌ Cancelled", 
                    description="Team clearing operation cancelled.",
                    color=discord.Color.gray()
                ))
                
        except asyncio.TimeoutError:
            await message.edit(embed=discord.Embed(
                title="⏰ Timeout",
                description="Operation timed out. No teams were cleared.",
                color=discord.Color.gray()
            ))
    
    @collabwarz.command(name="history")
    async def show_team_history(self, ctx, weeks: int = 4):
        """Show team participation history for recent weeks"""
        if weeks < 1 or weeks > 20:
            await ctx.send("❌ Number of weeks must be between 1 and 20")
            return
        
        submitted_teams = await self.config.guild(ctx.guild).submitted_teams()
        team_members = await self.config.guild(ctx.guild).team_members()
        
        if not submitted_teams:
            await ctx.send("📊 No team history available yet.")
            return
        
        # Get recent weeks (sorted by week key)
        all_weeks = sorted(submitted_teams.keys(), reverse=True)
        recent_weeks = all_weeks[:weeks]
        
        embed = discord.Embed(
            title="📊 Team Participation History",
            color=discord.Color.blue()
        )
        
        if not recent_weeks:
            embed.description = "No team data found for recent weeks."
            await ctx.send(embed=embed)
            return
        
        for week in recent_weeks:
            week_teams = submitted_teams.get(week, [])
            week_members = team_members.get(week, {})
            
            if not week_teams:
                embed.add_field(
                    name=f"Week {week}",
                    value="No teams registered",
                    inline=False
                )
                continue
            
            team_details = []
            for team_name in week_teams:
                if team_name in week_members:
                    members = week_members[team_name]
                    member_mentions = []
                    for user_id in members:
                        user = ctx.guild.get_member(user_id)
                        if user:
                            member_mentions.append(user.display_name)
                        else:
                            member_mentions.append(f"User-{user_id}")
                    
                    team_details.append(f"**{team_name}**: {' & '.join(member_mentions)}")
                else:
                    team_details.append(f"**{team_name}**: Members unknown")
            
            # Limit to first 8 teams per week for display
            if len(team_details) > 8:
                displayed_teams = team_details[:8]
                displayed_teams.append(f"... and {len(team_details) - 8} more teams")
            else:
                displayed_teams = team_details
            
            embed.add_field(
                name=f"Week {week} ({len(week_teams)} teams)",
                value="\n".join(displayed_teams) if displayed_teams else "No teams",
                inline=False
            )
        
        # Add summary statistics
        total_weeks = len(all_weeks)
        total_teams = sum(len(teams) for teams in submitted_teams.values())
        avg_teams = total_teams / total_weeks if total_weeks > 0 else 0
        
        embed.set_footer(text=f"Total: {total_weeks} weeks recorded • {total_teams} total teams • {avg_teams:.1f} avg teams/week")
        
        await ctx.send(embed=embed)
    
    @collabwarz.command(name="teamstats") 
    async def show_team_statistics(self, ctx, user: discord.Member = None):
        """Show participation statistics for a user or server overview"""
        submitted_teams = await self.config.guild(ctx.guild).submitted_teams()
        team_members = await self.config.guild(ctx.guild).team_members()
        
        if not submitted_teams:
            await ctx.send("📊 No team data available yet.")
            return
        
        if user:
            # Individual user stats
            user_teams = []
            for week, week_data in team_members.items():
                for team_name, members in week_data.items():
                    if user.id in members:
                        # Find partner
                        partner_id = next((mid for mid in members if mid != user.id), None)
                        partner = ctx.guild.get_member(partner_id) if partner_id else None
                        partner_name = partner.display_name if partner else "Unknown"
                        
                        user_teams.append({
                            "week": week,
                            "team": team_name,
                            "partner": partner_name
                        })
            
            embed = discord.Embed(
                title=f"📊 Participation Stats: {user.display_name}",
                color=discord.Color.green()
            )
            
            if not user_teams:
                embed.description = f"{user.mention} hasn't participated in any registered teams yet."
            else:
                # Sort by week (most recent first)
                user_teams.sort(key=lambda x: x["week"], reverse=True)
                
                team_list = []
                for entry in user_teams[:10]:  # Show last 10 participations
                    team_list.append(f"**{entry['week']}**: `{entry['team']}` (with {entry['partner']})")
                
                if len(user_teams) > 10:
                    team_list.append(f"... and {len(user_teams) - 10} more")
                
                embed.description = "\n".join(team_list)
                embed.add_field(
                    name="Summary",
                    value=f"Total participations: **{len(user_teams)}**",
                    inline=False
                )
            
        else:
            # Server overview stats
            embed = discord.Embed(
                title="📊 Server Participation Statistics",
                color=discord.Color.blue()
            )
            
            # Count unique participants
            all_participants = set()
            for week_data in team_members.values():
                for members in week_data.values():
                    all_participants.update(members)
            
            # Most active participants
            participant_counts = {}
            for week_data in team_members.values():
                for members in week_data.values():
                    for user_id in members:
                        participant_counts[user_id] = participant_counts.get(user_id, 0) + 1
            
            # Sort by participation count
            top_participants = sorted(participant_counts.items(), key=lambda x: x[1], reverse=True)
            
            # Total stats
            total_weeks = len(submitted_teams)
            total_teams = sum(len(teams) for teams in submitted_teams.values())
            total_participants = len(all_participants)
            
            embed.add_field(
                name="Overall Statistics",
                value=f"**{total_weeks}** weeks recorded\n**{total_teams}** total teams\n**{total_participants}** unique participants",
                inline=True
            )
            
            if top_participants:
                top_5 = []
                for user_id, count in top_participants[:5]:
                    user = ctx.guild.get_member(user_id)
                    name = user.display_name if user else f"User-{user_id}"
                    top_5.append(f"**{name}**: {count} teams")
                
                embed.add_field(
                    name="Most Active (Top 5)",
                    value="\n".join(top_5),
                    inline=True
                )
        
        await ctx.send(embed=embed)
    
    @collabwarz.command(name="searchteams")
    async def search_teams(self, ctx, *, query: str):
        """Search for teams by name or member"""
        if len(query) < 2:
            await ctx.send("❌ Search query must be at least 2 characters long")
            return
        
        submitted_teams = await self.config.guild(ctx.guild).submitted_teams()
        team_members = await self.config.guild(ctx.guild).team_members()
        
        if not submitted_teams:
            await ctx.send("📊 No team data available to search.")
            return
        
        query_lower = query.lower()
        matches = []
        
        # Search through all weeks
        for week in sorted(submitted_teams.keys(), reverse=True):
            week_teams = submitted_teams.get(week, [])
            week_members = team_members.get(week, {})
            
            for team_name in week_teams:
                # Check if query matches team name
                team_matches = query_lower in team_name.lower()
                
                # Check if query matches any member name
                member_matches = False
                if team_name in week_members:
                    for user_id in week_members[team_name]:
                        user = ctx.guild.get_member(user_id)
                        if user and (query_lower in user.display_name.lower() or 
                                   query_lower in user.name.lower()):
                            member_matches = True
                            break
                
                if team_matches or member_matches:
                    # Get member details
                    if team_name in week_members:
                        members = week_members[team_name]
                        member_names = []
                        for user_id in members:
                            user = ctx.guild.get_member(user_id)
                            member_names.append(user.display_name if user else f"User-{user_id}")
                        member_info = " & ".join(member_names)
                    else:
                        member_info = "Members unknown"
                    
                    matches.append({
                        "week": week,
                        "team": team_name,
                        "members": member_info,
                        "match_type": "team name" if team_matches else "member"
                    })
        
        embed = discord.Embed(
            title=f"🔍 Search Results for '{query}'",
            color=discord.Color.purple()
        )
        
        if not matches:
            embed.description = f"No teams found matching '{query}'"
            embed.add_field(
                name="💡 Search Tips",
                value="• Try partial names or nicknames\n• Search is case-insensitive\n• Searches both team names and member names",
                inline=False
            )
        else:
            # Group by week for better display
            results_by_week = {}
            for match in matches:
                week = match["week"]
                if week not in results_by_week:
                    results_by_week[week] = []
                results_by_week[week].append(match)
            
            result_lines = []
            for week in sorted(results_by_week.keys(), reverse=True)[:10]:  # Show max 10 weeks
                week_matches = results_by_week[week]
                for match in week_matches[:5]:  # Max 5 teams per week
                    match_indicator = "📋" if match["match_type"] == "team name" else "👤"
                    result_lines.append(f"{match_indicator} **{week}**: `{match['team']}` ({match['members']})")
                
                if len(week_matches) > 5:
                    result_lines.append(f"   ... and {len(week_matches) - 5} more in {week}")
            
            if len(matches) > 50:  # If too many results, show count
                result_lines.append(f"\n*... showing first 50 of {len(matches)} total matches*")
            
            embed.description = "\n".join(result_lines[:20])  # Limit description length
            
            embed.add_field(
                name="Legend",
                value="📋 = Team name match • 👤 = Member name match",
                inline=False
            )
        
        embed.set_footer(text=f"Found {len(matches)} total matches")
        await ctx.send(embed=embed)
    
    @collabwarz.command(name="setadminchannel")
    async def set_admin_channel(self, ctx, channel: discord.TextChannel):
        """[DEPRECATED] This command is no longer needed with AutoReputation cog"""
        
        embed = discord.Embed(
            title="⚠️ Deprecated Command",
            description=(
                "This command is no longer needed!\n\n"
                "The bot now uses the **AutoReputation cog** for reputation management, "
                "which doesn't require a separate admin channel.\n\n"
                "Rep rewards are given directly through internal API calls."
            ),
            color=discord.Color.orange()
        )
        
        embed.add_field(
            name="How It Works Now",
            value=(
                "✅ Winners automatically receive petals via AutoReputation cog\n"
                "✅ No channel configuration needed\n"
                "✅ Instant, reliable reputation updates\n"
                "✅ Use `[p]cw setrepamount` to configure reward amounts"
            ),
            inline=False
        )
        
        embed.set_footer(text="AutoReputation cog must be loaded for rep rewards to work")
        await ctx.send(embed=embed)
    
    @collabwarz.command(name="setrepamount")
    async def set_rep_amount(self, ctx, amount: int):
        """Set the amount of rep points given to winners (default: 2)"""
        if amount < 0 or amount > 50:
            await ctx.send("❌ Rep amount must be between 0 and 50")
            return
        
        await self.config.guild(ctx.guild).rep_reward_amount.set(amount)
        
        if amount == 0:
            await ctx.send("⚠️ Rep rewards **disabled** - winners will receive 0 petals")
        else:
            await ctx.send(f"✅ Rep reward amount set to **{amount} petals** per winner")
    
    @collabwarz.command(name="checkvotes")
    async def check_votes(self, ctx):
        """Manually check current voting results and determine winner"""
        winning_teams, is_tie, vote_counts = await self._determine_winners(ctx.guild)
        
        embed = discord.Embed(
            title="🗳️ Current Voting Results",
            color=discord.Color.blue()
        )
        
        week = self._get_current_week()
        embed.add_field(
            name="Week",
            value=week,
            inline=True
        )
        
        if not vote_counts:
            embed.color = discord.Color.red()
            embed.description = "❌ No voting data available"
            await ctx.send(embed=embed)
            return
        
        # Show all vote counts
        vote_lines = []
        for team, votes in sorted(vote_counts.items(), key=lambda x: x[1], reverse=True):
            if team in winning_teams:
                vote_lines.append(f"🏆 **{team}**: {votes} votes")
            else:
                vote_lines.append(f"• **{team}**: {votes} votes")
        
        embed.add_field(
            name="Vote Counts",
            value="\n".join(vote_lines),
            inline=False
        )
        
        if is_tie:
            embed.color = discord.Color.orange()
            embed.add_field(
                name="⚔️ TIE DETECTED",
                value=f"**Tied teams:** {', '.join(winning_teams)}\nA face-off would be required!",
                inline=False
            )
        elif winning_teams:
            embed.color = discord.Color.gold()
            embed.add_field(
                name="🏆 Clear Winner",
                value=f"**Winner:** {winning_teams[0]}",
                inline=False
            )
        
        # Check if face-off is active
        face_off_active = await self.config.guild(ctx.guild).face_off_active()
        if face_off_active:
            face_off_teams = await self.config.guild(ctx.guild).face_off_teams()
            face_off_deadline_str = await self.config.guild(ctx.guild).face_off_deadline()
            
            if face_off_deadline_str:
                face_off_deadline = datetime.fromisoformat(face_off_deadline_str)
                
                embed.add_field(
                    name="⚔️ Active Face-Off",
                    value=(
                        f"**Teams:** {', '.join(face_off_teams)}\n"
                        f"**Deadline:** {self._create_discord_timestamp(face_off_deadline)}"
                    ),
                    inline=False
                )
        
        await ctx.send(embed=embed)
    
    @collabwarz.command(name="votestats")
    async def vote_statistics(self, ctx):
        """Show detailed voting statistics and detect potential issues (Admin only)"""
        if not await self._is_admin(ctx.author, ctx.guild):
            await ctx.send("❌ This command requires admin privileges.")
            return
        
        # Get current votes data
        all_votes = await self.config.guild(ctx.guild).votes()
        individual_votes = await self.config.guild(ctx.guild).individual_votes()
        current_phase = await self.config.guild(ctx.guild).current_phase()
        
        if current_phase != "voting":
            await ctx.send("⚠️ Voting phase is not currently active.")
            return
        
        # Calculate voting statistics
        total_votes = sum(all_votes.values())
        unique_voters = len(individual_votes)
        
        # Detect potential issues
        issues = []
        
        # Check for users who voted multiple times (should be prevented now)
        multiple_voters = {user_id: votes for user_id, votes in individual_votes.items() if len(votes) > 1}
        if multiple_voters:
            issues.append(f"🚨 **Multiple votes detected:** {len(multiple_voters)} users voted more than once")
        
        # Check for votes without guild membership verification
        non_member_votes = []
        for user_id, votes in individual_votes.items():
            try:
                member = ctx.guild.get_member(int(user_id))
                if not member:
                    non_member_votes.append(user_id)
            except:
                non_member_votes.append(user_id)
        
        if non_member_votes:
            issues.append(f"⚠️ **Non-member votes:** {len(non_member_votes)} votes from users not in the server")
        
        # Create detailed embed
        embed = discord.Embed(
            title="📊 Vote Statistics & Security Report",
            color=discord.Color.blue(),
            timestamp=datetime.now()
        )
        
        # Basic statistics
        embed.add_field(
            name="📈 Basic Statistics",
            value=(
                f"**Total Votes:** {total_votes}\n"
                f"**Unique Voters:** {unique_voters}\n"
                f"**Teams Voted For:** {len(all_votes)}"
            ),
            inline=False
        )
        
        # Vote breakdown by team
        if all_votes:
            vote_breakdown = "\n".join([f"**{team}:** {votes} votes" for team, votes in sorted(all_votes.items(), key=lambda x: x[1], reverse=True)])
            embed.add_field(
                name="🏆 Vote Breakdown",
                value=vote_breakdown,
                inline=False
            )
        
        # Security issues
        if issues:
            embed.add_field(
                name="🔒 Security Issues",
                value="\n".join(issues),
                inline=False
            )
        else:
            embed.add_field(
                name="✅ Security Status",
                value="No security issues detected",
                inline=False
            )
        
        # Voting pattern analysis
        if individual_votes:
            vote_times = []
            for user_votes in individual_votes.values():
                vote_times.extend(user_votes)
            
            if vote_times:
                embed.add_field(
                    name="📊 Voting Activity",
                    value=f"**Most Recent Vote:** <t:{max(vote_times)}:R>\n**First Vote:** <t:{min(vote_times)}:R>",
                    inline=False
                )
        
        embed.set_footer(text="Use this information to monitor vote integrity")
        await ctx.send(embed=embed)
        
        # Send detailed breakdown to admin if there are issues
        if multiple_voters:
            detail_msg = "**Users with multiple votes:**\n"
            for user_id, votes in list(multiple_voters.items())[:10]:  # Limit to first 10
                try:
                    user = self.bot.get_user(int(user_id))
                    user_name = user.display_name if user else f"User ID: {user_id}"
                    vote_times = [f"<t:{vote_time}:f>" for vote_time in votes]
                    detail_msg += f"• {user_name}: {len(votes)} votes ({', '.join(vote_times)})\n"
                except:
                    detail_msg += f"• User ID {user_id}: {len(votes)} votes\n"
            
            if len(multiple_voters) > 10:
                detail_msg += f"... and {len(multiple_voters) - 10} more users"
            
            await ctx.send(f"```\n{detail_msg}\n```")
    
    @collabwarz.command(name="clearvotes")
    async def clear_fraudulent_votes(self, ctx, user_id: str = None):
        """Remove duplicate/fraudulent votes (Admin only)"""
        if not await self._is_admin(ctx.author, ctx.guild):
            await ctx.send("❌ This command requires admin privileges.")
            return
        
        current_phase = await self.config.guild(ctx.guild).current_phase()
        if current_phase != "voting":
            await ctx.send("⚠️ Voting phase is not currently active.")
            return
        
        individual_votes = await self.config.guild(ctx.guild).individual_votes()
        all_votes = await self.config.guild(ctx.guild).votes()
        
        if user_id:
            # Clear votes for specific user
            if user_id in individual_votes:
                user_vote_count = len(individual_votes[user_id])
                if user_vote_count > 1:
                    # Find which team this user voted for (from their first vote)
                    user_votes_data = individual_votes[user_id]
                    # We need to determine which team they voted for
                    # This is tricky since we only store timestamps
                    # We'll remove all their votes and let them vote again
                    del individual_votes[user_id]
                    
                    # We need to subtract the extra votes from team totals
                    # Since we can't easily determine which team, we'll ask admin to specify
                    await ctx.send(f"⚠️ **Manual correction needed:**\n"
                                 f"User <@{user_id}> had {user_vote_count} votes.\n"
                                 f"Please manually adjust team vote counts using `!collabwarz adjustvotes <team> <amount>`")
                else:
                    await ctx.send(f"✅ User <@{user_id}> only has {user_vote_count} vote (no duplicates).")
            else:
                await ctx.send(f"❌ User <@{user_id}> has no votes recorded.")
        else:
            # Clean all duplicate votes
            cleaned_count = 0
            total_removed = 0
            
            for uid, votes in list(individual_votes.items()):
                if len(votes) > 1:
                    cleaned_count += 1
                    excess_votes = len(votes) - 1
                    total_removed += excess_votes
                    # Keep only the first vote
                    individual_votes[uid] = [votes[0]]
            
            if cleaned_count > 0:
                await ctx.send(f"🧹 **Cleaned duplicate votes:**\n"
                             f"• {cleaned_count} users had duplicate votes\n"
                             f"• {total_removed} excess votes removed\n"
                             f"⚠️ **Manual correction needed:** Please review team vote totals and adjust if necessary.")
            else:
                await ctx.send("✅ No duplicate votes found.")
        
        # Save updated individual votes
        await self.config.guild(ctx.guild).individual_votes.set(individual_votes)
    
    @collabwarz.command(name="adjustvotes")
    async def adjust_team_votes(self, ctx, team_name: str, adjustment: int):
        """Manually adjust vote count for a team (Admin only)"""
        if not await self._is_admin(ctx.author, ctx.guild):
            await ctx.send("❌ This command requires admin privileges.")
            return
        
        current_phase = await self.config.guild(ctx.guild).current_phase()
        if current_phase != "voting":
            await ctx.send("⚠️ Voting phase is not currently active.")
            return
        
        all_votes = await self.config.guild(ctx.guild).votes()
        
        # Find team (case insensitive)
        actual_team = None
        for team in all_votes:
            if team.lower() == team_name.lower():
                actual_team = team
                break
        
        if not actual_team:
            await ctx.send(f"❌ Team '{team_name}' not found. Available teams: {', '.join(all_votes.keys())}")
            return
        
        old_count = all_votes[actual_team]
        new_count = max(0, old_count + adjustment)  # Don't allow negative votes
        all_votes[actual_team] = new_count
        
        await self.config.guild(ctx.guild).votes.set(all_votes)
        
        embed = discord.Embed(
            title="📊 Vote Count Adjusted",
            color=discord.Color.orange(),
            timestamp=datetime.now()
        )
        embed.add_field(
            name="Team",
            value=actual_team,
            inline=True
        )
        embed.add_field(
            name="Previous Count",
            value=str(old_count),
            inline=True
        )
        embed.add_field(
            name="New Count",
            value=str(new_count),
            inline=True
        )
        embed.add_field(
            name="Adjustment",
            value=f"{adjustment:+d}",
            inline=True
        )
        embed.set_footer(text=f"Adjusted by {ctx.author.display_name}")
        
        await ctx.send(embed=embed)
    
    @collabwarz.command(name="sessionauth")
    async def session_auth_config(self, ctx, action: str = "status"):
        """Configure Discord session token authentication (Admin only)"""
        if not await self._is_admin(ctx.author, ctx.guild):
            await ctx.send("❌ This command requires admin privileges.")
            return
        
        action = action.lower()
        
        if action == "status":
            session_required = await self.config.guild(ctx.guild).session_token_required()
            
            embed = discord.Embed(
                title="🔐 Session Authentication Status",
                color=discord.Color.blue() if session_required else discord.Color.orange(),
                timestamp=datetime.now()
            )
            
            embed.add_field(
                name="Current Status",
                value=f"{'🔒 **ENABLED**' if session_required else '⚠️ **DISABLED**'}\n"
                      f"{'Votes require Discord session tokens' if session_required else 'Anyone can submit votes via API'}",
                inline=False
            )
            
            embed.add_field(
                name="Security Level",
                value=f"{'✅ **HIGH SECURITY**' if session_required else '🔓 **BASIC SECURITY**'}\n"
                      f"{'Web interface OAuth required' if session_required else 'Only guild membership checked'}",
                inline=False
            )
            
            embed.add_field(
                name="Commands",
                value="```\n"
                      "[p]cw sessionauth enable    # Require session tokens\n"
                      "[p]cw sessionauth disable   # Allow direct API access\n"
                      "[p]cw sessionauth status    # Show current status\n"
                      "```",
                inline=False
            )
            
            await ctx.send(embed=embed)
            
        elif action == "enable":
            await self.config.guild(ctx.guild).session_token_required.set(True)
            await ctx.send("🔒 **Session authentication ENABLED**\n"
                          "✅ Votes now require Discord session tokens\n"
                          "⚠️ **Note**: Frontend must handle Discord OAuth")
            
        elif action == "disable":
            await self.config.guild(ctx.guild).session_token_required.set(False)
            await ctx.send("⚠️ **Session authentication DISABLED**\n"
                          "🔓 Anyone can vote via direct API calls\n"
                          "💡 **Recommendation**: Only disable for testing")
            
        else:
            await ctx.send("❌ Valid actions: `enable`, `disable`, `status`")
    
    @collabwarz.command(name="apiserver")
    async def api_server_control(self, ctx, action: str = "status"):
        """Control the API server for member list (start/stop/status)"""
        action = action.lower()
        
        if action not in ["start", "stop", "status"]:
            await ctx.send("❌ Valid actions: `start`, `stop`, `status`")
            return
        
        if action == "status":
            api_enabled = await self.config.guild(ctx.guild).api_server_enabled()
            port = await self.config.guild(ctx.guild).api_server_port()
            host = await self.config.guild(ctx.guild).api_server_host()
            token = await self.config.guild(ctx.guild).api_access_token()
            
            embed = discord.Embed(
                title="🌐 API Server Status",
                color=discord.Color.green() if api_enabled else discord.Color.red()
            )
            
            embed.add_field(
                name="Status",
                value="🟢 Running" if api_enabled else "🔴 Stopped",
                inline=True
            )
            
            embed.add_field(
                name="Address",
                value=f"`{host}:{port}`",
                inline=True
            )
            
            embed.add_field(
                name="Authentication",
                value="🔐 Token required" if token else "🔓 No authentication",
                inline=True
            )
            
            if api_enabled:
                embed.add_field(
                    name="Endpoints",
                    value=f"`GET {host}:{port}/api/members` - Guild members list",
                    inline=False
                )
                
                embed.add_field(
                    name="Usage Example",
                    value=(
                        f"```bash\n"
                        f"curl -H \"Authorization: Bearer YOUR_TOKEN\" \\\n"
                        f"     http://{host}:{port}/api/members\n"
                        f"```"
                    ),
                    inline=False
                )
            
            await ctx.send(embed=embed)
            
        elif action == "start":
            await self.config.guild(ctx.guild).api_server_enabled.set(True)
            
            # Start the API server task
            asyncio.create_task(self._start_api_server_task(ctx.guild))
            
            port = await self.config.guild(ctx.guild).api_server_port()
            host = await self.config.guild(ctx.guild).api_server_host()
            
            embed = discord.Embed(
                title="🚀 API Server Started",
                description=f"Member list API is now running on `{host}:{port}`",
                color=discord.Color.green()
            )
            
            embed.add_field(
                name="Available Endpoint",
                value=f"`GET /api/members` - Returns guild member list",
                inline=False
            )
            
            await ctx.send(embed=embed)
            
        elif action == "stop":
            await self.config.guild(ctx.guild).api_server_enabled.set(False)
            
            embed = discord.Embed(
                title="🛑 API Server Stopped",
                description="Member list API has been disabled",
                color=discord.Color.red()
            )
            
            await ctx.send(embed=embed)
    
    @collabwarz.command(name="apiconfig")
    async def api_config(self, ctx, setting: str = None, *, value: str = None):
        """Configure API server settings (port/host/token/cors)"""
        
        if not setting:
            # Show current configuration
            port = await self.config.guild(ctx.guild).api_server_port()
            host = await self.config.guild(ctx.guild).api_server_host()
            token = await self.config.guild(ctx.guild).api_access_token()
            cors_origins = await self.config.guild(ctx.guild).cors_origins()
            
            embed = discord.Embed(
                title="⚙️ API Server Configuration",
                color=discord.Color.blue()
            )
            
            embed.add_field(name="Host", value=f"`{host}`", inline=True)
            embed.add_field(name="Port", value=f"`{port}`", inline=True) 
            embed.add_field(name="Token", value="Set" if token else "None", inline=True)
            embed.add_field(name="CORS Origins", value=f"`{', '.join(cors_origins)}`", inline=False)
            
            embed.add_field(
                name="Configuration Commands",
                value=(
                    "`[p]cw apiconfig port 8080`\n"
                    "`[p]cw apiconfig host 0.0.0.0`\n"  
                    "`[p]cw apiconfig token your-secret-token`\n"
                    "`[p]cw apiconfig cors https://yoursite.com,*`"
                ),
                inline=False
            )
            
            await ctx.send(embed=embed)
            return
        
        setting = setting.lower()
        
        if setting == "port":
            try:
                port = int(value)
                if port < 1 or port > 65535:
                    raise ValueError("Port out of range")
                
                await self.config.guild(ctx.guild).api_server_port.set(port)
                await ctx.send(f"✅ API server port set to `{port}`")
                
            except (ValueError, TypeError):
                await ctx.send("❌ Invalid port. Must be a number between 1-65535")
                
        elif setting == "host":
            if not value:
                await ctx.send("❌ Please provide a host address")
                return
            
            await self.config.guild(ctx.guild).api_server_host.set(value)
            await ctx.send(f"✅ API server host set to `{value}`")
            
        elif setting == "token":
            if value:
                await self.config.guild(ctx.guild).api_access_token.set(value)
                await ctx.send("✅ API access token updated")
            else:
                await self.config.guild(ctx.guild).api_access_token.set(None)
                await ctx.send("✅ API access token removed (no authentication)")
                
        elif setting == "cors":
            if value:
                origins = [origin.strip() for origin in value.split(',')]
                await self.config.guild(ctx.guild).cors_origins.set(origins)
                await ctx.send(f"✅ CORS origins set to: `{', '.join(origins)}`")
            else:
                await self.config.guild(ctx.guild).cors_origins.set(["*"])
                await ctx.send("✅ CORS reset to allow all origins")
                
        else:
            await ctx.send("❌ Invalid setting. Use: `port`, `host`, `token`, or `cors`")
    
    @collabwarz.command(name="sunoconfig")
    async def suno_config(self, ctx, setting: str = None, *, value: str = None):
        """Configure Suno API integration"""
        if setting is None:
            # Show current configuration
            suno_enabled = await self.config.guild(ctx.guild).suno_api_enabled()
            base_url = await self.config.guild(ctx.guild).suno_api_base_url()
            
            embed = discord.Embed(
                title="🎵 Suno API Configuration",
                color=discord.Color.blue()
            )
            
            embed.add_field(
                name="Status",
                value="✅ Enabled" if suno_enabled else "❌ Disabled",
                inline=True
            )
            
            embed.add_field(
                name="Base URL",
                value=base_url,
                inline=True
            )
            
            embed.add_field(
                name="Available Commands",
                value=(
                    "`[p]cw sunoconfig enable/disable`\n"
                    "`[p]cw sunoconfig url https://api.suno-proxy.click`\n"
                    "`[p]cw testsuno https://suno.com/song/abc123`\n"
                    "For URL validation: `[p]cw testsunourl https://suno.com/s/kFacPCnBlw9n9oEP`"
                ),
                inline=False
            )
            
            await ctx.send(embed=embed)
            return
        
        setting = setting.lower()
        
        if setting in ["enable", "on"]:
            await self.config.guild(ctx.guild).suno_api_enabled.set(True)
            await ctx.send("✅ Suno API integration enabled")
            
        elif setting in ["disable", "off"]:
            await self.config.guild(ctx.guild).suno_api_enabled.set(False)
            await ctx.send("❌ Suno API integration disabled")
            
        elif setting == "url":
            if value:
                if not value.startswith(('http://', 'https://')):
                    await ctx.send("❌ URL must start with http:// or https://")
                    return
                await self.config.guild(ctx.guild).suno_api_base_url.set(value.rstrip('/'))
                await ctx.send(f"✅ Suno API base URL set to: `{value}`")
            else:
                await ctx.send("❌ Please provide a URL")
        else:
            await ctx.send("❌ Invalid setting. Use: `enable`, `disable`, or `url`")
    
    @collabwarz.command(name="testsuno")
    async def test_suno(self, ctx, suno_url: str):
        """Test Suno API integration with a song URL"""
        song_id = self._extract_suno_song_id(suno_url)
        
        if not song_id:
            await ctx.send("❌ Invalid Suno URL. Expected format: https://suno.com/song/[song-id]")
            return
        
        embed = discord.Embed(
            title="🧪 Testing Suno API",
            description=f"Song ID: `{song_id}`",
            color=discord.Color.yellow()
        )
        
        test_msg = await ctx.send(embed=embed)
        
        try:
            metadata = await self._fetch_suno_metadata(song_id, ctx.guild)
            
            if metadata:
                embed.color = discord.Color.green()
                embed.title = "✅ Suno API Test Successful"
                
                if metadata.get('title'):
                    embed.add_field(name="Title", value=metadata['title'], inline=True)
                if metadata.get('author_name'):
                    embed.add_field(name="Author", value=f"{metadata['author_name']} (@{metadata.get('author_handle', 'unknown')})", inline=True)
                if metadata.get('duration'):
                    embed.add_field(name="Duration", value=f"{metadata['duration']:.1f}s", inline=True)
                if metadata.get('play_count'):
                    embed.add_field(name="Plays", value=str(metadata['play_count']), inline=True)
                if metadata.get('upvote_count'):
                    embed.add_field(name="Upvotes", value=str(metadata['upvote_count']), inline=True)
                if metadata.get('tags'):
                    embed.add_field(name="Tags", value=metadata['tags'], inline=False)
                
                if metadata.get('image_url'):
                    embed.set_thumbnail(url=metadata['image_url'])
            else:
                embed.color = discord.Color.red()
                embed.title = "❌ Suno API Test Failed"
                embed.add_field(name="Error", value="No metadata returned or API disabled", inline=False)
                
        except Exception as e:
            embed.color = discord.Color.red()
            embed.title = "❌ Suno API Test Error"
            embed.add_field(name="Error", value=str(e), inline=False)
        
        await test_msg.edit(embed=embed)
    
    @collabwarz.command(name="testapi")
    async def test_api(self, ctx):
        """Test the local API server and show member list sample"""
        api_enabled = await self.config.guild(ctx.guild).api_server_enabled()
        
        if not api_enabled:
            await ctx.send("❌ API server is not running. Use `[p]cw apiserver start` first.")
            return
        
        port = await self.config.guild(ctx.guild).api_server_port()
        host = await self.config.guild(ctx.guild).api_server_host()
        
        embed = discord.Embed(
            title="🧪 API Server Test",
            color=discord.Color.blue()
        )
        
        try:
            # Get sample member data
            members_data = await self._get_guild_members_for_api(ctx.guild)
            member_count = len(members_data)
            
            embed.add_field(
                name="✅ Server Status",
                value=f"Running on `{host}:{port}`",
                inline=False
            )
            
            embed.add_field(
                name="📊 Member Count",
                value=f"{member_count} members available",
                inline=True
            )
            
            # Show sample of members
            if members_data:
                sample_members = members_data[:5]  # First 5 members
                sample_text = "\n".join([f"• {m['display_name']} (@{m['username']})" for m in sample_members])
                if len(members_data) > 5:
                    sample_text += f"\n... and {len(members_data) - 5} more"
                
                embed.add_field(
                    name="👥 Sample Members",
                    value=sample_text,
                    inline=False
                )
            
            embed.add_field(
                name="🔗 Test Command",
                value=(
                    f"```bash\n"
                    f"curl http://{host}:{port}/api/members\n"
                    f"```"
                ),
                inline=False
            )
            
        except Exception as e:
            embed.color = discord.Color.red()
            embed.add_field(
                name="❌ Error",
                value=f"Failed to get member data: {str(e)}",
                inline=False
            )
        
        await ctx.send(embed=embed)
    
    @collabwarz.command(name="admintoken")
    async def generate_admin_token(self, ctx, action: str = "generate"):
        """Generate or revoke admin token for web panel access"""
        
        if action.lower() == "generate":
            # Verify user is configured as an admin
            primary_admin_id = await self.config.guild(ctx.guild).admin_user_id()
            admin_ids = await self.config.guild(ctx.guild).admin_user_ids()
            
            if ctx.author.id != primary_admin_id and ctx.author.id not in admin_ids:
                await ctx.send("❌ Only configured Discord admins can generate admin tokens. Use `[p]cw setadmin` or `[p]cw addadmin` first.")
                return
            
            # Generate JWT-based secure token
            import secrets
            import hashlib
            import json
            import base64
            from datetime import datetime, timedelta
            
            # Generate a secure signing key for this guild (if not exists)
            signing_key = await self.config.guild(ctx.guild).jwt_signing_key()
            if not signing_key:
                signing_key = secrets.token_urlsafe(64)  # 512-bit key
                await self.config.guild(ctx.guild).jwt_signing_key.set(signing_key)
            
            # Create JWT payload with expiration and user info
            payload = {
                "user_id": ctx.author.id,
                "username": ctx.author.display_name,
                "guild_id": ctx.guild.id,
                "issued_at": datetime.utcnow().isoformat(),
                "expires_at": (datetime.utcnow() + timedelta(days=365)).isoformat(),  # 1 year expiry
                "token_version": 2  # Version for future revocation
            }
            
            # Create simple JWT (Header.Payload.Signature)
            header = {"typ": "JWT", "alg": "HS256"}
            header_b64 = base64.urlsafe_b64encode(json.dumps(header).encode()).decode().rstrip('=')
            payload_b64 = base64.urlsafe_b64encode(json.dumps(payload).encode()).decode().rstrip('=')
            
            # Create signature using HMAC-SHA256
            message = f"{header_b64}.{payload_b64}"
            signature = hashlib.new('sha256', (message + signing_key).encode()).hexdigest()
            jwt_token = f"{header_b64}.{payload_b64}.{signature}"
            
            # Store token metadata (no raw token stored)
            token_data = {
                "user_id": ctx.author.id,
                "generated_at": datetime.utcnow().isoformat(),
                "generated_by": ctx.author.display_name,
                "token_version": 2,
                "expires_at": payload["expires_at"]
            }
            
            await self.config.guild(ctx.guild).api_access_token_data.set(token_data)
            # Keep old field for backward compatibility during transition
            await self.config.guild(ctx.guild).api_access_token.set(jwt_token)
            
            # Send token in DM for security
            try:
                embed = discord.Embed(
                    title="🔐 Admin Token Generated",
                    description="Your admin token has been generated and sent to your DMs.",
                    color=discord.Color.green()
                )
                
                embed.add_field(
                    name="⚠️ Security Note",
                    value=(
                        "• Token sent via DM for security\n"
                        "• Keep this token secret\n" 
                        "• Use in Authorization header: `Bearer <token>`\n"
                        "• Revoke with `[p]cw admintoken revoke`"
                    ),
                    inline=False
                )
                
                # Send public confirmation
                await ctx.send(embed=embed)
                
                # Send token privately
                dm_embed = discord.Embed(
                    title="🔐 Admin API Token",
                    description=f"**Server**: {ctx.guild.name}",
                    color=discord.Color.blue()
                )
                
                dm_embed.add_field(
                    name="JWT Token",
                    value=f"```{jwt_token}```",
                    inline=False
                )
                
                dm_embed.add_field(
                    name="Usage",
                    value=(
                        "Use this token in your web panel configuration.\n"
                        "Include in requests: `Authorization: Bearer <token>`"
                    ),
                    inline=False
                )
                
                dm_embed.add_field(
                    name="API Endpoints",
                    value=(
                        "• `GET /api/admin/config` - Get configuration\n"
                        "• `POST /api/admin/config` - Update settings\n"
                        "• `GET /api/admin/status` - Competition status\n"
                        "• `GET /api/admin/submissions` - Current submissions\n"
                        "• `GET /api/admin/history` - Competition history\n"
                        "• `POST /api/admin/actions` - Execute admin actions"
                    ),
                    inline=False
                )
                
                await ctx.author.send(embed=dm_embed)
                
            except discord.Forbidden:
                # Fallback if DM fails
                embed.add_field(
                    name="❌ DM Failed", 
                    value=f"JWT Token: `{jwt_token[:50]}...`\n**Delete this message after copying!**", 
                    inline=False
                )
                await ctx.send(embed=embed, delete_after=60)
        
        elif action.lower() == "revoke":
            await self.config.guild(ctx.guild).api_access_token.set(None)
            await self.config.guild(ctx.guild).api_access_token_data.set(None)
            
            embed = discord.Embed(
                title="🚫 Admin Token Revoked",
                description="The admin API token has been revoked. All admin API access is now disabled.",
                color=discord.Color.red()
            )
            
            embed.add_field(
                name="Effect",
                value=(
                    "• Web panel access blocked\n"
                    "• Admin API endpoints disabled\n"
                    "• Generate new token to restore access"
                ),
                inline=False
            )
            
            await ctx.send(embed=embed)
        
        elif action.lower() == "status":
            token_data = await self.config.guild(ctx.guild).api_access_token_data()
            
            embed = discord.Embed(
                title="🔐 Admin Token Status",
                color=discord.Color.blue() if token_data else discord.Color.red()
            )
            
            if token_data and token_data.get('user_id'):
                token_user_id = token_data.get('user_id')
                generated_at = token_data.get('generated_at', 'Unknown')
                generated_by = token_data.get('generated_by', 'Unknown')
                token_version = token_data.get('token_version', 1)
                is_jwt = token_version >= 2
                is_hashed = bool(token_data.get('token_hash'))
                
                # Verify token user is still admin
                primary_admin_id = await self.config.guild(ctx.guild).admin_user_id()
                admin_ids = await self.config.guild(ctx.guild).admin_user_ids()
                is_valid_admin = token_user_id == primary_admin_id or token_user_id in admin_ids
                
                if is_jwt:
                    status_text = "✅ JWT Token active (secure)"
                elif is_hashed:
                    status_text = "⚠️ Token active (legacy hashed)"
                else:
                    status_text = "⚠️ Token active (legacy unhashed)"
                    
                if not is_valid_admin:
                    status_text = "⚠️ Token active (user no longer admin)"
                
                embed.add_field(
                    name="Status",
                    value=status_text,
                    inline=True
                )
                
                embed.add_field(
                    name="Generated By",
                    value=f"{generated_by} (<@{token_user_id}>)",
                    inline=True
                )
                
                embed.add_field(
                    name="Generated At",
                    value=generated_at[:19].replace('T', ' ') + ' UTC',
                    inline=True
                )
                
                # Security warnings
                warnings = []
                if not is_valid_admin:
                    warnings.append("Token was generated by a user who is no longer configured as an admin.")
                if not is_jwt and not is_hashed:
                    warnings.append("Token is stored in legacy unhashed format (security risk).")
                elif not is_jwt:
                    warnings.append("Token uses legacy format. Consider upgrading to JWT tokens.")
                
                if warnings:
                    embed.add_field(
                        name="⚠️ Security Warnings",
                        value="\n".join(f"• {warning}" for warning in warnings) + "\n\n**Recommendation:** Revoke and regenerate token.",
                        inline=False
                    )
            else:
                embed.add_field(
                    name="Status",
                    value="❌ No token set",
                    inline=False
                )
                
                embed.add_field(
                    name="Generate Token",
                    value="`[p]cw admintoken generate`",
                    inline=False
                )
            
            await ctx.send(embed=embed)
        
        elif action.lower() == "debug":
            # Debug command for token validation issues
            primary_admin_id = await self.config.guild(ctx.guild).admin_user_id()
            admin_ids = await self.config.guild(ctx.guild).admin_user_ids()
            
            if ctx.author.id != primary_admin_id and ctx.author.id not in admin_ids:
                await ctx.send("❌ Only configured Discord admins can debug tokens.")
                return
                
            token_data = await self.config.guild(ctx.guild).api_access_token_data()
            signing_key = await self.config.guild(ctx.guild).jwt_signing_key()
            api_enabled = await self.config.guild(ctx.guild).api_server_enabled()
            port = await self.config.guild(ctx.guild).api_server_port()
            host = await self.config.guild(ctx.guild).api_server_host()
            
            embed = discord.Embed(
                title="🔍 Token Debug Information",
                color=discord.Color.orange()
            )
            
            embed.add_field(
                name="API Server",
                value=f"{'✅ Running' if api_enabled else '❌ Stopped'} on `{host}:{port}`",
                inline=False
            )
            
            embed.add_field(
                name="JWT Signing Key",
                value="✅ Present" if signing_key else "❌ Missing",
                inline=True
            )
            
            embed.add_field(
                name="Token Data",
                value="✅ Present" if token_data else "❌ Missing",
                inline=True
            )
            
            if token_data:
                embed.add_field(
                    name="Token Details",
                    value=(
                        f"Version: {token_data.get('token_version', 'Unknown')}\n"
                        f"User ID: {token_data.get('user_id', 'Unknown')}\n"
                        f"Generated: {token_data.get('generated_at', 'Unknown')[:19]}"
                    ),
                    inline=False
                )
            
            embed.add_field(
                name="Test Endpoint",
                value=f"`curl -H \"Authorization: Bearer <token>\" http://{host}:{port}/api/admin/status`",
                inline=False
            )
            
            embed.add_field(
                name="Next Steps",
                value=(
                    "1. Ensure API server is running: `[p]cw apiserver start`\n"
                    "2. Generate new token if needed: `[p]cw admintoken generate`\n"
                    "3. Check frontend console for detailed errors\n"
                    "4. Verify CORS settings: `[p]cw apiconfig cors <frontend-url>`"
                ),
                inline=False
            )
            
            await ctx.send(embed=embed)
        
        else:
            await ctx.send("❌ Invalid action. Use: `generate`, `revoke`, `status`, or `debug`")
    
    @collabwarz.command(name="testpublicapi")
    async def test_public_api(self, ctx):
        """Test public API endpoints and show sample responses"""
        api_enabled = await self.config.guild(ctx.guild).api_server_enabled()
        
        if not api_enabled:
            await ctx.send("❌ API server is not running. Use `[p]cw apiserver start` first.")
            return
        
        port = await self.config.guild(ctx.guild).api_server_port()
        host = await self.config.guild(ctx.guild).api_server_host()
        
        embed = discord.Embed(
            title="🌐 Public API Test Results",
            color=discord.Color.green()
        )
        
        base_url = f"http://{host}:{port}/api/public"
        
        embed.add_field(
            name="🔗 Available Endpoints",
            value=(
                f"• `{base_url}/status` - Competition status\n"
                f"• `{base_url}/submissions` - Current submissions\n" 
                f"• `{base_url}/voting` - Voting results\n"
                f"• `{base_url}/history` - Competition history\n"
                f"• `{base_url}/leaderboard` - Member statistics\n"
                f"• `{base_url.replace('/public', '')}/members` - Member directory\n"
                f"• `{base_url}/user/{{user_id}}/membership` - Check user membership\n"
                f"• `{base_url}/artists` - All artists data\n"
                f"• `{base_url}/teams` - All teams data\n"
                f"• `{base_url}/songs` - All songs data\n"
                f"• `{base_url}/weeks` - All weeks data\n"
                f"• `{base_url}/stats/leaderboard` - Comprehensive statistics"
            ),
            inline=False
        )
        
        # Get current data samples
        try:
            # Status sample
            current_phase = await self.config.guild(ctx.guild).current_phase()
            current_theme = await self.config.guild(ctx.guild).current_theme()
            submitted_teams = await self.config.guild(ctx.guild).submitted_teams()
            
            embed.add_field(
                name="📊 Current Status Sample",
                value=(
                    f"Phase: `{current_phase}`\n"
                    f"Theme: `{current_theme}`\n"
                    f"Teams: `{len(submitted_teams)}`"
                ),
                inline=True
            )
            
            # History sample  
            weeks_db = await self.config.guild(ctx.guild).weeks_db()
            embed.add_field(
                name="📚 History Sample",
                value=f"Total competitions: `{len(weeks_db)}`",
                inline=True
            )
            
            # Member sample
            members_data = await self._get_guild_members_for_api(ctx.guild)
            embed.add_field(
                name="👥 Members Sample", 
                value=f"Total members: `{len(members_data)}`",
                inline=True
            )
            
        except Exception as e:
            embed.color = discord.Color.orange()
            embed.add_field(
                name="⚠️ Warning",
                value=f"Could not fetch sample data: {str(e)}",
                inline=False
            )
        
        embed.add_field(
            name="💡 Frontend Integration",
            value=(
                "**No authentication required** for public endpoints!\n\n"
                "**React Example:**\n"
                f"```javascript\n"
                f"fetch('{base_url}/status')\n"
                f"  .then(res => res.json())\n"
                f"  .then(data => console.log(data));\n"
                f"```"
            ),
            inline=False
        )
        
        embed.add_field(
            name="📖 Documentation",
            value="See `PUBLIC_API.md` for complete documentation with React hooks and components.",
            inline=False
        )
        
        await ctx.send(embed=embed)
    
    @collabwarz.command(name="declarewinner")
    async def declare_winner(self, ctx, team_name: str, member1: discord.Member, member2: discord.Member):
        """🚨 MANUAL OVERRIDE: Declare a winner (use only if automatic system fails)"""
        
        # Warn about manual override
        warning_embed = discord.Embed(
            title="⚠️ MANUAL WINNER OVERRIDE",
            description=(
                "**WARNING**: This is a manual override of the automatic voting system!\n\n"
                "**Normal Process**: Winners are automatically determined by frontend voting results.\n"
                "**Use this only if**: Automatic system failed or emergency situation.\n\n"
                f"**Declaring**: **{team_name}** as winner"
            ),
            color=discord.Color.orange()
        )
        
        warning_embed.add_field(
            name="Team Members",
            value=f"{member1.mention} & {member2.mention}",
            inline=False
        )
        
        rep_amount = await self.config.guild(ctx.guild).rep_reward_amount()
        warning_embed.add_field(
            name="Rep Rewards",
            value=f"Each member will receive **{rep_amount} petals**" if rep_amount > 0 else "No rep rewards (disabled)",
            inline=False
        )
        
        warning_embed.add_field(
            name="⚠️ Consider First",
            value=(
                "• Check `[p]cw checkvotes` for actual voting results\n"
                "• Verify integrated API is working with `[p]cw testpublicapi`\n"
                "• Ensure this isn't overriding legitimate voting results"
            ),
            inline=False
        )
        
        warning_embed.set_footer(text="React with 🚨 to OVERRIDE or ❌ to cancel")
        
        message = await ctx.send(embed=warning_embed)
        await message.add_reaction("🚨")
        await message.add_reaction("❌")
        
        def check(reaction, user):
            return (user == ctx.author and 
                   reaction.message.id == message.id and 
                   str(reaction.emoji) in ["🚨", "❌"])
        
        try:
            reaction, user = await self.bot.wait_for('reaction_add', timeout=30.0, check=check)
            
            if str(reaction.emoji) == "🚨":
                # Proceed with winner declaration
                theme = await self.config.guild(ctx.guild).current_theme()
                member_ids = [member1.id, member2.id]
                
                # Record winner and give rep
                rep_results = await self._record_weekly_winner(ctx.guild, team_name, member_ids)
                
                # Create winner announcement
                winner_msg = await self._create_winner_announcement_with_rep(ctx.guild, team_name, member_ids, theme)
                
                # Post in announcement channel
                announcement_channel_id = await self.config.guild(ctx.guild).announcement_channel()
                if announcement_channel_id:
                    announcement_channel = ctx.guild.get_channel(announcement_channel_id)
                    if announcement_channel:
                        await announcement_channel.send(winner_msg)
                
                # Update status
                await self.config.guild(ctx.guild).winner_announced.set(True)
                
                # Success message
                success_embed = discord.Embed(
                    title="🎉 Winner Declared Successfully!",
                    description=f"**{team_name}** has been declared the winner!",
                    color=discord.Color.green()
                )
                
                rep_status = []
                for user_id, success in rep_results.items():
                    user = ctx.guild.get_member(user_id)
                    status = "✅" if success else "❌"
                    rep_status.append(f"{status} {user.display_name if user else f'User-{user_id}'}")
                
                if rep_status:
                    success_embed.add_field(
                        name="Rep Rewards Status",
                        value="\n".join(rep_status),
                        inline=False
                    )
                
                await message.edit(embed=success_embed, view=None)
                
            else:
                cancelled_embed = discord.Embed(
                    title="❌ Cancelled",
                    description="Winner declaration cancelled.",
                    color=discord.Color.gray()
                )
                await message.edit(embed=cancelled_embed, view=None)
                
        except asyncio.TimeoutError:
            timeout_embed = discord.Embed(
                title="⏰ Timeout",
                description="Winner declaration timed out.",
                color=discord.Color.gray()
            )
            await message.edit(embed=timeout_embed, view=None)
    
    @collabwarz.command(name="testsunourl")
    async def test_suno_validation(self, ctx, *, url: str = None):
        """🧪 Test Suno.com URL validation"""
        
        embed = discord.Embed(
            title="🧪 Suno.com URL Validation Test",
            color=discord.Color.blue()
        )
        
        # Add information about valid formats
        embed.add_field(
            name="✅ Valid Formats",
            value=(
                "• `https://suno.com/s/kFacPCnBlw9n9oEP`\n"
                "• `https://suno.com/song/3b172539-fc21-4f37-937c-a641ed52da26`"
            ),
            inline=False
        )
        
        if url:
            # Test the provided URL
            is_valid = self._validate_suno_url(url)
            
            embed.add_field(
                name="🔍 Test URL",
                value=f"`{url}`",
                inline=False
            )
            
            if is_valid:
                embed.add_field(
                    name="✅ Result",
                    value="**Valid Suno.com URL**",
                    inline=False
                )
                embed.color = discord.Color.green()
            else:
                embed.add_field(
                    name="❌ Result", 
                    value="**Invalid URL format**",
                    inline=False
                )
                embed.color = discord.Color.red()
                
            # Extract URLs from text
            extracted = self._extract_suno_urls_from_text(url)
            if extracted:
                embed.add_field(
                    name="🔗 Extracted URLs",
                    value="\n".join([f"• `{u}`" for u in extracted]),
                    inline=False
                )
        else:
            # Show example usage
            embed.add_field(
                name="📝 Usage",
                value=f"`{ctx.prefix}cw testsunourl https://suno.com/s/kFacPCnBlw9n9oEP`",
                inline=False
            )
            
            # Test examples
            test_urls = [
                "https://suno.com/s/kFacPCnBlw9n9oEP",
                "https://suno.com/song/3b172539-fc21-4f37-937c-a641ed52da26",
                "https://suno.com/invalid/url",
                "https://example.com/not-suno"
            ]
            
            test_results = []
            for test_url in test_urls:
                is_valid = self._validate_suno_url(test_url)
                result = "✅" if is_valid else "❌"
                test_results.append(f"{result} `{test_url}`")
            
            embed.add_field(
                name="📋 Test Examples",
                value="\n".join(test_results),
                inline=False
            )
        
        embed.set_footer(text="Use this command to verify Suno URL formats before submission")
        await ctx.send(embed=embed)
    
    @collabwarz.command(name="winners")
    async def show_winners(self, ctx, weeks: int = 4):
        """Show recent winners and their rep rewards"""
        if weeks < 1 or weeks > 20:
            await ctx.send("❌ Number of weeks must be between 1 and 20")
            return
        
        weekly_winners = await self.config.guild(ctx.guild).weekly_winners()
        
        if not weekly_winners:
            await ctx.send("🏆 No winners recorded yet.")
            return
        
        # Get recent weeks
        all_weeks = sorted(weekly_winners.keys(), reverse=True)
        recent_weeks = all_weeks[:weeks]
        
        embed = discord.Embed(
            title="🏆 Recent Winners",
            color=discord.Color.gold()
        )
        
        for week in recent_weeks:
            winner_data = weekly_winners[week]
            team_name = winner_data.get("team_name", "Unknown Team")
            member_ids = winner_data.get("members", [])
            rep_given = winner_data.get("rep_given", {})
            
            member_names = []
            rep_status = []
            for user_id in member_ids:
                user = ctx.guild.get_member(user_id)
                name = user.display_name if user else f"User-{user_id}"
                member_names.append(name)
                
                if str(user_id) in rep_given or user_id in rep_given:
                    success = rep_given.get(str(user_id), rep_given.get(user_id, False))
                    rep_status.append("✅" if success else "❌")
                else:
                    rep_status.append("❓")
            
            members_text = " & ".join(member_names) if member_names else "Unknown"
            rep_text = " ".join(rep_status) if rep_status else "No data"
            
            embed.add_field(
                name=f"Week {week}",
                value=f"**{team_name}**\n{members_text}\nRep: {rep_text}",
                inline=True
            )
        
        embed.set_footer(text="✅ = Rep given • ❌ = Failed • ❓ = Unknown")
        await ctx.send(embed=embed)
    
    @collabwarz.command(name="confirm")
    async def confirm_announcement(self, ctx, guild_id: int = None):
        """Confirm a pending announcement"""
        if guild_id is None:
            guild_id = ctx.guild.id
        
        target_guild = self.bot.get_guild(guild_id)
        if not target_guild:
            await ctx.send("❌ Guild not found")
            return
        
        # Check if user is the designated admin
        admin_id = await self.config.guild(target_guild).admin_user_id()
        if admin_id != ctx.author.id:
            await ctx.send("❌ You are not authorized to confirm announcements for this server")
            return
        
        pending = await self.config.guild(target_guild).pending_announcement()
        if not pending:
            await ctx.send("❌ No pending announcement for this server")
            return
        
        # Get the channel and post the announcement
        channel = target_guild.get_channel(pending["channel_id"])
        if not channel:
            await ctx.send("❌ Announcement channel not found")
            return
        
        await self._post_announcement(
            channel, target_guild, 
            pending["type"], pending["theme"], 
            pending.get("deadline"), force=True
        )
        
        await ctx.send(f"✅ Announcement confirmed and posted in {target_guild.name}")
    
    @collabwarz.command(name="deny")
    async def deny_announcement(self, ctx, guild_id: int = None):
        """Deny a pending announcement"""
        if guild_id is None:
            guild_id = ctx.guild.id
        
        target_guild = self.bot.get_guild(guild_id)
        if not target_guild:
            await ctx.send("❌ Guild not found")
            return
        
        # Check if user is the designated admin
        admin_id = await self.config.guild(target_guild).admin_user_id()
        if admin_id != ctx.author.id:
            await ctx.send("❌ You are not authorized to deny announcements for this server")
            return
        
        pending = await self.config.guild(target_guild).pending_announcement()
        if not pending:
            await ctx.send("❌ No pending announcement for this server")
            return
        
        # Clear the pending announcement
        await self.config.guild(target_guild).pending_announcement.set(None)
        await ctx.send(f"❌ Announcement denied and cancelled for {target_guild.name}")
    
    @collabwarz.command(name="interrupt")
    async def interrupt_week(self, ctx, *, new_theme: str = None):
        """Interrupt current week and start fresh (with optional new theme)"""
        
        if new_theme:
            await self.config.guild(ctx.guild).current_theme.set(new_theme)
            theme_msg = f"with new theme: **{new_theme}**"
        else:
            theme_msg = f"with current theme: **{await self.config.guild(ctx.guild).current_theme()}**"
        
        # Reset all tracking
        await self.config.guild(ctx.guild).last_announcement.set(None)
        await self.config.guild(ctx.guild).winner_announced.set(False)
        await self.config.guild(ctx.guild).pending_announcement.set(None)
        await self.config.guild(ctx.guild).current_phase.set("submission")
        
        # Force start new submission phase
        channel_id = await self.config.guild(ctx.guild).announcement_channel()
        if channel_id:
            channel = ctx.guild.get_channel(channel_id)
            if channel:
                current_theme = await self.config.guild(ctx.guild).current_theme()
                await self._post_announcement(channel, ctx.guild, "submission_start", current_theme, force=True)
        
        embed = discord.Embed(
            title="🔄 Week Interrupted & Restarted",
            description=f"New submission phase started {theme_msg}",
            color=discord.Color.orange()
        )
        embed.add_field(name="Phase", value="**Submission**", inline=True)
        embed.add_field(name="Status", value="**Active**", inline=True)
        embed.set_footer(text="All tracking reset - fresh start!")
        
        await ctx.send(embed=embed)
    
    @collabwarz.command(name="changetheme")
    async def change_theme_only(self, ctx, *, new_theme: str):
        """Change the current theme without restarting the week"""
        old_theme = await self.config.guild(ctx.guild).current_theme()
        await self.config.guild(ctx.guild).current_theme.set(new_theme)
        
        embed = discord.Embed(
            title="🎨 Theme Changed",
            color=discord.Color.purple()
        )
        embed.add_field(name="Old Theme", value=f"~~{old_theme}~~", inline=True)
        embed.add_field(name="New Theme", value=f"**{new_theme}**", inline=True)
        embed.set_footer(text="Week continues with new theme")
        
        await ctx.send(embed=embed)
        
        # Optionally announce theme change
        channel_id = await self.config.guild(ctx.guild).announcement_channel()
        if channel_id:
            channel = ctx.guild.get_channel(channel_id)
            if channel:
                change_embed = discord.Embed(
                    title="🎨 Theme Update!",
                    description=f"**New theme for this week:** {new_theme}",
                    color=discord.Color.purple()
                )
                change_embed.set_footer(text="SoundGarden's Collab Warz - Theme Change")
                await channel.send(embed=change_embed)
    
    @collabwarz.command(name="pending")
    async def show_pending(self, ctx):
        """Show pending announcements waiting for confirmation"""
        pending = await self.config.guild(ctx.guild).pending_announcement()
        
        if not pending:
            await ctx.send("✅ No pending announcements")
            return
        
        embed = discord.Embed(
            title="⏳ Pending Announcement",
            color=discord.Color.yellow()
        )
        embed.add_field(name="Type", value=pending["type"].replace("_", " ").title(), inline=True)
        embed.add_field(name="Theme", value=pending["theme"], inline=True)
        
        if pending.get("deadline"):
            embed.add_field(name="Deadline", value=pending["deadline"], inline=True)
        
        # Parse timestamp
        timestamp = datetime.fromisoformat(pending["timestamp"])
        embed.add_field(name="Requested", value=timestamp.strftime("%Y-%m-%d %H:%M UTC"), inline=False)
        
        admin_id = await self.config.guild(ctx.guild).admin_user_id()
        if admin_id:
            admin_user = ctx.guild.get_member(admin_id)
            embed.add_field(name="Waiting for", value=admin_user.mention if admin_user else "Unknown admin", inline=True)
        
        embed.set_footer(text=f"Use '[p]cw confirm' or '[p]cw deny' to handle")
        
        await ctx.send(embed=embed)
    
    @collabwarz.command(name="forcepost")
    async def force_post(self, ctx, announcement_type: str, *, custom_theme: str = None):
        """Force post an announcement without confirmation (emergency use)"""
        if announcement_type not in ["submission_start", "voting_start", "reminder", "winner"]:
            await ctx.send("❌ Invalid type. Use: submission_start, voting_start, reminder, or winner")
            return
        
        channel_id = await self.config.guild(ctx.guild).announcement_channel()
        if not channel_id:
            await ctx.send("❌ Please set an announcement channel first")
            return
        
        channel = ctx.guild.get_channel(channel_id)
        if not channel:
            await ctx.send("❌ Announcement channel not found")
            return
        
        theme = custom_theme or await self.config.guild(ctx.guild).current_theme()
        deadline = "Soon" if "reminder" in announcement_type else None
        
        await self._post_announcement(channel, ctx.guild, announcement_type, theme, deadline, force=True)
        await ctx.send(f"🚨 **FORCED POST** - {announcement_type.replace('_', ' ').title()} announcement posted")
    
    @commands.Cog.listener()
    async def on_message(self, message):
        """Handle Discord submissions validation and message cleanup"""
        # Ignore bot messages
        if message.author.bot:
            return
        
        # Ignore DMs
        if not message.guild:
            return
        
        guild = message.guild
        
        # Check if user is admin (admins can always post)
        is_admin = await self._is_user_admin(guild, message.author)
        if is_admin:
            return  # Admins bypass all restrictions
        
        # Check if auto-delete is enabled
        auto_delete_enabled = await self.config.guild(guild).auto_delete_messages()
        
        # Check if this is the configured submission channel
        submission_channel_id = await self.config.guild(guild).submission_channel()
        if not submission_channel_id or message.channel.id != submission_channel_id:
            return  # Not in submission channel, ignore
        
        # Check if automation is enabled
        automation_enabled = await self.config.guild(guild).automation_enabled()
        if not automation_enabled:
            # Bot is inactive, delete message and explain
            await self._delete_message_with_explanation(
                message,
                "🤖 **Collab Warz is currently inactive**",
                f"{message.author.mention}, the competition bot is not currently running.\nPlease wait for an admin to activate Collab Warz before posting submissions.",
                auto_delete_enabled,
                10
            )
            return
        
        # Check current phase - only allow submissions during submission phase
        current_phase = await self.config.guild(guild).current_phase()
        if current_phase != "submission":
            # Determine specific message based on phase
            if current_phase == "voting":
                phase_msg = "voting is currently active"
                emoji = "🗳️"
                explanation = "Submissions are closed. Please vote on existing collaborations!"
            elif current_phase == "cancelled":
                phase_msg = "this week has been cancelled"
                emoji = "❌"
                explanation = "The current competition week was cancelled. Wait for next week's announcement."
            elif current_phase == "paused":
                phase_msg = "competition is temporarily paused"
                emoji = "⏸️"
                explanation = "Competition is on hold. Admin will announce when submissions reopen."
            elif current_phase == "ended":
                phase_msg = "this week's competition has ended"
                emoji = "🏁"
                explanation = "This competition cycle is complete. Wait for next week's announcement."
            else:
                phase_msg = "competition is not currently active"
                emoji = "⏰"
                explanation = "No active competition. Wait for admin to start submissions."
            
            await self._delete_message_with_explanation(
                message,
                f"{emoji} **Submissions closed**",
                f"{message.author.mention}, {phase_msg}.\n{explanation}\nCurrent status: **{current_phase.title() if current_phase else 'Inactive'}**",
                auto_delete_enabled,
                12
            )
            return
        
        # Check if message looks like a submission attempt
        has_attachment = len(message.attachments) > 0
        has_suno_reference = 'suno.com' in message.content.lower()
        forbidden_platforms = ['soundcloud', 'youtube', 'bandcamp', 'spotify', 'drive.google']
        has_forbidden_platform = any(platform in message.content.lower() for platform in forbidden_platforms)
        
        # If it looks like a submission attempt, validate it
        if has_attachment or has_suno_reference or has_forbidden_platform:
            validation_result = await self._validate_and_process_submission(message)
            
            if validation_result["success"]:
                # Valid submission - add thumbs up reaction
                try:
                    await message.add_reaction("👍")
                except discord.Forbidden:
                    pass
                
                # Send confirmation message
                await message.channel.send(
                    f"✅ **Submission registered!** {message.author.mention}\n\n"
                    f"**Team:** `{validation_result['team_name']}`\n"
                    f"**Partner:** {validation_result['partner_mention']}\n"
                    f"Your collaboration has been successfully recorded for this week's competition! 🎵"
                )
            else:
                # Invalid submission - delete and explain
                error_msg = "\n".join(validation_result["errors"])
                await self._delete_message_with_explanation(
                    message,
                    "❌ **Invalid submission**",
                    f"{message.author.mention}\n{error_msg}\nPlease fix the issues and resubmit.",
                    auto_delete_enabled,
                    15
                )
        # If message doesn't look like submission, delete it with explanation
        else:
            await self._delete_message_with_explanation(
                message,
                "🗑️ **Message removed**",
                f"{message.author.mention}\nThis channel is for competition submissions only during the submission phase.\nPlease use other channels for general discussion.",
                auto_delete_enabled,
                8
            )
    
    async def _determine_winners(self, guild: discord.Guild) -> tuple:
        """Determine the winner(s) based on voting results
        
        Returns:
            Tuple of (winning_teams, is_tie, vote_counts)
            - winning_teams: List of winning team names
            - is_tie: Boolean indicating if there's a tie
            - vote_counts: Dictionary of all vote counts
        """
        week = self._get_current_week()
        
        # Check if we're in a face-off situation
        face_off_active = await self.config.guild(guild).face_off_active()
        if face_off_active:
            vote_counts = await self.config.guild(guild).face_off_results()
        else:
            # Use internal voting results storage
            voting_results = await self.config.guild(guild).voting_results()
            vote_counts = voting_results.get(week, {})
        
        if not vote_counts:
            return [], False, {}
        
        # Find the maximum vote count
        max_votes = max(vote_counts.values()) if vote_counts else 0
        
        # Find all teams with the maximum votes
        winning_teams = [team for team, votes in vote_counts.items() if votes == max_votes]
        
        is_tie = len(winning_teams) > 1
        
        return winning_teams, is_tie, vote_counts
    
    async def _start_face_off(self, guild: discord.Guild, tied_teams: list) -> bool:
        """Start a 24-hour face-off between tied teams
        
        Args:
            guild: Discord guild
            tied_teams: List of team names that are tied
            
        Returns:
            Boolean indicating if face-off was started successfully
        """
        try:
            # Set face-off configuration
            await self.config.guild(guild).face_off_active.set(True)
            await self.config.guild(guild).face_off_teams.set(tied_teams)
            
            # Set deadline for 24 hours from now
            face_off_deadline = datetime.utcnow() + timedelta(hours=24)
            await self.config.guild(guild).face_off_deadline.set(face_off_deadline.isoformat())
            
            # Clear previous face-off results
            await self.config.guild(guild).face_off_results.set({})
            
            # Create face-off announcement
            channel_id = await self.config.guild(guild).announcement_channel()
            channel = guild.get_channel(channel_id) if channel_id else None
            
            if channel:
                embed = discord.Embed(
                    title="⚔️ TIE BREAKER - FINAL FACE-OFF!",
                    description=(
                        f"**We have a tie!** 🤝\n\n"
                        f"**Tied Teams:**\n"
                        + "\n".join([f"• **{team}**" for team in tied_teams]) +
                        f"\n\n**⏰ 24-Hour Final Vote!**\n"
                        f"Vote now on the website for your favorite!\n"
                        f"Deadline: {self._create_discord_timestamp(face_off_deadline)}\n\n"
                        f"🔥 **Winner takes all!** 🏆"
                    ),
                    color=discord.Color.red()
                )
                
                embed.set_footer(text="SoundGarden's Collab Warz - Final Face-Off")
                
                use_ping = await self.config.guild(guild).use_everyone_ping()
                content = "@everyone 🔥 **FINAL FACE-OFF!** 🔥" if use_ping else None
                
                await channel.send(content=content, embed=embed)
            
            return True
            
        except Exception as e:
            print(f"Error starting face-off: {e}")
            return False
    
    async def _check_face_off_results(self, guild: discord.Guild) -> Optional[str]:
        """Check face-off results and determine final winner
        
        Returns:
            Winner team name, or None if still tied or error
        """
        try:
            face_off_teams = await self.config.guild(guild).face_off_teams()
            
            if not face_off_teams:
                return None
            
            # Get face-off voting results from internal storage
            face_off_votes = await self.config.guild(guild).face_off_results()
            
            if not face_off_votes:
                # No votes yet
                return None
            
            # Find winner
            max_votes = max(face_off_votes.values()) if face_off_votes else 0
            winners = [team for team, votes in face_off_votes.items() if votes == max_votes]
            
            if len(winners) == 1:
                return winners[0]
            elif len(winners) > 1:
                # Still tied after face-off, random selection
                import random
                winner = random.choice(winners)
                
                # Announce random selection
                channel_id = await self.config.guild(guild).announcement_channel()
                channel = guild.get_channel(channel_id) if channel_id else None
                
                if channel:
                    embed = discord.Embed(
                        title="🎲 Random Winner Selection!",
                        description=(
                            f"**Still tied after face-off!** 😱\n\n"
                            f"**Tied Teams:** {', '.join(winners)}\n\n"
                            f"**🎲 Random Winner:** **{winner}**\n\n"
                            f"🎉 Congratulations to the randomly selected champions! 🏆"
                        ),
                        color=discord.Color.gold()
                    )
                    await channel.send(embed=embed)
                
                return winner
            
            return None
            
        except Exception as e:
            print(f"Error checking face-off results: {e}")
            return None
    
    async def _end_face_off(self, guild: discord.Guild):
        """End the current face-off and reset state"""
        await self.config.guild(guild).face_off_active.set(False)
        await self.config.guild(guild).face_off_teams.set([])
        await self.config.guild(guild).face_off_deadline.set(None)
        await self.config.guild(guild).face_off_results.set({})
    
    async def _process_voting_end(self, guild: discord.Guild):
        """Process the end of voting phase and determine winners"""
        try:
            # Check if there's an active face-off
            face_off_active = await self.config.guild(guild).face_off_active()
            
            if face_off_active:
                # Check face-off deadline
                face_off_deadline_str = await self.config.guild(guild).face_off_deadline()
                if face_off_deadline_str:
                    face_off_deadline = datetime.fromisoformat(face_off_deadline_str)
                    
                    if datetime.utcnow() >= face_off_deadline:
                        # Face-off time is up, determine final winner
                        winner = await self._check_face_off_results(guild)
                        
                        if winner:
                            # We have a winner from face-off
                            await self._announce_winner(guild, winner, from_face_off=True)
                            await self._end_face_off(guild)
                            return
            
            # Normal voting phase end
            winning_teams, is_tie, vote_counts = await self._determine_winners(guild)
            
            if not winning_teams:
                # No votes or error, cancel week
                await self._cancel_week_and_restart(guild, "No votes received")
                return
            
            if is_tie and len(winning_teams) > 1:
                # Start face-off
                success = await self._start_face_off(guild, winning_teams)
                
                if success:
                    # Delay next week start by 1 day (Tuesday instead of Monday)
                    # The scheduler will handle this automatically when it detects face_off_active
                    return
                else:
                    # Face-off failed to start, pick random winner
                    import random
                    winner = random.choice(winning_teams)
                    await self._announce_winner(guild, winner, vote_counts=vote_counts)
            else:
                # Clear winner
                winner = winning_teams[0]
                await self._announce_winner(guild, winner, vote_counts=vote_counts)
                
        except Exception as e:
            print(f"Error processing voting end: {e}")
            # Fallback: cancel week
            await self._cancel_week_and_restart(guild, f"Error processing results: {e}")
    
    async def _announce_winner(self, guild: discord.Guild, winning_team: str, 
                             vote_counts: dict = None, from_face_off: bool = False):
        """Announce the winning team and distribute rewards"""
        try:
            week = self._get_current_week()
            
            # Get team members
            team_members_data = await self.config.guild(guild).team_members()
            week_teams = team_members_data.get(week, {})
            members = week_teams.get(winning_team, [])
            
            # Create winner announcement
            channel_id = await self.config.guild(guild).announcement_channel()
            channel = guild.get_channel(channel_id) if channel_id else None
            
            if channel:
                # Get current theme
                current_theme = await self.config.guild(guild).current_theme()
                
                # Create announcement with rep rewards
                winner_message = await self._create_winner_announcement_with_rep(
                    guild, winning_team, members, current_theme, vote_counts, from_face_off
                )
                
                embed = discord.Embed(
                    title="🏆 WINNER ANNOUNCEMENT! 🏆",
                    description=winner_message,
                    color=discord.Color.gold()
                )
                
                embed.set_footer(text="SoundGarden's Collab Warz - Victory!")
                
                use_ping = await self.config.guild(guild).use_everyone_ping()
                content = "@everyone 🎉 **WINNER ANNOUNCEMENT!** 🎉" if use_ping else None
                
                await channel.send(content=content, embed=embed)
            
            # Record winner and distribute rep
            await self._record_weekly_winner(guild, winning_team, members)
            
            # Mark winner as announced
            await self.config.guild(guild).winner_announced.set(True)
            
        except Exception as e:
            print(f"Error announcing winner: {e}")
    
    @commands.Cog.listener()
    async def on_reaction_add(self, reaction, user):
        """Handle reactions on confirmation messages"""
        if user.bot:
            return
        
        # Check if this is a DM and the message is a confirmation request
        if not isinstance(reaction.message.channel, discord.DMChannel):
            return
        
        # Look for confirmation messages
        for guild in self.bot.guilds:
            admin_id = await self.config.guild(guild).admin_user_id()
            if admin_id != user.id:
                continue
            
            pending = await self.config.guild(guild).pending_announcement()
            if not pending:
                continue
            
            # Check if this is a confirmation message (has the right embed)
            if (reaction.message.embeds and 
                "Collab Warz - Confirmation Required" in reaction.message.embeds[0].title):
                
                if str(reaction.emoji) == "✅":
                    # Approve announcement
                    channel = guild.get_channel(pending["channel_id"])
                    if channel:
                        await self._post_announcement(
                            channel, guild, pending["type"], 
                            pending["theme"], pending.get("deadline"), force=True
                        )
                        await user.send(f"✅ Announcement approved and posted in {guild.name}")
                
                elif str(reaction.emoji) == "❌":
                    # Deny announcement
                    await self.config.guild(guild).pending_announcement.set(None)
                    await user.send(f"❌ Announcement cancelled for {guild.name}")
                
                elif str(reaction.emoji) == "🔄":
                    # Request new theme
                    await user.send(
                        f"🔄 **Theme change requested for {guild.name}**\n\n"
                        f"Reply with: `newtheme: Your New Theme Here`\n\n"
                        f"Example: `newtheme: Space Odyssey`\n"
                        f"The announcement will be posted immediately with the new theme."
                    )
            
            # Check for next week theme confirmation messages
            if (reaction.message.embeds and 
                "Next Week Theme Suggestion" in reaction.message.embeds[0].title):
                
                if str(reaction.emoji) == "✅":
                    # Approve next week theme
                    next_theme = await self.config.guild(guild).next_week_theme()
                    if next_theme:
                        await user.send(f"✅ Theme '{next_theme}' approved for next week in {guild.name}")
                        # Theme will be automatically applied on Monday
                
                elif str(reaction.emoji) == "❌":
                    # Deny next week theme - keep current theme
                    await self.config.guild(guild).next_week_theme.set(None)
                    await user.send(f"❌ Next week theme rejected for {guild.name}. Current theme will continue.")
                
                elif str(reaction.emoji) == "🎨":
                    # Request custom theme for next week
                    await user.send(
                        f"🎨 **Custom theme requested for next week in {guild.name}**\n\n"
                        f"Reply with: `nexttheme: Your Custom Theme Here`\n\n"
                        f"Example: `nexttheme: Underwater Adventure`\n"
                        f"This theme will be used starting Monday."
                    )
    
    @commands.Cog.listener()
    async def on_message(self, message):
        """Handle DM responses from admins for theme changes"""
        if message.author.bot or not isinstance(message.channel, discord.DMChannel):
            return
        
        # Check if this is a theme change response
        if message.content.lower().startswith("newtheme:"):
            new_theme = message.content[9:].strip()
            
            if not new_theme:
                await message.author.send("❌ Please provide a theme after 'newtheme:'")
                return
            
            # Find the guild this admin manages
            for guild in self.bot.guilds:
                admin_id = await self.config.guild(guild).admin_user_id()
                if admin_id != message.author.id:
                    continue
                
                pending = await self.config.guild(guild).pending_announcement()
                if not pending:
                    continue
                
                # Update theme and post announcement
                await self.config.guild(guild).current_theme.set(new_theme)
                pending["theme"] = new_theme
                
                channel = guild.get_channel(pending["channel_id"])
                if channel:
                    await self._post_announcement(
                        channel, guild, pending["type"], 
                        new_theme, pending.get("deadline"), force=True
                    )
                    await message.author.send(f"✅ Theme changed to '{new_theme}' and announcement posted in {guild.name}")
                break
        
        # Check if this is a next week theme response
        elif message.content.lower().startswith("nexttheme:"):
            new_theme = message.content[10:].strip()
            
            if not new_theme:
                await message.author.send("❌ Please provide a theme after 'nexttheme:'")
                return
            
            # Find the guild this admin manages
            for guild in self.bot.guilds:
                admin_id = await self.config.guild(guild).admin_user_id()
                if admin_id != message.author.id:
                    continue
                
                # Set the custom theme for next week
                await self.config.guild(guild).next_week_theme.set(new_theme)
                await message.author.send(f"✅ Custom theme '{new_theme}' set for next week in {guild.name}. It will be applied on Monday.")
                break
    
    async def _update_artist_suno_profile(self, guild, user_id, suno_url):
        """Update an artist's Suno profile URL"""
        artists_db = await self.config.guild(guild).artists_db()
        
        # Find or create artist entry
        artist_entry = None
        for artist_data in artists_db.values():
            if artist_data["discord_user_id"] == user_id:
                artist_entry = artist_data
                break
        
        if artist_entry:
            # Update existing artist
            artist_entry["suno_profile"] = suno_url
        else:
            # Create new artist entry
            member = guild.get_member(user_id)
            if not member:
                return False
                
            artist_id = f"artist_{len(artists_db) + 1}"
            artists_db[artist_id] = {
                "discord_user_id": user_id,
                "discord_username": member.name,
                "display_name": member.display_name,
                "suno_profile": suno_url,
                "submission_count": 0,
                "total_votes": 0,
                "wins": 0,
                "created_at": datetime.utcnow().isoformat()
            }
        
        await self.config.guild(guild).artists_db.set(artists_db)
        return True


async def setup(bot: Red):
    """Load the CollabWarz cog"""
    await bot.add_cog(CollabWarz(bot))
