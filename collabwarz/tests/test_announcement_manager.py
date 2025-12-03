import sys
import unittest
from unittest.mock import MagicMock, AsyncMock, patch
from datetime import datetime, timedelta

# Mock dependencies before importing
sys.modules["redbot"] = MagicMock()
sys.modules["redbot.core"] = MagicMock()
sys.modules["redbot.core.bot"] = MagicMock()
sys.modules["redbot.core.commands"] = MagicMock()
sys.modules["redbot.core.config"] = MagicMock()
sys.modules["discord"] = MagicMock()
sys.modules["discord.ext"] = MagicMock()
sys.modules["aiohttp"] = MagicMock()

# Add parent directory to path for imports
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from announcements import AnnouncementManager


class TestAnnouncementManager(unittest.IsolatedAsyncioTestCase):
    
    def setUp(self):
        """Set up test fixtures"""
        # Create mock cog
        self.mock_cog = MagicMock()
        self.mock_bot = MagicMock()
        self.mock_config = MagicMock()
        
        self.mock_cog.bot = self.mock_bot
        self.mock_cog.bot = self.mock_bot
        self.mock_cog.config = self.mock_config
        self.mock_cog.config_manager = MagicMock()
        self.mock_cog.config_manager.is_competition_week = AsyncMock(return_value=True)
        self.mock_cog.config_manager.get_competition_week_key = AsyncMock(return_value="2023-W20")
        
        # Create mock guild
        self.mock_guild = MagicMock()
        self.mock_guild.id = 12345
        self.mock_guild.name = "Test Guild"
        
        # Ensure config set methods are AsyncMock
        self.mock_config.guild.return_value.last_announcement.set = AsyncMock()
        self.mock_config.guild.return_value.pending_announcement.set = AsyncMock()
        self.mock_config.guild.return_value.current_theme.set = AsyncMock()
        self.mock_config.guild.return_value.next_week_theme.set = AsyncMock()
        self.mock_config.guild.return_value.pending_theme_confirmation.set = AsyncMock()
        
        # Initialize AnnouncementManager
        self.manager = AnnouncementManager(self.mock_cog)
    
    async def test_init(self):
        """Test AnnouncementManager initialization"""
        self.assertEqual(self.manager.cog, self.mock_cog)
        self.assertEqual(self.manager.bot, self.mock_bot)
        self.assertEqual(self.manager.config, self.mock_config)
    
    async def test_calculate_smart_timeout_submission_start(self):
        """Test smart timeout calculation for submission_start"""
        timeout = self.manager._calculate_smart_timeout("submission_start")
        
        # Should return a value between 1 hour and 7 days
        self.assertGreaterEqual(timeout, 3600)
        self.assertLessEqual(timeout, 7 * 24 * 3600)
    
    async def test_calculate_smart_timeout_other(self):
        """Test smart timeout calculation for other announcement types"""
        timeout = self.manager._calculate_smart_timeout("voting_start")
        
        # Should return default 30 minutes
        self.assertEqual(timeout, 1800)
    
    async def test_generate_theme_with_ai_success(self):
        """Test AI theme generation with successful API call"""
        # Mock config values
        mock_guild_config = MagicMock()
        mock_guild_config.ai_model = AsyncMock(return_value="gpt-3.5-turbo")
        mock_guild_config.ai_temperature = AsyncMock(return_value=0.9)
        self.mock_config.guild.return_value = mock_guild_config
        
        # Mock aiohttp response
        mock_response = AsyncMock()
        mock_response.status = 200
        mock_response.json = AsyncMock(return_value={
            "choices": [{"message": {"content": "Cosmic Dreams"}}]
        })
        
        # Mock session
        mock_session = MagicMock()
        mock_session.__aenter__ = AsyncMock(return_value=mock_session)
        mock_session.__aexit__ = AsyncMock(return_value=None)
        
        # Fix: __aenter__ must be AsyncMock for async with
        mock_session.post.return_value.__aenter__ = AsyncMock(return_value=mock_response)
        mock_session.post.return_value.__aexit__ = AsyncMock(return_value=None)
        
        with patch('aiohttp.ClientSession', return_value=mock_session):
            theme = await self.manager._generate_theme_with_ai(
                "https://api.example.com",
                "test_key",
                self.mock_guild
            )
        
        self.assertEqual(theme, "Cosmic Dreams")
    
    async def test_generate_theme_with_ai_failure(self):
        """Test AI theme generation with failed API call"""
        # Mock config values
        mock_guild_config = MagicMock()
        mock_guild_config.ai_model = AsyncMock(return_value="gpt-3.5-turbo")
        mock_guild_config.ai_temperature = AsyncMock(return_value=0.9)
        self.mock_config.guild.return_value = mock_guild_config
        
        # Mock session to raise exception
        mock_session = MagicMock()
        mock_session.post.side_effect = Exception("API Error")
        
        with patch('aiohttp.ClientSession', return_value=mock_session):
            theme = await self.manager._generate_theme_with_ai(
                "https://api.example.com",
                "test_key",
                self.mock_guild
            )
        
        self.assertIsNone(theme)
    
    async def test_get_template_announcement_submission_start(self):
        """Test template announcement generation for submission_start"""
        # Mock config
        mock_guild_config = MagicMock()
        mock_guild_config.biweekly_mode = AsyncMock(return_value=False)
        self.mock_config.guild.return_value = mock_guild_config
        
        # Mock _get_next_deadline and _create_discord_timestamp
        self.mock_cog._get_next_deadline = MagicMock(return_value=datetime.now())
        self.mock_cog._create_discord_timestamp = MagicMock(return_value="<t:123456789:R>")
        
        announcement = await self.manager._get_template_announcement(
            self.mock_guild,
            "submission_start",
            "Test Theme",
            None
        )
        
        self.assertIn("Test Theme", announcement)
        self.assertIn("Collab Warz", announcement)
        self.assertIn("submission", announcement.lower())
    
    async def test_get_template_announcement_voting_start(self):
        """Test template announcement generation for voting_start"""
        # Mock config
        mock_guild_config = MagicMock()
        mock_guild_config.biweekly_mode = AsyncMock(return_value=False)
        self.mock_config.guild.return_value = mock_guild_config
        
        # Mock _get_next_deadline and _create_discord_timestamp
        self.mock_cog._get_next_deadline = MagicMock(return_value=datetime.now())
        self.mock_cog._create_discord_timestamp = MagicMock(return_value="<t:123456789:R>")
        
        announcement = await self.manager._get_template_announcement(
            self.mock_guild,
            "voting_start",
            "Test Theme",
            None
        )
        
        self.assertIn("Test Theme", announcement)
        self.assertIn("VOTING", announcement)
    
    async def test_apply_next_week_theme_if_ready(self):
        """Test applying next week's theme"""
        # Mock config
        mock_guild_config = MagicMock()
        mock_guild_config.next_week_theme = AsyncMock(return_value="Next Theme")
        mock_guild_config.current_theme = MagicMock()
        mock_guild_config.current_theme.set = AsyncMock()
        mock_guild_config.next_week_theme.set = AsyncMock()
        mock_guild_config.pending_theme_confirmation = MagicMock()
        mock_guild_config.pending_theme_confirmation.set = AsyncMock()
        mock_guild_config.admin_user_id = AsyncMock(return_value=None)
        self.mock_config.guild.return_value = mock_guild_config
        
        await self.manager._apply_next_week_theme_if_ready(self.mock_guild)
        
        # Verify theme was set
        mock_guild_config.current_theme.set.assert_called_once_with("Next Theme")
        mock_guild_config.next_week_theme.set.assert_called_once_with(None)
        mock_guild_config.pending_theme_confirmation.set.assert_called_once_with(None)
    
    async def test_post_announcement_without_confirmation(self):
        """Test posting announcement without admin confirmation"""
        # Mock config
        mock_guild_config = MagicMock()
        mock_guild_config.require_confirmation = AsyncMock(return_value=False)
        mock_guild_config.use_everyone_ping = AsyncMock(return_value=False)
        mock_guild_config.admin_user_id = AsyncMock(return_value=None)
        mock_guild_config.pending_announcement = MagicMock()
        mock_guild_config.pending_announcement.set = AsyncMock()
        self.mock_config.guild.return_value = mock_guild_config
        
        # Mock channel
        mock_channel = AsyncMock()
        mock_channel.send = AsyncMock()
        
        # Mock generate_announcement
        self.manager.generate_announcement = AsyncMock(return_value="Test Announcement")
        
        await self.manager._post_announcement(
            mock_channel,
            self.mock_guild,
            "submission_start",
            "Test Theme"
        )
        
        # Verify announcement was sent
        mock_channel.send.assert_called_once()
    
    async def test_post_announcement_with_confirmation(self):
        """Test posting announcement with admin confirmation required"""
        # Mock config
        mock_guild_config = MagicMock()
        mock_guild_config.require_confirmation = AsyncMock(return_value=True)
        mock_guild_config.admin_user_id = AsyncMock(return_value=67890)
        mock_guild_config.pending_announcement = MagicMock()
        mock_guild_config.pending_announcement.set = AsyncMock()
        self.mock_config.guild.return_value = mock_guild_config
        
        # Mock bot.get_user
        mock_admin = AsyncMock()
        self.mock_bot.get_user.return_value = mock_admin
        
        # Mock channel
        mock_channel = MagicMock()
        mock_channel.id = 54321
        
        # Mock _send_confirmation_request
        self.manager._send_confirmation_request = AsyncMock()
        
        await self.manager._post_announcement(
            mock_channel,
            self.mock_guild,
            "submission_start",
            "Test Theme",
            force=False
        )
        
        # Verify confirmation was requested
        self.manager._send_confirmation_request.assert_called_once()
        mock_guild_config.pending_announcement.set.assert_called_once()


if __name__ == "__main__":
    unittest.main()
