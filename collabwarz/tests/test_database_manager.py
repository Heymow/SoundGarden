import unittest
from unittest.mock import MagicMock, AsyncMock, patch
from datetime import datetime
from collabwarz.database import DatabaseManager

class TestDatabaseManager(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.mock_bot = MagicMock()
        self.mock_config = MagicMock()
        self.mock_cog = MagicMock()
        self.mock_cog.bot = self.mock_bot
        self.mock_cog.config = self.mock_config
        
        # Mock config structure
        self.mock_guild = MagicMock()
        self.mock_guild.id = 123456789
        
        # Mock config return values
        self.mock_config.guild.return_value.artists_db = AsyncMock()
        self.mock_config.guild.return_value.artists_db.set = AsyncMock()
        self.mock_config.guild.return_value.teams_db = AsyncMock()
        self.mock_config.guild.return_value.teams_db.set = AsyncMock()
        self.mock_config.guild.return_value.songs_db = AsyncMock()
        self.mock_config.guild.return_value.songs_db.set = AsyncMock()
        self.mock_config.guild.return_value.weeks_db = AsyncMock()
        self.mock_config.guild.return_value.weeks_db.set = AsyncMock()
        self.mock_config.guild.return_value.weekly_winners = AsyncMock()
        self.mock_config.guild.return_value.weekly_winners.set = AsyncMock()
        self.mock_config.guild.return_value.rep_reward_amount = AsyncMock(return_value=50)
        self.mock_config.guild.return_value.next_unique_ids = AsyncMock(return_value={"team_id": 1, "song_id": 1})
        self.mock_config.guild.return_value.next_unique_ids.set = AsyncMock()
        
        # Initialize manager
        self.manager = DatabaseManager(self.mock_cog)

    async def test_init_pool_no_asyncpg(self):
        """Test init_pool when asyncpg is not available"""
        with patch('collabwarz.database.PG_AVAILABLE', False):
            await self.manager.init_pool()
            self.assertIsNone(self.manager.pg_pool)

    async def test_get_user_rep_count(self):
        """Test getting user reputation"""
        mock_auto_rep = MagicMock()
        mock_auto_rep.api_get_points = AsyncMock(return_value={"petals": 100})
        self.mock_bot.get_cog.return_value = mock_auto_rep
        
        rep = await self.manager.get_user_rep_count(self.mock_guild, 123)
        self.assertEqual(rep, 100)
        self.mock_bot.get_cog.assert_called_with('AutoReputation')

    async def test_give_rep_to_user(self):
        """Test giving reputation to user"""
        mock_auto_rep = MagicMock()
        mock_auto_rep.api_add_points = AsyncMock(return_value={"success": True})
        self.mock_bot.get_cog.return_value = mock_auto_rep
        
        success = await self.manager.give_rep_to_user(self.mock_guild, 123, 50)
        self.assertTrue(success)
        mock_auto_rep.api_add_points.assert_called_once()

    async def test_get_or_create_artist_new(self):
        """Test creating a new artist"""
        # Mock empty artists db
        self.mock_config.guild.return_value.artists_db.return_value = {}
        
        mock_member = MagicMock()
        mock_member.display_name = "Test Artist"
        self.mock_guild.get_member.return_value = mock_member
        
        artist = await self.manager.get_or_create_artist(self.mock_guild, 123)
        
        self.assertEqual(artist["name"], "Test Artist")
        self.assertEqual(artist["stats"]["participations"], 0)
        self.mock_config.guild.return_value.artists_db.set.assert_called_once()

    async def test_get_or_create_team_new(self):
        """Test creating a new team"""
        # Mock empty teams db
        self.mock_config.guild.return_value.teams_db.return_value = {}
        
        team_id = await self.manager.get_or_create_team(
            self.mock_guild, "Test Team", [123, 456], "2023-W01"
        )
        
        self.assertEqual(team_id, 1)
        self.mock_config.guild.return_value.teams_db.set.assert_called_once()
        self.mock_config.guild.return_value.next_unique_ids.set.assert_called_once()

    async def test_record_song_submission(self):
        """Test recording a song submission"""
        # Mock existing data
        self.mock_config.guild.return_value.songs_db.return_value = {}
        self.mock_config.guild.return_value.teams_db.return_value = {
            "1": {"members": [123, 456], "stats": {"participations": 0}}
        }
        self.mock_config.guild.return_value.artists_db.return_value = {
            123: {"stats": {"participations": 0}, "song_history": []},
            456: {"stats": {"participations": 0}, "song_history": []}
        }
        
        song_id = await self.manager.record_song_submission(
            self.mock_guild, 1, "2023-W01", "http://suno.com/song", "My Song"
        )
        
        self.assertEqual(song_id, 1)
        self.mock_config.guild.return_value.songs_db.set.assert_called_once()
        # Should update artists and teams stats
        self.mock_config.guild.return_value.artists_db.set.assert_called_once()
        self.mock_config.guild.return_value.teams_db.set.assert_called_once()

    async def test_update_week_data(self):
        """Test updating week data"""
        self.mock_config.guild.return_value.weeks_db.return_value = {}
        
        await self.manager.update_week_data(
            self.mock_guild, "2023-W01", "Space Theme"
        )
        
        self.mock_config.guild.return_value.weeks_db.set.assert_called_once()
        args = self.mock_config.guild.return_value.weeks_db.set.call_args[0][0]
        self.assertEqual(args["2023-W01"]["theme"], "Space Theme")
        self.assertEqual(args["2023-W01"]["status"], "active")
