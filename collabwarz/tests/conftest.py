import sys
from unittest.mock import MagicMock

# Mock redbot and discord modules before they are imported by the cog
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

import pytest

@pytest.fixture
def mock_bot():
    bot = MagicMock()
    return bot
