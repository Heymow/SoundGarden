# Installation Guide - Collab Warz Discord Bot

This guide will help you install the Collab Warz Discord bot as a Red-DiscordBot cog directly from GitHub.

## Prerequisites

1. **Red-DiscordBot Installed**: You need Red-DiscordBot v3.4.0 or higher
   - Installation guide: https://docs.discord.red/en/stable/install_guides/index.html

2. **Python 3.8+**: Required by Red-DiscordBot
   ```bash
   python --version  # Should be 3.8 or higher
   ```

3. **Bot Permissions**: Your Discord bot needs these permissions:
   - Read Messages
   - Send Messages
   - Manage Messages
   - Use External Emojis
   - Add Reactions
   - Mention Everyone (optional, for @everyone pings)

## Installation Methods

### Method 1: GitHub Repository (Recommended)

This is the easiest way and allows automatic updates.

#### Step 1: Add the Repository
```bash
[p]repo add soundgarden https://github.com/Heymow/SoundGarden
```

Replace `[p]` with your bot's prefix (default is usually `!` or `.`).

#### Step 2: Install the Cog
```bash
[p]cog install soundgarden collabwarz
```

#### Step 3: Load the Cog
```bash
[p]load collabwarz
```

#### Step 4: Verify Installation
```bash
[p]cw status
```

If you see the bot's status message, you're all set!

#### Updating the Cog
To update to the latest version:
```bash
[p]cog update collabwarz
[p]reload collabwarz
```

### Method 2: Manual Installation

If you prefer to install manually or want to make custom modifications:

#### Step 1: Download the Cog
```bash
# Clone the entire repository
git clone https://github.com/Heymow/SoundGarden.git

# Or download just the collabwarz folder
```

#### Step 2: Copy to Red's Cogs Directory
```bash
# Find your Red instance's cogs directory
# Usually: ~/.local/share/Red-DiscordBot/data/<instance_name>/cogs/

# Copy the collabwarz folder
cp -r SoundGarden/collabwarz ~/.local/share/Red-DiscordBot/data/<instance_name>/cogs/
```

Replace `<instance_name>` with your Red-DiscordBot instance name.

#### Step 3: Install Dependencies
```bash
# Make sure you're in the Red-DiscordBot environment
pip install aiohttp
```

#### Step 4: Load the Cog
```bash
[p]load collabwarz
```

#### Step 5: Verify Installation
```bash
[p]cw status
```

### Method 3: Interactive Wizard

For a guided setup experience:

#### Step 1: Download the Repository
```bash
git clone https://github.com/Heymow/SoundGarden.git
cd SoundGarden/collabwarz
```

#### Step 2: Run the Installation Wizard
```bash
python install.py
```

Follow the prompts to configure:
- AI API settings (OpenAI, LocalAI, etc.)
- Discord channel IDs
- Competition parameters
- Admin settings

#### Step 3: Load the Cog
```bash
[p]load collabwarz
```

#### Step 4: Run Generated Commands
The wizard creates a `setup_commands.txt` file with all configuration commands. Copy and paste them into Discord to complete the setup.

## Basic Configuration

After installation, you need to configure a few essential settings:

### Minimal Configuration
```bash
# Set the announcement channel
[p]cw setchannel #collab-warz

# Set the initial theme
[p]cw settheme "Your First Theme"

# Enable automation
[p]cw toggle

# Check status
[p]cw status
```

### Recommended Configuration
```bash
# Set an admin user for confirmations
[p]cw setadmin @YourUsername

# Enable confirmation system
[p]cw confirmation

# Configure @everyone pings (optional)
[p]cw everyone

# Set a test channel for testing
[p]cw settestchannel #bot-testing
```

### Optional AI Configuration
```bash
# Configure AI for theme generation
[p]cw setai https://api.openai.com/v1/chat/completions YOUR_API_KEY gpt-3.5-turbo

# Set AI parameters
[p]cw aitemp 0.8      # Creativity level (0.0-2.0)
[p]cw aitokens 150    # Max response length
```

## Testing Your Installation

### Test 1: Status Check
```bash
[p]cw status
```
Should show:
- Current configuration
- Automation status
- Channel settings
- Theme information

### Test 2: Manual Announcement
```bash
[p]cw announce submission_start
```
Should post an announcement in your configured channel.

### Test 3: Test All Features
```bash
# Set a test channel first
[p]cw settestchannel #bot-testing

# Test all announcement types
[p]cw test
```

## Troubleshooting

### Cog Won't Load
**Error**: `Cog 'collabwarz' not found`

**Solutions**:
1. Check the cog was installed: `[p]cog list`
2. Verify the folder name is exactly `collabwarz`
3. Check file structure includes `__init__.py`
4. Try reinstalling: `[p]cog uninstall collabwarz` then install again

### Missing Dependencies
**Error**: `No module named 'aiohttp'`

**Solution**:
```bash
# Activate Red's virtual environment first
pip install aiohttp
```

### Repository Already Exists
**Error**: `Repo soundgarden already exists`

**Solution**:
```bash
# Remove the old repo
[p]repo delete soundgarden

# Add it again
[p]repo add soundgarden https://github.com/Heymow/SoundGarden
```

### Commands Not Working
**Error**: Commands don't respond

**Solution**:
1. Check bot prefix: `[p]help`
2. Verify cog is loaded: `[p]cogs`
3. Check bot permissions in the channel
4. Reload the cog: `[p]reload collabwarz`

### Automation Not Starting
**Error**: No automatic announcements

**Solution**:
```bash
# Check configuration
[p]cw status

# Enable automation if disabled
[p]cw toggle

# Verify channel is set
[p]cw setchannel #your-channel
```

## Uninstallation

If you need to uninstall the cog:

### GitHub Installation
```bash
# Unload the cog
[p]unload collabwarz

# Uninstall from repo
[p]cog uninstall collabwarz

# Optional: Remove the repo
[p]repo delete soundgarden
```

### Manual Installation
```bash
# Unload the cog
[p]unload collabwarz

# Remove the folder from cogs directory
rm -rf ~/.local/share/Red-DiscordBot/data/<instance_name>/cogs/collabwarz
```

## Getting Help

- **Documentation**: See [README.md](README.md) for complete feature documentation
- **Quick Start**: See [QUICK_START.md](QUICK_START.md) for essential commands
- **Bot Commands**: Use `[p]help collabwarz` in Discord
- **Status Check**: Use `[p]cw status` for diagnostics

## Next Steps

After successful installation:

1. **Configure Your Competition**
   - Set competition channel
   - Choose a theme
   - Enable automation

2. **Set Up Voting System**
   - Start the integrated API server: `[p]cw apiserver start`
   - Configure CORS: `[p]cw apiconfig cors https://yoursite.com`
   - Generate admin token: `[p]cw admintoken generate`

3. **Optional Integrations**
   - Configure AI theme generation
   - Set up AutoReputation for rewards
   - Enable submission validation

4. **Test Everything**
   - Post a test announcement
   - Try submission validation
   - Check API endpoints

Enjoy your automated music competition bot! 🎵
