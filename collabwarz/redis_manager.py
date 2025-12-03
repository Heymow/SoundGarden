import asyncio
import json
import os
import sys
import subprocess
import traceback
import importlib
from datetime import datetime
from typing import Optional

import aiohttp
import discord
from redbot.core import commands

try:
    import redis.asyncio as redis
    REDIS_AVAILABLE = True
except ImportError:
    REDIS_AVAILABLE = False
    redis = None

class RedisManager:
    def __init__(self, cog):
        self.cog = cog
        self.bot = cog.bot
        self.config = cog.config
        self.redis_client = None
        self.backend_error_throttle = {}

    async def _init_redis_connection(self, guild_for_config=None) -> bool:
        """Initialize Redis connection for admin panel communication."""
        global REDIS_AVAILABLE, redis
        if not REDIS_AVAILABLE:
            try:
                mod = importlib.import_module('redis.asyncio')
                redis = mod
                REDIS_AVAILABLE = True
            except Exception:
                print("⚠️ CollabWarz: redis.asyncio package not installed; install 'redis' package to enable Redis support")
                return False

        try:
            redis_url = None
            if guild_for_config:
                try:
                    redis_url = await self.config.guild(guild_for_config).redis_url()
                except Exception:
                    redis_url = None

            if not redis_url:
                redis_url = os.environ.get('REDIS_URL') or os.environ.get('REDIS_PRIVATE_URL')

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

            self.redis_client = redis.from_url(redis_url, decode_responses=True)
            await self.redis_client.ping()
            print(f"✅ CollabWarz: Redis connected for admin panel communication ({redis_url})")
            return True

        except Exception as e:
            await self.cog._maybe_noisy_log(f"❌ CollabWarz: Failed to connect to Redis: {e}")
            self.redis_client = None
            return False

    async def _attempt_runtime_install_redis(self, ctx: Optional[commands.Context] = None) -> bool:
        """Attempt to install redis (asyncio flavour) at runtime via pip then import it."""
        try:
            importlib.import_module('redis.asyncio')
            return True
        except Exception:
            pass

        loop = asyncio.get_running_loop()
        def _install():
            try:
                print("🔁 CollabWarz: Attempting to install redis via pip...")
                subprocess.check_call([sys.executable, '-m', 'pip', 'install', 'redis>=4.5.0'])
                return True
            except Exception as e:
                print(f"❌ CollabWarz: pip install redis failed: {e}")
                return False

        ok = await loop.run_in_executor(None, _install)
        if not ok:
            if ctx:
                try:
                    await ctx.send("❌ Failed to install redis via pip. Please install package in the environment or redeploy.")
                except Exception:
                    pass
            return False

        try:
            mod = importlib.import_module('redis.asyncio')
            globals()['redis'] = mod
            globals()['REDIS_AVAILABLE'] = True
            return True
        except Exception as e:
            if ctx:
                try:
                    await ctx.send(f"❌ Unable to import redis even after install: {e}")
                except Exception:
                    pass
            return False

    async def _safe_redis_setex(self, key, ttl, value, guild=None):
        """Safely set a key in Redis, with minor retries and reconnection attempts."""
        rc = self.redis_client
        if rc is None:
            try:
                if guild:
                    await self._init_redis_connection(guild_for_config=guild)
                else:
                    await self._init_redis_connection()
                rc = self.redis_client
            except Exception as e:
                await self.cog._maybe_noisy_log(f"⚠️ CollabWarz: Unable to (re)initialize Redis: {e}")
                rc = None

        if rc is None:
            await self.cog._maybe_noisy_log(f"⚠️ CollabWarz: Redis client not available; not saving key {key}", guild=guild)
            return False

        try:
            if not rc or not hasattr(rc, 'setex'):
                try:
                    if guild:
                        await self._init_redis_connection(guild_for_config=guild)
                    else:
                        await self._init_redis_connection()
                    rc = self.redis_client
                except Exception:
                    rc = None
            if not rc:
                await self.cog._maybe_noisy_log(f"⚠️ CollabWarz: Redis client not usable; not saving key {key}", guild=guild)
                return False
            if not hasattr(rc, 'setex'):
                await self.cog._maybe_noisy_log(f"⚠️ CollabWarz: Redis client lacks setex; not saving key {key}", guild=guild)
                return False
            try:
                await rc.setex(key, ttl, value)
                return True
            except Exception as e:
                await self.cog._maybe_noisy_log(f"⚠️ CollabWarz: setex failed for key {key}: {e}", guild=guild)
                return False
        except Exception as e:
            await self.cog._maybe_noisy_log(f"⚠️ CollabWarz: Unexpected error saving key {key} with TTL {ttl} in Redis: {e}", guild=guild)
            return False

    async def _post_with_temp_session(self, url, json_payload=None, headers=None, timeout=10, guild=None):
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
            msg = f"❌ CollabWarz: _post_with_temp_session error for {url}: {e} (type={type(e)})"
            if 'session is closed' in str(e).lower():
                return None, None
            suppressed = await self.cog._is_noisy_logs_suppressed(guild)
            if suppressed:
                await self.cog._maybe_noisy_log(msg, guild=guild)
            else:
                print(msg)
                traceback.print_exc()
            return None, None

    async def _get_with_temp_session(self, url, headers=None, timeout=10, guild=None):
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
            msg = f"❌ CollabWarz: _get_with_temp_session error for {url}: {e} (type={type(e)})"
            if 'session is closed' in str(e).lower():
                return None, None
            suppressed = await self.cog._is_noisy_logs_suppressed(guild)
            if suppressed:
                await self.cog._maybe_noisy_log(msg, guild=guild)
            else:
                print(msg)
                traceback.print_exc()
            return None, None

    async def _safe_redis_set(self, key, value, guild=None):
        """Safely set a value in Redis, with basic reconnect/attempts."""
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
            await self.cog._maybe_noisy_log(f"⚠️ CollabWarz: Redis client not available; not setting key {key}", guild=guild)
            return False

        try:
            await rc.set(key, value)
            try:
                print(f"🔁 _safe_redis_set: Set key {key} (guild={getattr(guild, 'id', None)})")
            except Exception:
                pass
            return True
        except Exception as e:
            await self.cog._maybe_noisy_log(f"⚠️ CollabWarz: Unable to set key {key} in Redis: {e}", guild=guild)
            try:
                print(f"⚠️ _safe_redis_set: Failed to set key {key}: {e}")
            except Exception:
                pass
            return False

    async def _update_redis_status(self, guild):
        """Update competition status in Redis for admin panel and return the status dictionary."""
        try:
            current_phase = await self.config.guild(guild).current_phase()
            current_theme = await self.config.guild(guild).current_theme()
            auto_announce = await self.config.guild(guild).auto_announce()
            week_cancelled = await self.config.guild(guild).week_cancelled()
            
            team_count = await self.cog._count_participating_teams(guild)
            
            try:
                cfg_all = await self.config.guild(guild).all()
            except Exception:
                cfg_all = {}
            
            try:
                retry_attempts = 3
                need_retry = False
                for k in ('announcement_channel', 'submission_channel', 'test_channel'):
                    if cfg_all.get(k) is None:
                        try:
                            val = await getattr(self.config.guild(guild), k)()
                        except Exception:
                            val = None
                        if val is not None:
                            need_retry = True
                            break
                if need_retry:
                    for i in range(retry_attempts):
                        try:
                            await asyncio.sleep(0.05)
                            cfg_all = await self.config.guild(guild).all()
                            if any(cfg_all.get(k) is not None for k in ('announcement_channel', 'submission_channel', 'test_channel')):
                                break
                        except Exception:
                            continue
            except Exception:
                pass

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
            
            try:
                if hasattr(self.cog, '_cog_start_ts') and self.cog._cog_start_ts:
                    uptime_seconds = int((datetime.utcnow() - self.cog._cog_start_ts).total_seconds())
                    status_data['cog_uptime_seconds'] = uptime_seconds
                    days = uptime_seconds // (60 * 60 * 24)
                    hours = (uptime_seconds % (60 * 60 * 24)) // (60 * 60)
                    minutes = (uptime_seconds % (60 * 60)) // 60
                    seconds = uptime_seconds % 60
                    readable = []
                    if days: readable.append(f"{days} day{'s' if days != 1 else ''}")
                    if hours: readable.append(f"{hours} hour{'s' if hours != 1 else ''}")
                    if minutes: readable.append(f"{minutes} minute{'s' if minutes != 1 else ''}")
                    if not readable:
                        readable.append(f"{seconds} second{'s' if seconds != 1 else ''}")
                    status_data['cog_uptime_readable'] = ", ".join(readable)
            except Exception:
                pass
            
            try:
                if guild and hasattr(guild, 'member_count'):
                    status_data['guild_member_count'] = getattr(guild, 'member_count', None)
            except Exception:
                pass
            
            try:
                if cfg_all and isinstance(cfg_all, dict):
                    ac = cfg_all.get('announcement_channel')
                    sc = cfg_all.get('submission_channel')
                    tc = cfg_all.get('test_channel')
                    status_data['announcement_channel'] = str(ac) if ac is not None else None
                    status_data['submission_channel'] = str(sc) if sc is not None else None
                    status_data['test_channel'] = str(tc) if tc is not None else None
                    status_data['require_confirmation'] = cfg_all.get('require_confirmation')
                    status_data['use_everyone_ping'] = cfg_all.get('use_everyone_ping')
                    status_data['min_teams_required'] = cfg_all.get('min_teams_required')
                    status_data['api_server_enabled'] = cfg_all.get('api_server_enabled')
                    status_data['api_server_port'] = cfg_all.get('api_server_port')
                else:
                    try:
                        ac = await getattr(self.config.guild(guild), 'announcement_channel')()
                    except Exception:
                        ac = None
                    try:
                        sc = await getattr(self.config.guild(guild), 'submission_channel')()
                    except Exception:
                        sc = None
                    try:
                        tc = await getattr(self.config.guild(guild), 'test_channel')()
                    except Exception:
                        tc = None
                    status_data['announcement_channel'] = str(ac) if ac is not None else None
                    status_data['submission_channel'] = str(sc) if sc is not None else None
                    status_data['test_channel'] = str(tc) if tc is not None else None
                    try:
                        status_data['require_confirmation'] = await getattr(self.config.guild(guild), 'require_confirmation')()
                    except Exception:
                        status_data['require_confirmation'] = None
                    try:
                        status_data['use_everyone_ping'] = await getattr(self.config.guild(guild), 'use_everyone_ping')()
                    except Exception:
                        status_data['use_everyone_ping'] = None
                    try:
                        status_data['min_teams_required'] = await getattr(self.config.guild(guild), 'min_teams_required')()
                    except Exception:
                        status_data['min_teams_required'] = None
                    try:
                        status_data['api_server_enabled'] = await getattr(self.config.guild(guild), 'api_server_enabled')()
                    except Exception:
                        status_data['api_server_enabled'] = None
                    try:
                        status_data['api_server_port'] = await getattr(self.config.guild(guild), 'api_server_port')()
                    except Exception:
                        status_data['api_server_port'] = None
            except Exception as e:
                print(f"⚠️ _update_redis_status: Failed while building status_data from cfg_all or getters: {e}")

            try:
                status_data['submissions'] = submissions or {}
                try:
                    submitted_teams = cfg_all.get('submitted_teams') or {}
                    status_data['submitted_teams'] = submitted_teams or {}
                except Exception:
                    status_data['submitted_teams'] = {}
                status_data['voting_results'] = voting_results or {}
                status_data['team_members'] = team_members or {}
                try:
                    recent = []
                    for wk, data in (weeks_db or {}).items():
                        recent.append({
                            'week': wk,
                            'theme': data.get('theme'),
                            'winner': data.get('winner'),
                            'date': data.get('date')
                        })
                    recent.sort(key=lambda x: x.get('date') or '')
                    status_data['weeks'] = recent[-10:]
                except Exception:
                    status_data['weeks'] = []
            except Exception:
                pass
            
            try:
                redis_enabled = await self.config.guild(guild).redis_enabled()
            except Exception:
                redis_enabled = False
            if redis_enabled:
                await self._safe_redis_set('collabwarz:status', json.dumps(status_data), guild=guild)

            return status_data
            
        except Exception as e:
            await self.cog._maybe_noisy_log(f"❌ CollabWarz: Failed to update Redis status: {e}", guild=guild)
            return None

    async def _log_backend_error(self, guild, message, interval=120):
        """Throttle backend error messages per guild for a given interval (seconds)."""
        if getattr(self.cog, '_shutdown', False):
            return
        try:
            if isinstance(message, str) and 'session is closed' in message.lower():
                return
        except Exception:
            pass
        gid = getattr(guild, 'id', None)
        if gid is None:
            await self.cog._maybe_noisy_log(message)
            return
        last = self.backend_error_throttle.get(gid, 0)
        now = asyncio.get_running_loop().time()
        if now - last > interval:
            await self.cog._maybe_noisy_log(message, guild=guild)
            self.backend_error_throttle[gid] = now

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
        
        try:
            print(f"🎯 CollabWarz: Processing Redis action '{action}' (ID: {action_id})")
        except Exception:
            print("🎯 CollabWarz: Processing Redis action (unable to format action debug)")

        try:
            norm_action = (action or '').strip().lower().replace('-', '_').replace(' ', '_')
        except Exception:
            norm_action = action
        
        try:
            safe_mode = await self.config.guild(guild).safe_mode_enabled()
        except Exception:
            safe_mode = getattr(self.cog, 'safe_mode_enabled', False)
        
        try:
            if action == 'start_phase':
                phase = params.get('phase', 'submission')
                theme = params.get('theme')
                
                if theme:
                    await self.config.guild(guild).current_theme.set(theme)
                await self.config.guild(guild).current_phase.set(phase)
                await self.config.guild(guild).week_cancelled.set(False)
                
                print(f"✅ Phase started: {phase} with theme: {theme}")
                await self.cog._send_competition_log(f"Phase started: {phase} with theme: {theme}", guild=guild)
                
            elif action == 'end_phase':
                current_phase = await self.config.guild(guild).current_phase()
                if current_phase == 'submission':
                    await self.config.guild(guild).current_phase.set('voting')
                elif current_phase == 'voting':
                    await self.config.guild(guild).current_phase.set('ended')
                
                new_phase = await self.config.guild(guild).current_phase()
                print(f"✅ Phase ended, new phase: {new_phase}")
                await self.cog._send_competition_log(f"Phase ended, new phase: {new_phase}", guild=guild)
                
            elif action == 'cancel_week':
                await self.config.guild(guild).week_cancelled.set(True)
                await self.config.guild(guild).current_phase.set('cancelled')
                
                print("✅ Week cancelled")
                await self.cog._send_competition_log("Week cancelled", guild=guild)
                
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
                    try:
                        old_phase = await self.config.guild(guild).current_phase()
                        await self.config.guild(guild).current_phase.set(phase)
                        print(f"✅ Phase set to: {phase}")
                        await self.cog._send_competition_log(f"Phase changed: {old_phase} -> {phase}", guild=guild)
                    except Exception as e:
                        await self.cog._maybe_noisy_log(f"❌ Failed to set phase to {phase}: {e}", guild=guild)
                else:
                    print(f"❌ Invalid phase: {phase}")

            elif action == 'next_phase':
                try:
                    current_phase = await self.config.guild(guild).current_phase()
                    if current_phase == 'submission':
                        new_phase = 'voting'
                        await self.config.guild(guild).current_phase.set(new_phase)
                        print("✅ Advanced to voting")
                    elif current_phase == 'voting':
                        new_phase = 'ended'
                        await self.config.guild(guild).current_phase.set(new_phase)
                        print("✅ Advanced to ended")
                    else:
                        new_phase = 'submission'
                        await self.config.guild(guild).current_phase.set(new_phase)
                        print("✅ Reset to submission")
                    await self.cog._send_competition_log(f"Phase advanced: {current_phase} -> {new_phase}", guild=guild)
                except Exception as e:
                    await self.cog._maybe_noisy_log(f"❌ Failed to advance phase: {e}", guild=guild)

            elif action == 'start_new_week':
                theme = params.get('theme')
                if theme:
                    await self.config.guild(guild).current_theme.set(theme)
                    await self.config.guild(guild).current_phase.set('submission')
                    await self.config.guild(guild).week_cancelled.set(False)
                    await self.cog._clear_submissions_safe(guild)
                    print(f"✅ New week started with theme: {theme}")
                else:
                    print("❌ start_new_week requires a theme")

            elif action == 'clear_submissions':
                if safe_mode:
                    print(f"⚠️ Clear submissions blocked by Safe Mode for guild {guild.name}")
                else:
                    await self.cog._clear_submissions_safe(guild)
                    print("✅ Submissions cleared")

            elif action == 'remove_submission':
                team_name = params.get('team_name')
                if team_name:
                    if safe_mode:
                        print(f"⚠️ Remove submission blocked by Safe Mode (team: {team_name}) in guild {guild.name}")
                    else:
                        submissions = await self.cog._get_submissions_safe(guild)
                        if team_name in submissions:
                            del submissions[team_name]
                            await self.cog._set_submissions_safe(guild, submissions)
                            print(f"✅ Removed submission for team {team_name}")
                        else:
                            print(f"⚠️ No submission found for team {team_name}")
                else:
                    print("❌ remove_submission requires team_name")

            elif action == 'remove_vote':
                week = params.get('week')
                user_id = params.get('user_id')
                if week and user_id:
                    if safe_mode:
                        print(f"⚠️ Remove vote blocked by Safe Mode (week: {week}, user: {user_id}) in guild {guild.name}")
                    else:
                        votes = await self.config.guild(guild).individual_votes()
                        week_votes = votes.get(week, {})
                        if str(user_id) in week_votes:
                            del week_votes[str(user_id)]
                            votes[week] = week_votes
                            await self.config.guild(guild).individual_votes.set(votes)
                            print(f"✅ Removed vote from user {user_id} for week {week}")
                        else:
                            print(f"⚠️ No vote from user {user_id} found for week {week}")
                else:
                    print("❌ remove_vote requires week and user_id")

            elif action == "reset_week":
                if safe_mode:
                    print(f"⚠️ Reset week blocked by Safe Mode in guild {guild.name}")
                else:
                    try:
                        old_phase = await self.config.guild(guild).current_phase()
                        await self.config.guild(guild).current_phase.set('submission')
                        await self.config.guild(guild).week_cancelled.set(False)
                        await self.cog._clear_submissions_safe(guild)
                        await self.config.guild(guild).voting_results.clear()
                        await self.config.guild(guild).weekly_winners.clear()
                        print("✅ Week reset")
                        await self.cog._send_competition_log(f"Week reset: {old_phase} -> submission", guild=guild)
                    except Exception as e:
                        await self.cog._maybe_noisy_log(f"❌ Failed to reset week: {e}", guild=guild)

            elif action == 'force_voting':
                try:
                    old_phase = await self.config.guild(guild).current_phase()
                    await self.config.guild(guild).current_phase.set('voting')
                    await self.config.guild(guild).week_cancelled.set(False)
                    print("✅ Force set to voting phase")
                    await self.cog._send_competition_log(f"Phase forced: {old_phase} -> voting", guild=guild)
                except Exception as e:
                    await self.cog._maybe_noisy_log(f"❌ Failed to force voting: {e}", guild=guild)

            elif action == 'announce_winners':
                try:
                    await self.cog._process_voting_end(guild)
                    print("✅ Announce winners triggered")
                    await self.cog._send_competition_log("Winners announced", guild=guild)
                except Exception as e:
                    await self.cog._maybe_noisy_log(f"❌ Failed to announce winners: {e}", guild=guild)
            
            elif action == 'update_config':
                updates = params.get('updates') if isinstance(params, dict) else None
                print(f"🔁 update_config raw updates: {updates}")
                if not updates or not isinstance(updates, dict):
                    print("⚠️ update_config: no updates provided")
                else:
                    allowed = {
                        'announcement_channel': 'announcement_channel',
                        'submission_channel': 'submission_channel',
                        'test_channel': 'test_channel',
                        'auto_announce': 'auto_announce',
                        'require_confirmation': 'require_confirmation',
                        'safe_mode_enabled': 'safe_mode_enabled',
                        'api_server_enabled': 'api_server_enabled',
                        'api_server_port': 'api_server_port',
                        'use_everyone_ping': 'use_everyone_ping',
                        'min_teams_required': 'min_teams_required'
                    }
                    try:
                        changes = []
                        for k,v in updates.items():
                            if k not in allowed: continue
                            cfgkey = allowed[k]
                            try:
                                v_parsed = v
                                try:
                                    if isinstance(v, str) and v.lower() in ('true','false','1','0','yes','no'):
                                        v_parsed = v.lower() in ('true','1','yes')
                                    if cfgkey in ('min_teams_required', 'api_server_port'):
                                        if isinstance(v_parsed, str) and v_parsed.strip() == '':
                                            v_parsed = None
                                        else:
                                            try:
                                                v_int = int(v_parsed)
                                                v_parsed = v_int
                                            except Exception:
                                                pass
                                except Exception:
                                    v_parsed = v
                            except Exception:
                                v_parsed = v
                            try:
                                try:
                                    prev = await getattr(self.config.guild(guild), cfgkey)()
                                except Exception:
                                    prev = None
                                if prev is None and cfgkey == 'min_teams_required':
                                    prev = 2
                                print(f"🔁 update_config: {k}: {prev} -> {v_parsed}")
                                cfg_obj = getattr(self.config.guild(guild), cfgkey)
                                if v_parsed is None:
                                    print(f"⚠️ Skipping update for {k}: value is None (no change)")
                                else:
                                    try:
                                        if cfgkey in ('announcement_channel', 'submission_channel', 'test_channel'):
                                            try:
                                                if isinstance(v_parsed, int):
                                                    v_parsed = str(v_parsed)
                                                elif isinstance(v_parsed, str) and v_parsed.isdigit():
                                                    pass
                                                else:
                                                    pass
                                            except Exception:
                                                pass
                                        print(f"🔁 update_config: setting {k} = {v_parsed} (type {type(v_parsed).__name__})")

                                        max_attempts = 4
                                        attempt = 0
                                        set_ok = False
                                        while attempt < max_attempts:
                                            attempt += 1
                                            try:
                                                await cfg_obj.set(v_parsed)
                                                await asyncio.sleep(0.05)
                                            except Exception as inner_e:
                                                print(f"⚠️ Failed to set {cfgkey} on attempt {attempt}: {inner_e}")
                                                continue
                                            try:
                                                new_val = await getattr(self.config.guild(guild), cfgkey)()
                                            except Exception as inner_read_e:
                                                print(f"⚠️ Readback failed for {cfgkey} on attempt {attempt}: {inner_read_e}")
                                                new_val = None
                                            try:
                                                compare_new = new_val
                                                compare_expected = v_parsed
                                                if cfgkey in ('announcement_channel', 'submission_channel', 'test_channel'):
                                                    if compare_new is not None:
                                                        compare_new = str(compare_new)
                                                    compare_expected = str(compare_expected) if compare_expected is not None else None
                                            except Exception:
                                                compare_new = new_val
                                                compare_expected = v_parsed
                                            print(f"🔍 Readback after set attempt {attempt}: {k} -> {new_val} (expected {v_parsed})")
                                            if compare_new == compare_expected:
                                                set_ok = True
                                                break
                                        if not set_ok:
                                            print(f"⚠️ update_config: Could not confirm persistence for {k} after {max_attempts} attempts (last read: {new_val})")
                                    except Exception as inner_e:
                                        print(f"⚠️ Failed to set {cfgkey}: {inner_e}")
                            except Exception:
                                try:
                                    await self.config.guild(guild).__getattribute__(cfgkey).set(v_parsed)
                                except Exception as inner_e:
                                    print(f"⚠️ Failed to set config key {cfgkey} = {v_parsed}: {inner_e}")
                            changes.append(f"{k} -> {v_parsed}")
                        if changes:
                            await self.cog._send_competition_log(f"Config updated: {', '.join(changes)}", guild=guild)
                            try:
                                try:
                                    await asyncio.sleep(0.1)
                                except Exception:
                                    pass
                                status_after = await self._update_redis_status(guild)
                                try:
                                    backend_url = await self.config.guild(guild).backend_url() if guild else None
                                    backend_token = await self.config.guild(guild).backend_token() if guild else None
                                except Exception:
                                    backend_url = None
                                    backend_token = None
                                if backend_url and backend_token and status_after:
                                    try:
                                        await self._post_with_temp_session(backend_url.rstrip('/') + '/api/collabwarz/status', json_payload=status_after, headers={"X-CW-Token": backend_token, "Authorization": f"Bearer {backend_token}"}, guild=guild)
                                    except Exception as e:
                                        await self.cog._maybe_noisy_log(f"⚠️ CollabWarz: Failed to post status to backend: {e}", guild=guild)
                                        pass
                            except Exception:
                                pass
                            try:
                                print("✅ update_config applied:", ", ".join(changes))
                            except Exception:
                                pass
                        else:
                            print("⚠️ update_config: no recognized changes applied")
                    except Exception as e:
                        await self.cog._maybe_noisy_log(f"❌ Failed to apply update_config: {e}", guild=guild)

            elif norm_action in ("backup_data", "backupdata", "export_backup", "exportbackup"):
                try:
                    try:
                        cfg_all = await self.config.guild(guild).all()
                    except Exception:
                        cfg_all = {}
                    backup = {
                        "guild_id": guild.id,
                        "guild_name": guild.name,
                        "timestamp": datetime.utcnow().isoformat(),
                        "current_theme": cfg_all.get('current_theme'),
                        "current_phase": cfg_all.get('current_phase'),
                        "submitted_teams": cfg_all.get('submitted_teams', {}),
                        "submissions": cfg_all.get('submissions', {}),
                        "teams_db": cfg_all.get('teams_db', {}),
                        "artists_db": cfg_all.get('artists_db', {}),
                        "songs_db": cfg_all.get('songs_db', {}),
                        "weeks_db": cfg_all.get('weeks_db', {}),
                        "voting_results": cfg_all.get('voting_results', {}),
                        "next_unique_ids": cfg_all.get('next_unique_ids', {}),
                        "settings": {
                            "auto_announce": cfg_all.get('auto_announce'),
                            "suppress_noisy_logs": cfg_all.get('suppress_noisy_logs'),
                            "safe_mode_enabled": cfg_all.get('safe_mode_enabled', False),
                        },
                    }
                    try:
                        admin_user = action_data.get('admin_user') or action_data.get('user')
                        if admin_user:
                            try:
                                if isinstance(admin_user, (int, str)):
                                    try:
                                        member = guild.get_member(int(admin_user)) if hasattr(guild, 'get_member') else None
                                    except Exception:
                                        member = None
                                    display_name = None
                                    if member:
                                        display_name = getattr(member, 'display_name', None) or getattr(member, 'name', None)
                                    backup['created_by'] = {'user_id': admin_user, 'display_name': display_name}
                                else:
                                    backup['created_by'] = {'user_id': admin_user, 'display_name': None}
                            except Exception:
                                backup['created_by'] = {'user_id': admin_user, 'display_name': None}
                    except Exception:
                        pass
                    
                    file_name = f"backup_g{guild.id}_{datetime.utcnow().strftime('%Y%m%dT%H%M%SZ')}.json"
                    path = os.path.join(self.cog.backup_dir, file_name)
                    try:
                        with open(path, 'w', encoding='utf-8') as f:
                            json.dump(backup, f, indent=2, ensure_ascii=False)
                        try:
                            self.cog.latest_backup[guild.id] = file_name
                        except Exception:
                            pass
                        try:
                            if getattr(self.cog, 'pg_pool', None):
                                await self.cog._save_backup_to_db(guild, file_name, backup)
                        except Exception:
                            pass
                        print(f"✅ Backup written to {path}")
                        action_data['result'] = {"success": True, "backup_file": file_name, "backup": backup}
                    except Exception as e:
                        action_data['result'] = {"success": False, "message": f"Failed to write backup: {e}"}
                except Exception as e:
                    action_data['result'] = {"success": False, "message": str(e)}

            elif norm_action in ("list_backups", "get_backups", "backup_list", "backups_list"):
                try:
                    files = []
                    if getattr(self.cog, 'pg_pool', None):
                        try:
                            async with self.cog.pg_pool.acquire() as conn:
                                rows = await conn.fetch('SELECT file_name, size, created_by_user_id, created_by_display, created_at FROM backups WHERE guild_id=$1 ORDER BY created_at DESC', guild.id)
                                for row in rows:
                                    files.append({
                                        'file': row['file_name'],
                                        'size': int(row['size']) if row['size'] is not None else 0,
                                        'ts': row['created_at'].isoformat(),
                                        'created_by': {'user_id': row['created_by_user_id'], 'display_name': row['created_by_display']} if row['created_by_user_id'] else None
                                    })
                        except Exception:
                            pass
                    if os.path.isdir(self.cog.backup_dir):
                        prefix = f"backup_g{guild.id}_"
                        for fn in os.listdir(self.cog.backup_dir):
                            if fn.startswith(prefix) and fn.endswith('.json'):
                                path = os.path.join(self.cog.backup_dir, fn)
                                try:
                                    stat = os.stat(path)
                                    created_by = None
                                    try:
                                        with open(path, 'r', encoding='utf-8') as f:
                                            data = json.load(f)
                                            created_by = data.get('created_by')
                                    except Exception:
                                        created_by = None
                                    files.append({'file': fn, 'size': stat.st_size, 'ts': datetime.utcfromtimestamp(stat.st_mtime).isoformat(), 'created_by': created_by})
                                except Exception:
                                    continue
                    files.sort(key=lambda x: x['ts'], reverse=True)
                    action_data['result'] = { 'success': True, 'backups': files }
                except Exception as e:
                    action_data['result'] = { 'success': False, 'message': f'Failed to list backups: {e}' }

            elif norm_action in ("download_backup", "backup_download", "get_backup", "get_backup_file"):
                try:
                    filename = params.get('filename')
                    if not filename:
                        action_data['result'] = {'success': False, 'message':'Filename required'}
                    else:
                        found = False
                        if getattr(self.cog, 'pg_pool', None):
                            try:
                                async with self.cog.pg_pool.acquire() as conn:
                                    row = await conn.fetchrow('SELECT backup_content FROM backups WHERE guild_id=$1 AND file_name=$2 LIMIT 1', guild.id, filename)
                                    if row:
                                        action_data['result'] = {'success': True, 'backup': row['backup_content'], 'file': filename}
                                        found = True
                            except Exception:
                                pass
                        if not found:
                            filepath = os.path.join(self.cog.backup_dir, filename)
                            if os.path.exists(filepath):
                                try:
                                    with open(filepath, 'r', encoding='utf-8') as f:
                                        backup_json = json.load(f)
                                    action_data['result'] = {'success': True, 'backup': backup_json, 'file': filename}
                                    found = True
                                except Exception as e:
                                    action_data['result'] = {'success': False, 'message': f'Failed to read backup file: {e}'}
                            else:
                                action_data['result'] = {'success': False, 'message': 'File not found'}
                except Exception as e:
                    action_data['result'] = {'success': False, 'message': f'Failed to process download request: {e}'}

            elif norm_action == 'restore_backup':
                if safe_mode:
                    action_data['result'] = {'success': False, 'message': 'Restore blocked: Safe mode is enabled'}
                else:
                    backup = params.get('backup') or {}
                    if not isinstance(backup, dict):
                        action_data['result'] = {'success': False, 'message':'Missing or invalid backup object'}
                    else:
                        try:
                            if 'current_theme' in backup:
                                await self.config.guild(guild).current_theme.set(backup['current_theme'])
                            if 'current_phase' in backup:
                                await self.config.guild(guild).current_phase.set(backup['current_phase'])
                            if 'submitted_teams' in backup:
                                await self.config.guild(guild).submitted_teams.set(backup.get('submitted_teams') or {})
                            if 'submissions' in backup:
                                try:
                                    subs_group = getattr(self.config.guild(guild), 'submissions', None)
                                    if subs_group is not None:
                                        await subs_group.set(backup.get('submissions') or {})
                                except Exception:
                                    pass
                            if 'teams_db' in backup:
                                await self.config.guild(guild).teams_db.set(backup.get('teams_db') or {})
                            if 'artists_db' in backup:
                                await self.config.guild(guild).artists_db.set(backup.get('artists_db') or {})
                            if 'songs_db' in backup:
                                await self.config.guild(guild).songs_db.set(backup.get('songs_db') or {})
                            if 'weeks_db' in backup:
                                await self.config.guild(guild).weeks_db.set(backup.get('weeks_db') or {})
                            if 'voting_results' in backup:
                                await self.config.guild(guild).voting_results.set(backup.get('voting_results') or {})
                            if 'next_unique_ids' in backup:
                                await self.config.guild(guild).next_unique_ids.set(backup.get('next_unique_ids') or {})
                            settings = backup.get('settings') or {}
                            if settings:
                                if 'auto_announce' in settings:
                                    await self.config.guild(guild).auto_announce.set(settings.get('auto_announce'))
                                if 'suppress_noisy_logs' in settings:
                                    await self.config.guild(guild).suppress_noisy_logs.set(settings.get('suppress_noisy_logs'))
                                if 'safe_mode_enabled' in settings:
                                    await self.config.guild(guild).safe_mode_enabled.set(settings.get('safe_mode_enabled', False))
                            action_data['result'] = {'success': True, 'message': 'Backup restored successfully'}
                        except Exception as e:
                            action_data['result'] = {'success': False, 'message': f'Restore failed: {e}'}
                    
            elif action == 'set_safe_mode':
                enable = params.get('enable')
                if isinstance(enable, str):
                    v = enable.lower()
                    if v in ('true', '1'): enable = True
                    elif v in ('false', '0'): enable = False
                if not isinstance(enable, bool):
                    action_data['result'] = { 'success': False, 'message': 'Invalid enable parameter; expected boolean' }
                else:
                    try:
                        await self.config.guild(guild).safe_mode_enabled.set(bool(enable))
                        action_data['result'] = { 'success': True, 'safe_mode_enabled': bool(enable) }
                        print(f"✅ Safe mode {'enabled' if enable else 'disabled'} for guild {getattr(guild,'name',None)}")
                    except Exception as e:
                        action_data['result'] = { 'success': False, 'message': str(e) }

            else:
                await self.cog._maybe_noisy_log(f"❓ Unknown action: {repr(action)} (norm: {repr(norm_action)})", guild=guild)
                print(f"❓ Unknown action: {repr(action)} (norm: {repr(norm_action)}) - full action_data: {action_data}")
                action_data['status'] = 'failed'
                action_data['error'] = f'unknown action: {action}'
            
            action_data['status'] = 'completed'
            action_data['processed_at'] = datetime.utcnow().isoformat()
            
            try:
                redis_enabled = await self.config.guild(guild).redis_enabled()
            except Exception:
                redis_enabled = False
            saved_to_redis = False
            if redis_enabled:
                try:
                    await self.cog._maybe_noisy_log(f"🔁 Attempting to save action result to Redis (enabled={redis_enabled})", guild=guild)
                    await self.cog._maybe_noisy_log(f"🔁 Redis client presence: {bool(self.redis_client)}", guild=guild)
                    saved_to_redis = await self._safe_redis_setex(
                        f'collabwarz:action:{action_id}',
                        86400,
                        json.dumps(action_data),
                        guild=guild,
                    )
                    await self.cog._maybe_noisy_log(f"🔁 saveToRedis result: {saved_to_redis}", guild=guild)
                except Exception as e:
                    saved_to_redis = False
                    await self.cog._maybe_noisy_log(f"⚠️ Exception when saving action result to Redis: {e}", guild=guild)
            if not saved_to_redis:
                try:
                    backend_url = await self.config.guild(guild).backend_url()
                    backend_token = await self.config.guild(guild).backend_token()
                    if backend_url and backend_token:
                        result_url = backend_url.rstrip('/') + '/api/collabwarz/action-result'
                        headers = {"X-CW-Token": backend_token}
                        await self._post_with_temp_session(result_url, json_payload=action_data, headers=headers, timeout=10, guild=guild)
                except Exception as e:
                    if 'session is closed' in str(e).lower():
                        pass
                    else:
                        await self.cog._maybe_noisy_log(f"⚠️ CollabWarz: Failed to post action result to backend fallback: {e}", guild=guild)
            
            await self._update_redis_status(guild)

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
                                            await self._log_backend_error(guild, f"⚠️ CollabWarz: Backend result post (fallback) returned {presp.status}")
                except Exception as e:
                    if 'session is closed' in str(e).lower():
                        pass
                    else:
                        await self.cog._maybe_noisy_log(f"⚠️ CollabWarz: Failed to post action result to backend fallback: {e}", guild=guild)
            
        except Exception as e:
            await self.cog._maybe_noisy_log(f"❌ CollabWarz: Failed to process action '{action}': {e}", guild=guild)
            
            action_data['status'] = 'failed'
            action_data['error'] = str(e)
            action_data['processed_at'] = datetime.utcnow().isoformat()
            
            try:
                redis_enabled = await self.config.guild(guild).redis_enabled()
            except Exception:
                redis_enabled = False
            saved_to_redis = False
            if redis_enabled:
                try:
                    saved_to_redis = await self._safe_redis_setex(
                        f'collabwarz:action:{action_id}',
                        86400,
                        json.dumps(action_data),
                        guild=guild,
                    )
                except Exception as e:
                    saved_to_redis = False
                    await self.cog._maybe_noisy_log(f"⚠️ Exception when saving failed action result to Redis: {e}", guild=guild)
            if not saved_to_redis:
                try:
                    backend_url = await self.config.guild(guild).backend_url()
                    backend_token = await self.config.guild(guild).backend_token()
                    if backend_url and backend_token:
                        result_url = backend_url.rstrip('/') + '/api/collabwarz/action-result'
                        headers = {"X-CW-Token": backend_token}
                        await self._post_with_temp_session(result_url, json_payload=action_data, headers=headers, timeout=10, guild=guild)
                except Exception as e:
                    print(f"⚠️ CollabWarz: Failed to post failed action result to backend fallback: {e}")

    async def redis_communication_loop(self):
        """Main Redis communication loop - polls for actions and updates status"""
        await self.bot.wait_until_ready()
        
        if not await self._init_redis_connection():
            print("⚠️ CollabWarz: Redis not available, admin panel communication disabled")
            return
        
        print("🔄 CollabWarz: Started Redis communication loop")
        
        last_status_update = 0
        
        while True:
            if getattr(self.cog, '_shutdown', False):
                break
            try:
                for guild in self.bot.guilds:
                    try:
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
                        
                        now = asyncio.get_event_loop().time()
                        if now - last_status_update > 30:
                            await self._update_redis_status(guild)
                            last_status_update = now
                            
                    except Exception as e:
                        await self.cog._maybe_noisy_log(f"❌ CollabWarz: Error processing Redis for guild {guild.name}: {e}", guild=guild)
                
                await asyncio.sleep(5)
                
            except asyncio.CancelledError:
                break
            except Exception as e:
                print(f"❌ CollabWarz: Redis communication error: {e}")
                await asyncio.sleep(30)

    async def backend_communication_loop(self):
        """Main backend communication loop - polls for actions and updates status via HTTP"""
        await self.bot.wait_until_ready()
        print("🔄 CollabWarz: Started Backend communication loop")
        
        last_status_update = 0
        
        while True:
            if getattr(self.cog, '_shutdown', False):
                break
            try:
                for guild in self.bot.guilds:
                    try:
                        backend_url = None
                        backend_token = None
                        try:
                            backend_url = await self.config.guild(guild).backend_url()
                            backend_token = await self.config.guild(guild).backend_token()
                        except Exception:
                            pass
                        
                        if not backend_url or not backend_token:
                            continue

                        # Poll for actions
                        action_url = backend_url.rstrip('/') + '/api/collabwarz/action'
                        headers = {"X-CW-Token": backend_token}
                        
                        status, body = await self._get_with_temp_session(action_url, headers=headers, timeout=10, guild=guild)
                        
                        if status == 200 and body:
                            if isinstance(body, str):
                                try:
                                    body = json.loads(body)
                                except:
                                    pass
                            
                            if isinstance(body, dict) and body.get('action'):
                                await self._process_redis_action(guild, body)
                            elif isinstance(body, list):
                                for item in body:
                                    if isinstance(item, dict) and item.get('action'):
                                        await self._process_redis_action(guild, item)

                        # Update status periodically
                        now = asyncio.get_running_loop().time()
                        if now - last_status_update > 30:
                            status_data = await self._update_redis_status(guild)
                            if status_data:
                                status_url = backend_url.rstrip('/') + '/api/collabwarz/status'
                                await self._post_with_temp_session(status_url, json_payload=status_data, headers=headers, timeout=10, guild=guild)
                            last_status_update = now
                            
                    except Exception as e:
                        await self._log_backend_error(guild, f"❌ CollabWarz: Error processing Backend loop for guild {guild.name}: {e}")
                
                await asyncio.sleep(10) # Poll every 10 seconds
                
            except asyncio.CancelledError:
                break
            except Exception as e:
                print(f"❌ CollabWarz: Backend communication error: {e}")
                await asyncio.sleep(30)
