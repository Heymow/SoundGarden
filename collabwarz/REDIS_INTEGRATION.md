# Redis Integration for Admin Panel

> Enable real-time communication between the web admin panel and CollabWarz Discord bot.

## Quick Setup

### 1. Install Redis Support
```bash
pip install redis>=4.5.0
```

### 2. Configure Redis URL
```bash
# Production
export REDIS_URL="redis://username:password@hostname:port"

# Development  
export REDIS_URL="redis://localhost:6379"
```

### 3. Reload Cog
```
[p]reload collabwarz
```

## What This Enables

### Real-Time Communication
- Admin panel sends commands → Bot executes immediately
- Bot status updates → Panel reflects changes instantly
- Queue-based system ensures reliable delivery

### Supported Actions
- `start_phase` - Begin new competition phase with theme
- `end_phase` - End current phase and transition  
- `cancel_week` - Cancel current competition week
- `set_theme` - Update competition theme
- `enable_automation` / `disable_automation` - Control bot automation

- `start_phase` - Start submission/voting phase with optional theme
- `end_phase` - End current phase and move to next
- `cancel_week` - Cancel the current competition week
- `enable_automation` - Enable automated announcements
- `disable_automation` - Disable automated announcements  
- `set_theme` - Update the competition theme

### ✅ Status Synchronization
The cog provides this information to the admin panel:

## Verification

Check RedBot logs for these messages after setup:
```
✅ CollabWarz: Redis connected for admin panel communication  
🔄 CollabWarz: Started Redis communication loop
```

## Troubleshooting

### No Redis Connection
- Bot continues working normally without admin panel integration
- Check `REDIS_URL` environment variable is set correctly

### Test Connection
```bash
redis-cli -u "your-redis-url" ping  # Should return PONG
```

### Reload Issues  
```bash
pip install redis>=4.5.0
[p]reload collabwarz
```