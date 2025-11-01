# Collab Warz Discord Bot Cog

This is a Red-DiscordBot cog that automates announcements for SoundGarden's Collab Warz music competition.

## Features

- 🤖 Automated announcements for submission and voting phases
- 🎨 AI-powered announcement generation (with template fallbacks)
- ⏰ Automatic reminders before deadlines
- 🏆 Winner announcements
- 🎵 Theme management
- ⚙️ Easy configuration

## Installation for Red-DiscordBot

1. Copy `collabwarz.py` to your Red-DiscordBot cogs folder or load from a repo
2. Load the cog: `[p]load collabwarz`

## Configuration

### Set Announcement Channel
```
[p]cw setchannel #announcements
```

### Set Current Theme
```
[p]cw settheme Jungle Vibes
```

### Set Current Phase
```
[p]cw setphase submission
[p]cw setphase voting
```

### Configure AI (Optional)
For AI-generated announcements, configure an OpenAI-compatible API:
```
[p]cw setai https://api.openai.com/v1/chat/completions your_api_key
```

**Note:** The bot works perfectly fine without AI - it will use creative templates instead.

### Free AI Alternatives

If you don't want to pay for OpenAI, you can use free alternatives:
- **Hugging Face Inference API** (free tier available)
- **Cohere** (free tier available)
- **Together AI** (free credits)
- **Local LLM** via Ollama or similar

## Commands

### Admin Commands (require Manage Guild permission)

- `[p]cw setchannel <channel>` - Set announcement channel
- `[p]cw settheme <theme>` - Set current theme
- `[p]cw setphase <phase>` - Set phase (submission/voting)
- `[p]cw announce <type>` - Manually post announcement
  - Types: `submission_start`, `voting_start`, `reminder`, `winner`
- `[p]cw setai <url> <key>` - Configure AI API
- `[p]cw toggle` - Enable/disable automatic announcements
- `[p]cw status` - Show current configuration

## Announcement Types

1. **submission_start** - Announces when submissions open
2. **voting_start** - Announces when voting begins
3. **reminder** - Reminds users before deadline
4. **winner** - Celebrates the winner

## Example Usage

```bash
# Setup
[p]cw setchannel #collab-warz
[p]cw settheme Cosmic Dreams

# Start submission phase
[p]cw setphase submission
[p]cw announce submission_start

# Start voting phase
[p]cw setphase voting
[p]cw announce voting_start

# Post reminder
[p]cw announce reminder

# Announce winner
[p]cw announce winner
```

## Automatic Announcements

The cog includes a background task that can automatically post announcements based on configured schedules. Enable it with:
```
[p]cw toggle
```

## Customization

You can customize the announcement templates in the `_get_template_announcement` method of the cog, or configure AI for dynamic announcements.

## Support

For issues or questions, contact the SoundGarden team.
