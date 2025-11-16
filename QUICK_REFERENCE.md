# Quick Reference - Development Commands

## Local Development

### Start Frontend
```bash
npm run dev                    # http://localhost:3000
```

### Start Backend  
```bash
npm run start:backend          # http://localhost:3001
```

### Discord Bot Commands
```bash
[p]cw setchannel #collab-warz  # Set announcement channel
[p]cw settheme "Your Theme"    # Set competition theme
[p]cw toggle                   # Enable/disable automation
[p]cw status                   # Check bot status
[p]reload collabwarz           # Reload cog after changes
```

## Redis Integration

### Backend Environment
```bash
REDIS_URL=redis://localhost:6379  # Local Redis
REDIS_URL=redis://user:pass@host:port  # Production Redis
```

### Bot Environment  
```bash
export REDIS_URL="redis://user:pass@host:port"
pip install redis>=4.5.0
[p]reload collabwarz
```

## Admin Panel Actions

Available actions through admin interface:
- `start_phase` - Begin submission/voting with theme
- `end_phase` - End current phase
- `cancel_week` - Cancel competition week  
- `set_theme` - Update theme
- `enable_automation` / `disable_automation` - Control announcements

## File Structure

```
src/                    # React frontend
server/                 # Express backend + Redis
collabwarz/            # Discord bot cog
├── collabwarz.py      # Main cog with Redis integration
└── *.md              # Documentation
```

## Useful URLs

- Frontend: http://localhost:3000
- Backend API: http://localhost:3001
- Admin Panel: http://localhost:3000/admin