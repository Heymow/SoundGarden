"""
Database Manager for CollabWarz Discord Bot

Handles all database interactions including:
- PostgreSQL connection pool (asyncpg)
- Reputation management (AutoReputation integration)
- Competition data persistence (Artists, Teams, Weeks)
"""

import asyncio
import discord
from datetime import datetime
from typing import Optional, Dict, List, Any

try:
    import asyncpg
    PG_AVAILABLE = True
except ImportError:
    asyncpg = None
    PG_AVAILABLE = False


class DatabaseManager:
    def __init__(self, cog):
        """Initialize DatabaseManager with reference to parent cog"""
        self.cog = cog
        self.bot = cog.bot
        self.config = cog.config
        self.pg_pool = None
        
    async def init_pool(self):
        """Initialize PostgreSQL connection pool"""
        if not PG_AVAILABLE:
            print("asyncpg not installed, PostgreSQL features disabled.")
            return

        try:
            # Get database credentials from bot owner config or env vars
            # For now, we'll assume they are set in environment variables or a specific config
            # This is a placeholder implementation based on typical Redbot patterns
            # In a real scenario, we'd need to know where these are stored.
            # Assuming standard env vars for now as fallback.
            import os
            dsn = os.getenv("POSTGRES_DSN")
            
            if dsn:
                self.pg_pool = await asyncpg.create_pool(dsn)
                print("PostgreSQL connection pool initialized.")
            else:
                print("No POSTGRES_DSN found, PostgreSQL features disabled.")
                
        except Exception as e:
            print(f"Failed to initialize PostgreSQL pool: {e}")

    async def close_pool(self):
        """Close PostgreSQL connection pool"""
        if self.pg_pool:
            await self.pg_pool.close()
            self.pg_pool = None
            print("PostgreSQL connection pool closed.")

    # ========== REPUTATION MANAGEMENT ==========

    async def get_user_rep_count(self, guild, user_id: int) -> int:
        """Get user's current rep points using AutoReputation API"""
        try:
            # Get AutoReputation cog
            auto_rep = self.bot.get_cog('AutoReputation')
            if not auto_rep:
                # print("AutoReputation cog not found") # Reduce noise
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

    async def give_rep_to_user(self, guild, user_id: int, amount: int) -> bool:
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

    async def record_weekly_winner(self, guild, team_name: str, member_ids: list, week_key: str = None):
        """Record the competition winner and give rep rewards"""
        try:
            if week_key is None:
                week_key = await self.cog._get_competition_week_key(guild)
            
            # Record winner
            weekly_winners = await self.config.guild(guild).weekly_winners()
            rep_amount = await self.config.guild(guild).rep_reward_amount()
            
            # Give rep to each team member
            rep_results = {}
            for user_id in member_ids:
                success = await self.give_rep_to_user(guild, user_id, rep_amount)
                rep_results[user_id] = success
            
            # Record the winner with rep status
            weekly_winners[week_key] = {
                "team_name": team_name,
                "members": member_ids,
                "rep_given": rep_results,
                "timestamp": datetime.now().isoformat()
            }
            
            await self.config.guild(guild).weekly_winners.set(weekly_winners)
            
        except Exception as e:
            print(f"Error recording weekly winner: {e}")

    # ========== COMPREHENSIVE DATA MANAGEMENT SYSTEM ==========
    
    async def get_or_create_artist(self, guild, user_id: int, user_name: str = None) -> dict:
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
    
    async def get_or_create_team(self, guild, team_name: str, member_ids: list, week_key: str) -> int:
        """Get or create team entry and return team_id"""
        teams_db = await self.config.guild(guild).teams_db()
        next_ids = await self.config.guild(guild).next_unique_ids()
        
        # Check if exact team composition exists
        member_ids_set = set(str(uid) for uid in member_ids)
        for team_id, team_data in teams_db.items():
            if set(team_data["members"]) == member_ids_set and team_data["name"] == team_name:
                return int(team_id)
        
        # Create new team
        team_id = next_ids["team_id"]
        next_ids["team_id"] += 1
        await self.config.guild(guild).next_unique_ids.set(next_ids)
        
        teams_db[str(team_id)] = {
            "name": team_name,
            "members": [str(uid) for uid in member_ids],
            "created_at": datetime.now().isoformat(),
            "stats": {
                "participations": 0,
                "victories": 0,
                "total_votes": 0
            },
            "history": []  # List of {week_key, song_id, rank}
        }
        await self.config.guild(guild).teams_db.set(teams_db)
        return team_id

    async def record_song_submission(self, guild, team_id: int, week_key: str, suno_url: str, title: str = None) -> int:
        """Record a song submission and return song_id"""
        songs_db = await self.config.guild(guild).songs_db()
        next_ids = await self.config.guild(guild).next_unique_ids()
        
        song_id = next_ids["song_id"]
        next_ids["song_id"] += 1
        await self.config.guild(guild).next_unique_ids.set(next_ids)
        
        # Get team data to find artists
        teams_db = await self.config.guild(guild).teams_db()
        team_data = teams_db.get(str(team_id))
        member_ids = team_data["members"] if team_data else []
        
        songs_db[str(song_id)] = {
            "title": title or "Untitled",
            "team_id": team_id,
            "artists": member_ids,
            "week_key": week_key,
            "suno_url": suno_url,
            "submitted_at": datetime.now().isoformat(),
            "vote_stats": {
                "total": 0,
                "rank": None
            }
        }
        await self.config.guild(guild).songs_db.set(songs_db)
        
        # Update artist stats (participation)
        artists_db = await self.config.guild(guild).artists_db()
        for uid in member_ids:
            if uid in artists_db:
                artists_db[uid]["stats"]["participations"] += 1
                artists_db[uid]["stats"]["last_updated"] = datetime.now().isoformat()
                
                # Add to history if not present
                if song_id not in artists_db[uid]["song_history"]:
                    artists_db[uid]["song_history"].append(song_id)
        
        await self.config.guild(guild).artists_db.set(artists_db)
        
        # Update team stats
        if str(team_id) in teams_db:
            teams_db[str(team_id)]["stats"]["participations"] += 1
            await self.config.guild(guild).teams_db.set(teams_db)
            
        return song_id

    async def update_week_data(self, guild, week_key: str, theme: str, status: str = "active"):
        """Update or create week data entry"""
        weeks_db = await self.config.guild(guild).weeks_db()
        
        if week_key not in weeks_db:
            weeks_db[week_key] = {
                "theme": theme,
                "start_date": datetime.now().isoformat(),
                "end_date": None,
                "status": status,
                "teams": [],  # List of team_ids
                "songs": [],  # List of song_ids
                "winner_team_id": None,
                "total_votes": 0
            }
        else:
            weeks_db[week_key]["status"] = status
            if status == "completed" and not weeks_db[week_key]["end_date"]:
                weeks_db[week_key]["end_date"] = datetime.now().isoformat()
                
        await self.config.guild(guild).weeks_db.set(weeks_db)
