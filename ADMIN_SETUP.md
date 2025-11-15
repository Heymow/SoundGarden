# Admin Panel Setup Guide

This guide explains how to set up and use the admin panel with the Discord bot backend.

## Prerequisites

1. **Discord Bot Running**: The Discord bot must be running with the API server enabled
2. **Admin Token**: You need an admin authentication token from the bot

## Setting Up Admin Authentication

### Step 1: Enable API Server in Discord Bot

Use Discord commands to enable the API server:

```
[p]cw apiserver enable
[p]cw apiconfig api_server_enabled true
[p]cw apiconfig api_server_port 8080
```

### Step 2: Generate Admin Token

Generate an admin access token via Discord:

```
[p]cw generatetoken
```

The bot will DM you a secure token. **Keep this token private!**

### Step 3: Set Token in Browser

1. Open the admin panel in your browser
2. Open browser console (F12)
3. Run this command with your token:

```javascript
localStorage.setItem('discordAdminToken', 'YOUR_TOKEN_HERE');
```

4. Refresh the page

### Step 4: Verify Connection

The admin panel should now be able to:
- Load competition status
- View current phase and theme
- Access all admin functions

## Environment Variables

### Frontend (.env)

```bash
VITE_API_URL=http://localhost:3001          # Express OAuth server
VITE_BOT_API_URL=http://localhost:8080      # Discord bot API
```

### Backend (server/.env)

```bash
DISCORD_CLIENT_ID=your_client_id
DISCORD_CLIENT_SECRET=your_client_secret
DISCORD_REDIRECT_URI=http://localhost:3001/auth/discord/callback
PORT=3001
FRONTEND_URL=http://localhost:3000
```

## Admin Panel Features

### Competition Management
- **Phase Control**: Change between submission, voting, paused, ended, etc.
- **Theme Management**: Set current theme and generate AI themes
- **Week Control**: Start new week, cancel week, end week

### Voting Management
- **Vote Audit**: View detailed voting information by week
- **Vote Moderation**: Remove individual votes or invalid votes
- **Export Results**: Export voting data (feature in development)

### Team Management
- **View Submissions**: See all current week submissions
- **Approve/Reject**: Manage submission approval
- **Team Details**: View team members and history

### Announcement System
- **Send Announcements**: Broadcast messages to Discord channel
- **Auto-Announcements**: Configure automated phase announcements
- **Test Messages**: Send test announcements to test channel

### AI Configuration
- **API Settings**: Configure AI service for theme/announcement generation
- **Test Connection**: Verify AI service is working
- **Template Editor**: Customize announcement templates

### System Status
- **Health Monitoring**: Check bot and API server status
- **Data Sync**: Manually trigger data synchronization
- **Bot Restart**: Request bot restart (requires platform access)

## API Endpoints Used

### Configuration
- `GET /api/admin/config` - Get bot configuration
- `POST /api/admin/config` - Update bot configuration

### Status & Data
- `GET /api/admin/status` - Get competition status
- `GET /api/admin/submissions` - Get current submissions
- `GET /api/admin/history` - Get competition history
- `GET /api/admin/votes/{week}/details` - Get vote details

### Actions
- `POST /api/admin/actions` - Execute admin actions
  - `set_phase` - Change competition phase
  - `set_theme` - Update theme
  - `start_new_week` - Begin new competition cycle
  - `cancel_week` - Cancel current week
  - `clear_submissions` - Remove all submissions
  - `toggle_automation` - Enable/disable automation

### Moderation
- `DELETE /api/admin/submissions/{team}` - Remove team submission
- `DELETE /api/admin/votes/{week}/{user}` - Remove user's vote
- `DELETE /api/admin/weeks/{week}` - Remove entire week record

## Troubleshooting

### "Admin token not found" Error
- Ensure you've set the token in localStorage
- Check that the token hasn't expired
- Regenerate token if needed

### "API not enabled" Error (503)
- Verify the Discord bot API server is running
- Check that `api_server_enabled` is true in bot config
- Ensure you're connecting to the correct port (default: 8080)

### "Invalid token" Error (403)
- Token may have expired - generate a new one
- Ensure you're using the full token string
- Verify you're an admin in the Discord bot config

### Network Errors
- Check that `VITE_BOT_API_URL` points to the correct bot API
- Ensure firewall/network allows connections to the bot API port
- Verify the Discord bot is running and accessible

## Security Notes

1. **Keep Tokens Private**: Never share your admin token
2. **HTTPS in Production**: Use HTTPS for both frontend and API in production
3. **Token Expiration**: Tokens should expire; regenerate periodically
4. **CORS Configuration**: Configure CORS properly in production
5. **Admin List**: Only authorized Discord users should have admin access

## Development

### Testing Locally

1. Start Discord bot with API enabled
2. Start Express backend: `cd server && npm start`
3. Start frontend: `npm run dev`
4. Set admin token in browser console
5. Access admin panel at http://localhost:3000/admin

### Building for Production

```bash
npm run build
```

The built files will be in the `dist` directory.

## Need Help?

- Check bot logs for API errors
- Use Discord command `[p]cw status` to verify bot configuration
- Review browser console for frontend errors
- Check network tab for API request/response details
