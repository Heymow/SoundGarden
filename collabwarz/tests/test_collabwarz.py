import sys
import unittest
from unittest.mock import MagicMock, patch

# Mock dependencies
sys.modules["redbot"] = MagicMock()
sys.modules["redbot.core"] = MagicMock()
sys.modules["redbot.core.bot"] = MagicMock()
sys.modules["redbot.core.commands"] = MagicMock()
sys.modules["redbot.core.config"] = MagicMock()
sys.modules["redbot.core.utils"] = MagicMock()
sys.modules["discord"] = MagicMock()
sys.modules["discord.ext"] = MagicMock()
sys.modules["redis.asyncio"] = MagicMock()
sys.modules["asyncpg"] = MagicMock()
sys.modules["aiohttp"] = MagicMock()

# Link mocks
sys.modules["redbot.core"].commands = sys.modules["redbot.core.commands"]

# Define a dummy Cog class
class MockCog:
    @staticmethod
    def listener(name=None):
        def decorator(func):
            return func
        return decorator

# Mock commands.Cog with the dummy class
sys.modules["redbot.core.commands"].Cog = MockCog

from collabwarz.collabwarz import CollabWarz

class TestCollabWarz(unittest.TestCase):
    def setUp(self):
        self.mock_bot = MagicMock()
        
        # Patch Config to avoid real Redbot config initialization
        self.config_patcher = patch('collabwarz.collabwarz.Config')
        self.mock_config_cls = self.config_patcher.start()
        self.mock_config_cls.get_conf.return_value = MagicMock()
        
        self.cog = CollabWarz(self.mock_bot)

    def tearDown(self):
        self.config_patcher.stop()

    def test_init(self):
        self.assertEqual(self.cog.bot, self.mock_bot)
        self.assertTrue(hasattr(self.cog, "config"))
        self.assertTrue(hasattr(self.cog, "announcement_task"))

if __name__ == "__main__":
    unittest.main()
