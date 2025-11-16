# SoundGarden's Collab Warz

> Complete web application and Discord bot system for SoundGarden's Collab Warz music collaboration competition.

## 🚀 Overview

This repository contains a full-stack application with real-time communication between a React web interface and Discord bot for managing music competitions.

### Architecture

```
Admin Panel (React) → Express Backend → Redis Queue → CollabWarz Cog → Discord Actions
```

## ✨ Features

- 🎵 **Modern Web Interface** with jungle-inspired dark green theme
- 🔐 **Discord OAuth Login** for secure authentication
- 🤖 **Automated Discord Bot** (RedBot cog) for competition management
- 🎨 **AI-Powered Announcements** with intelligent fallbacks
- 📱 **Responsive Design** optimized for all devices
- 🔄 **Real-time Communication** via Redis between web and Discord
- ⚡ **Live Admin Panel** for competition control
- 🛡️ **Robust Error Handling** with graceful fallbacks

## 🚀 Quick Start

### Prerequisites

- Node.js (v16+)
- Redis (for production communication)
- Discord Application (for OAuth)
- Red-DiscordBot (for Discord integration)

### 1. Frontend Setup

```bash
# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Start development server
npm run dev
```
Frontend available at: http://localhost:3000

### 2. Backend Setup

```bash
# Navigate to server
cd server

# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Configure Discord OAuth (see Configuration section)
# Start server
npm start
```
Backend API available at: http://localhost:3001

### 3. Discord Bot Setup

#### Option A: GitHub Installation (Recommended)
```bash
# Add repository to Red-DiscordBot
[p]repo add soundgarden https://github.com/Heymow/SoundGarden

# Install and load cog
[p]cog install soundgarden collabwarz
[p]load collabwarz

# Basic configuration
[p]cw setchannel #collab-warz
[p]cw settheme "Your First Theme"
[p]cw toggle
```

#### Option B: Manual Installation
1. Copy `collabwarz/` folder to your Red-DiscordBot cogs directory
2. Install Redis dependency: `pip install redis>=4.5.0`
3. Load cog: `[p]load collabwarz`
4. Configure: `[p]cw setchannel #announcements`

## ⚙️ Configuration

### Discord OAuth Setup

1. Go to https://discord.com/developers/applications
2. Create a new application
3. Go to OAuth2 → General
4. Add redirect URI: `http://localhost:3001/auth/discord/callback`
5. Copy Client ID and Client Secret to your `.env` file

### Redis Communication (Production)

For real-time communication between admin panel and Discord bot:

```bash
# Backend environment variables
REDIS_URL=redis://username:password@hostname:port

# Bot environment variables (same Redis instance)
export REDIS_URL="redis://username:password@hostname:port"
```

### Environment Variables

#### Frontend (`.env`)
```env
VITE_API_URL=http://localhost:3001
```

#### Backend (`server/.env`)
```env
DISCORD_CLIENT_ID=your_discord_client_id
DISCORD_CLIENT_SECRET=your_discord_client_secret
DISCORD_REDIRECT_URI=http://localhost:3001/auth/discord/callback
FRONTEND_URL=http://localhost:3000
REDIS_URL=redis://localhost:6379  # Optional for local dev
PORT=3001
```

## 🏗️ Project Structure

```
SoundGarden/
├── src/                    # React Frontend Application
│   ├── components/         # Reusable UI components
│   │   ├── admin/         # Admin panel components
│   │   ├── AudioPlayer.jsx
│   │   └── ...
│   ├── pages/             # Route-based page components
│   ├── context/           # React context (Auth, AudioPlayer)
│   ├── styles/            # Global CSS styles
│   └── data/              # Mock data and configurations
├── server/                # Express Backend API
│   ├── index.js           # Main server with Redis integration
│   └── .env.example       # Environment template
├── collabwarz/            # Red-DiscordBot Cog
│   ├── collabwarz.py      # Main cog with Redis communication
│   ├── requirements.txt   # Python dependencies
│   ├── info.json          # Cog metadata
│   └── *.md              # Documentation files
├── public/                # Static assets
└── package.json           # Project dependencies and scripts
```

## 🔄 Redis Communication System

The application uses Redis as a message broker for real-time communication:

### Data Flow
```
Admin Panel Action → Express Backend → Redis Queue → CollabWarz Cog → Discord
```

### Supported Actions
- `start_phase` - Begin submission/voting phase with theme
- `end_phase` - End current phase and transition
- `cancel_week` - Cancel current competition week
- `set_theme` - Update competition theme
- `enable_automation` / `disable_automation` - Control automated announcements

### Redis Keys
```
collabwarz:actions          # Action queue (LIST)
collabwarz:status          # Current status (JSON STRING)  
collabwarz:action:{id}     # Action tracking (JSON, 24h TTL)
```

## 🚀 Deployment

### Production Build
```bash
npm run build
```
Built files will be in the `dist` directory.

### Railway Deployment (Recommended)

1. **Deploy Backend**:
   ```bash
   # Add Redis service
   railway add redis
   
   # Set environment variables
   railway variables set REDIS_URL=${{Redis.REDIS_URL}}
   ```

2. **Deploy Frontend**: 
   - Connect Railway to your GitHub repository
   - Set build command: `npm run build`
   - Set start command: serve static files

3. **Configure Bot**:
   ```bash
   # Install Redis in bot environment
   pip install redis>=4.5.0
   
   # Set Redis URL environment variable
   export REDIS_URL="your_railway_redis_url"
   
   # Reload cog
   [p]reload collabwarz
   ```

## 🛠️ Technologies

| Layer | Technologies |
|-------|-------------|
| **Frontend** | React, Vite, React Router, Axios |
| **Backend** | Express.js, Node.js, Redis |
| **Bot** | Python, Red-DiscordBot, discord.py, Redis |
| **Auth** | Discord OAuth 2.0 |
| **Communication** | Redis (message broker) |
| **AI** | OpenAI API with fallbacks |
| **Deployment** | Railway, Docker-ready |

## 🎨 Design System

Jungle-inspired dark theme matching SoundGarden's aesthetic:

```css
/* Color Palette */
--bg-primary: #0a1f0f      /* Dark forest green */
--bg-secondary: #0d2415    /* Card backgrounds */
--accent-primary: #4ade80   /* Bright green */
--accent-secondary: #34d399 /* Secondary green */
--text-primary: #ffffff     /* Primary text */
--text-secondary: #a3a3a3   /* Secondary text */
```

## 🔧 Troubleshooting

### Common Issues

#### Redis Connection Failed
```bash
# Check Redis URL format
redis://username:password@hostname:port

# Verify connectivity
redis-cli -u "your_redis_url" ping
```

#### Discord OAuth Issues
- Verify redirect URI matches exactly
- Check client ID/secret are correct
- Ensure Discord app has proper OAuth2 scope

#### Bot Not Responding to Admin Actions
- Confirm Redis URL is set in bot environment
- Check bot logs for Redis connection messages
- Verify cog is loaded: `[p]cogs`

## 📚 Additional Documentation

- [Quick Reference Guide](QUICK_REFERENCE.md) - Development commands and setup
- [Bot Commands Reference](collabwarz/README.md) - Discord bot usage
- [Cog Installation Guide](collabwarz/INSTALLATION.md) - Bot installation
- [Redis Integration Setup](collabwarz/REDIS_INTEGRATION.md) - Admin panel integration

## 🤝 Contributing

Part of the SoundGarden ecosystem. For contributions:
1. Fork the repository
2. Create a feature branch
3. Submit a pull request

## 📄 License

© 2025 Heymow - SoundGarden Project
