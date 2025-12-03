import unittest
from unittest.mock import MagicMock, AsyncMock, patch
import sys
import os
import asyncio
import json

# Mock redbot and discord before importing redis_manager
sys.modules["redbot"] = MagicMock()
sys.modules["redbot.core"] = MagicMock()
sys.modules["redbot.core.commands"] = MagicMock()
sys.modules["discord"] = MagicMock()
sys.modules["aiohttp"] = MagicMock()

# Mock redis.asyncio
mock_redis = MagicMock()
sys.modules["redis.asyncio"] = mock_redis

# Add parent directory to path to import redis_manager
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from redis_manager import RedisManager

class TestRedisManager(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.mock_bot = MagicMock()
        self.mock_guild = MagicMock()
        self.mock_guild.id = 123
        self.mock_guild.name = "Test Guild"
        self.mock_bot.guilds = [self.mock_guild]
        
        self.mock_config = MagicMock()
        self.mock_guild_config = MagicMock()
        self.mock_config.guild.return_value = self.mock_guild_config
        
        # Setup common config return values
        self.mock_guild_config.redis_enabled = AsyncMock(return_value=True)
        self.mock_guild_config.redis_url = AsyncMock(return_value="redis://localhost:6379")
        self.mock_guild_config.safe_mode_enabled = AsyncMock(return_value=False)
        self.mock_guild_config.current_phase = AsyncMock(return_value="submission")
        self.mock_guild_config.current_theme = AsyncMock(return_value="Test Theme")
        self.mock_guild_config.auto_announce = AsyncMock(return_value=True)
        self.mock_guild_config.week_cancelled = AsyncMock(return_value=False)
        self.mock_guild_config.all = AsyncMock(return_value={})
        
        self.mock_cog = MagicMock()
        self.mock_cog.bot = self.mock_bot
        self.mock_cog.config = self.mock_config
        self.mock_cog._maybe_noisy_log = AsyncMock()
        self.mock_cog._send_competition_log = AsyncMock()
        self.mock_cog._clear_submissions_safe = AsyncMock()
        self.mock_cog._get_submissions_safe = AsyncMock(return_value={})
        self.mock_cog._set_submissions_safe = AsyncMock()
        self.mock_cog._process_voting_end = AsyncMock()
        self.mock_cog.backup_dir = "/tmp/backups"
        self.mock_cog.latest_backup = {}
        self.mock_cog.pg_pool = None
        self.mock_cog._save_backup_to_db = AsyncMock()
        self.mock_cog._count_participating_teams = AsyncMock(return_value=5)
        self.mock_cog._is_noisy_logs_suppressed = AsyncMock(return_value=True)

        self.redis_manager = RedisManager(self.mock_cog)
        
        # Mock the internal redis client
        self.mock_redis_client = MagicMock()
        self.mock_redis_client.ping = AsyncMock(return_value=True)
        self.mock_redis_client.set = AsyncMock(return_value=True)
        self.mock_redis_client.setex = AsyncMock(return_value=True)
        self.mock_redis_client.rpop = AsyncMock(return_value=None)
        
        # Patch redis.from_url to return our mock client
        with patch("redis.asyncio.from_url", return_value=self.mock_redis_client):
            await self.redis_manager._init_redis_connection()

    async def test_init_redis_connection(self):
        # Reset client to test initialization
        self.redis_manager.redis_client = None
        
        with patch("redis.asyncio.from_url", return_value=self.mock_redis_client) as mock_from_url:
            result = await self.redis_manager._init_redis_connection()
            self.assertTrue(result)
            self.assertIsNotNone(self.redis_manager.redis_client)
            mock_from_url.assert_called()

    async def test_safe_redis_set(self):
        # Ensure client is set
        self.redis_manager.redis_client = self.mock_redis_client
        
        result = await self.redis_manager._safe_redis_set("test_key", "test_value")
        self.assertTrue(result)
        self.mock_redis_client.set.assert_called_with("test_key", "test_value")

    async def test_safe_redis_setex(self):
        self.redis_manager.redis_client = self.mock_redis_client
        
        result = await self.redis_manager._safe_redis_setex("test_key", 60, "test_value")
        self.assertTrue(result)
        self.mock_redis_client.setex.assert_called_with("test_key", 60, "test_value")

    async def test_process_redis_action_start_phase(self):
        guild = MagicMock()
        guild.name = "Test Guild"
        guild.id = 123
        
        action_data = {
            "action": "start_phase",
            "params": {
                "phase": "voting",
                "theme": "New Theme"
            },
            "id": "action_123"
        }
        
        await self.redis_manager._process_redis_action(guild, action_data)
        
        self.mock_guild_config.current_theme.set.assert_called_with("New Theme")
        self.mock_guild_config.current_phase.set.assert_called_with("voting")
        self.mock_cog._send_competition_log.assert_called()

    async def test_process_redis_action_unknown(self):
        guild = MagicMock()
        guild.name = "Test Guild"
        
        action_data = {
            "action": "unknown_action",
            "id": "action_999"
        }
        
        await self.redis_manager._process_redis_action(guild, action_data)
        
        self.mock_cog._maybe_noisy_log.assert_called()
        # Check if it tried to save failure to redis
        self.mock_redis_client.setex.assert_called()

if __name__ == "__main__":
    unittest.main()
