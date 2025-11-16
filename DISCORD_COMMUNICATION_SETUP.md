# 🚀 Configuration Guide - Discord Communication

## Architecture Overview

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Instance 1    │    │   Instance 2    │    │   Instance 3    │
│                 │    │                 │    │                 │
│   RedBot        │    │   Backend API   │    │   Frontend      │
│   (Immutable)   │◄──►│   + Cog Source  │◄──►│   React Admin   │
│                 │    │   Port 3001     │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
        ▲                       │
        │                       │
        └───── Discord API ─────┘
```

## Setup Steps

### 1. Discord Bot Configuration

1. **Create an admin channel** in your Discord server (e.g., `#admin-commands`)
2. **Make it private** - only admins and the bot should access it
3. **Copy the channel ID** (right-click channel → Copy Channel ID)

### 2. Railway Environment Variables

Configure these variables in your **Instance 2** (Backend) Railway service:

```bash
# Discord Communication
DISCORD_BOT_TOKEN=your_bot_token_here
DISCORD_GUILD_ID=your_discord_server_id  
DISCORD_ADMIN_CHANNEL_ID=your_private_admin_channel_id
COMMAND_PREFIX=!cw

# OAuth (existing)
DISCORD_CLIENT_ID=your_oauth_app_client_id
DISCORD_CLIENT_SECRET=your_oauth_app_secret
DISCORD_REDIRECT_URI=https://your-instance-2.railway.app/auth/discord/callback

# Frontend URL
FRONTEND_URL=https://your-instance-3.railway.app
```

### 3. How it Works

**Admin Panel Actions:**
```
User clicks "Change Phase" → Backend sends "!cw setphase voting" → Bot executes → Status updated
```

**Data Reading:**
```
Panel loads → Backend sends "!cw status" → Bot responds → Backend parses → Frontend displays
```

### 4. Supported Actions

| Panel Action | Discord Command | Description |
|-------------|----------------|-------------|
| `set_theme` | `!cw settheme "New Theme"` | Update competition theme |
| `set_phase` | `!cw setphase voting` | Change competition phase |
| `next_phase` | `!cw nextphase` | Advance to next phase |
| `toggle_automation` | `!cw toggle` | Toggle automation on/off |
| `cancel_week` | `!cw pause reason` | Cancel current week |
| `reset_week` | `!cw resume` | Resume/reset week |
| `force_voting` | `!cw setphase voting` | Force voting phase |
| `announce_winners` | `!cw checkvotes` | Check and announce winners |

### 5. Benefits

✅ **No Instance 1 modifications** - RedBot stays untouched  
✅ **Real bot data** - Always synced with actual bot state  
✅ **Secure** - Uses Discord's authentication and permissions  
✅ **Reliable** - Leverages Discord's infrastructure  
✅ **Auditable** - All commands visible in admin channel  

### 6. Troubleshooting

**Bot not responding:**
- Check bot permissions in admin channel
- Verify DISCORD_BOT_TOKEN is correct
- Ensure bot is online in Instance 1

**Commands not working:**
- Check COMMAND_PREFIX matches bot configuration
- Verify admin channel ID is correct
- Check bot has "Send Messages" and "Read Message History" permissions

**Status not updating:**
- Bot may take a few seconds to process commands
- Check admin channel for bot responses
- Verify DISCORD_ADMIN_CHANNEL_ID is the correct private channel