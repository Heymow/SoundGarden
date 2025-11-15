# Admin Panel Setup Guide

This guide explains how to set up and use the admin panel with the Discord bot backend.

## Prerequisites

1. **Discord Bot Running**: The Discord bot must be running with the API server enabled
2. **Admin Configuration**: You must be configured as an admin in the Discord bot
3. **Admin Token**: You need an admin authentication token from the bot

## Setting Up Admin Authentication

### Step 1: Configure Admin Access in Discord Bot

First, ensure you are configured as an admin in the Discord bot:

```
[p]cw setadmin @YourUsername
```

Or add additional admins:

```
[p]cw addadmin @YourUsername
```

To verify your admin status:

```
[p]cw listadmins
```

### Step 2: Enable API Server in Discord Bot

Use Discord commands to enable the API server:

```
[p]cw apiserver enable
[p]cw apiconfig api_server_enabled true
[p]cw apiconfig api_server_port 8080
```

### Step 3: Generate Admin Token

Generate an admin access token via Discord:

```
[p]cw admintoken generate
```

The bot will DM you a secure JWT token. **Keep this token private!**

### Step 4: Enter Token in Admin Panel (NEW!)

**The admin panel now has a built-in token setup interface:**

1. Navigate to the admin panel at `http://localhost:3000/admin` (or your deployment URL)
2. You will see the "Admin Authentication Required" screen
3. Follow the instructions on the screen:
   - Paste your token from Discord into the text area
   - Click "Save and Validate Token"
4. The token will be validated and saved automatically
5. If valid, you'll gain immediate access to the admin panel

**Note:** You no longer need to manually use the browser console to set the token!

### Step 5: Verify Connection

Once authenticated, the admin panel will display:
- Dashboard with competition status
- Current phase and theme
- Access to all admin functions
- Token status indicator

You can test the connection using the "Test Connection" button in the token status section.

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

### Authentication Issues

**"Admin token not found" or Token Setup Screen Appears**
- You need to enter your admin token in the admin panel interface
- Generate a token: `[p]cw admintoken generate`
- Check your Discord DMs for the token
- Paste it into the token setup screen in the admin panel

**"Invalid token" or "Token user no longer configured as admin" Error**
- Verify you're configured as an admin: `[p]cw listadmins`
- Your Discord user ID must be in the bot's admin list
- Use `[p]cw setadmin @YourUsername` or `[p]cw addadmin @YourUsername`
- Token may have expired - generate a new one: `[p]cw admintoken generate`

**"Token validation failed: Failed to fetch" Error**
- The Discord bot API server is not running or not reachable
- Check that the bot is online and API is enabled: `[p]cw apiserver enable`
- Verify `VITE_BOT_API_URL` in your .env file matches the bot API URL
- Ensure firewall/network allows connections to the bot API port (default: 8080)

### "API not enabled" Error (503)
- Verify the Discord bot API server is running
- Check that `api_server_enabled` is true in bot config
- Ensure you're connecting to the correct port (default: 8080)

### Network Errors
- Check that `VITE_BOT_API_URL` points to the correct bot API
- Ensure firewall/network allows connections to the bot API port
- Verify the Discord bot is running and accessible

## Security Notes

1. **Keep Tokens Private**: Never share your admin token - it grants full admin access
2. **HTTPS in Production**: Use HTTPS for both frontend and API in production
3. **Token Expiration**: Tokens expire after 1 year; regenerate periodically
4. **CORS Configuration**: Configure CORS properly in production
5. **Admin List**: Only authorized Discord users should have admin access
6. **Token Storage**: Tokens are stored in browser localStorage - clear them with the "Clear Token" button
7. **Automatic Validation**: Invalid tokens are automatically cleared from storage

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
