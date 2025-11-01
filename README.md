# SoundGarden's Collab Warz — Frontend & Backend

This is the web application and Discord bot for SoundGarden's Collab Warz music collaboration competition.

## Features

- 🎵 **Modern Web Interface** with jungle-inspired dark green theme
- 🔐 **Discord OAuth Login** for authentication
- 🤖 **Automated Discord Bot** (Redbot cog) for announcements
- 🎨 **AI-Powered Announcements** (with template fallbacks)
- 📱 **Responsive Design** for all devices

## Quick Start

### Frontend

1. Install dependencies:
```bash
npm install
```

2. Create `.env` file:
```bash
cp .env.example .env
```

3. Run development server:
```bash
npm run dev
```

The frontend will be available at http://localhost:3000

### Backend API (for Discord OAuth)

1. Navigate to server directory:
```bash
cd server
npm install
```

2. Create `.env` file:
```bash
cp .env.example .env
```

3. Configure Discord OAuth:
   - Go to https://discord.com/developers/applications
   - Create a new application
   - Add OAuth2 redirect URL: `http://localhost:3001/auth/discord/callback`
   - Copy Client ID and Client Secret to `.env`

4. Start the server:
```bash
npm start
```

The API will be available at http://localhost:3001

### Discord Bot

See [discord-bot/README.md](discord-bot/README.md) for detailed bot setup instructions.

Quick setup:
1. Install Red-DiscordBot
2. Copy `collabwarz.py` to your cogs folder
3. Load the cog: `[p]load collabwarz`
4. Configure: `[p]cw setchannel #announcements`

## Project Structure

```
.
├── src/                    # Frontend React application
│   ├── components/         # React components
│   ├── pages/             # Page components
│   ├── context/           # React context (Auth)
│   ├── styles/            # CSS styles
│   └── data/              # Mock data
├── server/                # Backend API (Discord OAuth)
│   ├── index.js           # Express server
│   └── .env.example       # Environment variables template
├── discord-bot/           # Discord Redbot cog
│   ├── collabwarz.py     # Main cog file
│   └── README.md         # Bot documentation
└── index.html            # HTML entry point
```

## Environment Variables

### Frontend (.env)
- `VITE_API_URL` - Backend API URL (default: http://localhost:3001)

### Backend (server/.env)
- `DISCORD_CLIENT_ID` - Discord OAuth Client ID
- `DISCORD_CLIENT_SECRET` - Discord OAuth Client Secret
- `DISCORD_REDIRECT_URI` - OAuth callback URL
- `PORT` - Server port (default: 3001)
- `FRONTEND_URL` - Frontend URL for CORS

## Building for Production

```bash
npm run build
```

The built files will be in the `dist` directory.

## Technologies

- **Frontend**: React, Vite, React Router
- **Backend**: Express.js, Node.js
- **Bot**: Python, Red-DiscordBot, discord.py
- **Auth**: Discord OAuth 2.0
- **AI**: OpenAI API (or free alternatives)

## Color Theme

The application uses a jungle-inspired dark green theme matching the main SoundGarden streamer site:
- Background: Dark forest green (#0a1f0f)
- Accent: Bright green (#4ade80, #34d399)
- Cards: Dark green (#0d2415)

## Contributing

This is part of the SoundGarden ecosystem. Contact the SoundGarden team for contribution guidelines.

## License
© 2025 Heymow
