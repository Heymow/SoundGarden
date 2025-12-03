import unittest
from unittest.mock import MagicMock, AsyncMock, patch
from datetime import datetime
from collabwarz.config_manager import ConfigManager

class TestConfigManager(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.mock_bot = MagicMock()
        self.mock_config = MagicMock()
        self.mock_cog = MagicMock()
        self.mock_cog.bot = self.mock_bot
        self.mock_cog.config = self.mock_config
        
        # Initialize manager
        self.manager = ConfigManager(self.mock_cog)

    async def test_register_config(self):
        """Test config registration"""
        self.manager.register_config()
        self.mock_config.register_guild.assert_called_once()
        args = self.mock_config.register_guild.call_args[1]
        self.assertIn("current_theme", args)
        self.assertIn("suppress_noisy_logs", args)

    async def test_is_noisy_logs_suppressed(self):
        """Test log suppression check"""
        # Test with guild config
        mock_guild = MagicMock()
        self.mock_config.guild.return_value.suppress_noisy_logs = AsyncMock(return_value=False)
        
        suppressed = await self.manager.is_noisy_logs_suppressed(mock_guild)
        self.assertFalse(suppressed)
        
        # Test fallback to attribute
        self.mock_config.guild.side_effect = Exception("Config error")
        self.mock_cog.suppress_noisy_logs = True
        suppressed = await self.manager.is_noisy_logs_suppressed(mock_guild)
        self.assertTrue(suppressed)

    async def test_get_competition_week_key(self):
        """Test week key generation"""
        mock_guild = MagicMock()
        
        # Test regular mode
        self.mock_config.guild.return_value.biweekly_mode = AsyncMock(return_value=False)
        with patch('collabwarz.config_manager.datetime') as mock_dt:
            mock_dt.now.return_value.isocalendar.return_value = (2023, 10, 1)
            key = await self.manager.get_competition_week_key(mock_guild)
            self.assertEqual(key, "2023-W10")

    async def test_is_competition_week(self):
        """Test competition week check"""
        mock_guild = MagicMock()
        
        # Test regular mode (always true)
        self.mock_config.guild.return_value.biweekly_mode = AsyncMock(return_value=False)
        is_comp = await self.manager.is_competition_week(mock_guild)
        self.assertTrue(is_comp)
        
        # Test bi-weekly mode
        self.mock_config.guild.return_value.biweekly_mode = AsyncMock(return_value=True)
        with patch('collabwarz.config_manager.datetime') as mock_dt:
            # Odd week -> True
            mock_dt.now.return_value.isocalendar.return_value = (2023, 11, 1)
            self.assertTrue(await self.manager.is_competition_week(mock_guild))
            
            # Even week -> False
            mock_dt.now.return_value.isocalendar.return_value = (2023, 12, 1)
            self.assertFalse(await self.manager.is_competition_week(mock_guild))

    async def test_get_submissions_safe(self):
        """Test safe submission retrieval"""
        mock_guild = MagicMock()
        
        # Test with 'submissions' key
        self.mock_config.guild.return_value.all = AsyncMock(return_value={
            "submissions": {"Team A": {}}
        })
        subs = await self.manager.get_submissions_safe(mock_guild)
        self.assertEqual(len(subs), 1)
        self.assertIn("Team A", subs)
        
        # Test fallback to weeks_db
        self.mock_config.guild.return_value.all = AsyncMock(return_value={
            "weeks_db": {
                "2023-W10": {"teams": ["Team B"]}
            }
        })
        # Mock get_competition_week_key to match
        with patch.object(self.manager, 'get_competition_week_key', new=AsyncMock(return_value="2023-W10")):
            subs = await self.manager.get_submissions_safe(mock_guild)
            self.assertEqual(len(subs), 1)
            self.assertIn("Team B", subs)
