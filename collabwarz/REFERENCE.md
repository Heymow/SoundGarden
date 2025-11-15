# 🚀 Collab Warz - Quick Reference Card

## Installation
```bash
[p]repo add soundgarden https://github.com/Heymow/SoundGarden
[p]cog install soundgarden collabwarz
[p]load collabwarz
```

## Essential Setup
```bash
[p]cw setchannel #collab-warz    # Set announcement channel
[p]cw settheme "First Theme"     # Set initial theme
[p]cw toggle                     # Enable automation
[p]cw status                     # Check configuration
```

## Key Commands

### Admin Commands
| Command | Description |
|---------|-------------|
| `[p]cw status` | View bot status |
| `[p]cw toggle` | Enable/disable automation |
| `[p]cw settheme "Theme"` | Change theme |
| `[p]cw setphase submission\|voting` | Change phase |
| `[p]cw nextweek` | Start new week |
| `[p]cw pause [reason]` | Pause competition |
| `[p]cw resume` | Resume competition |

### Voting System
| Command | Description |
|---------|-------------|
| `[p]cw apiserver start` | Start API server |
| `[p]cw checkvotes` | Check voting results |
| `[p]cw declarewinner "Team" @u1 @u2` | Manual winner |

### Configuration
| Command | Description |
|---------|-------------|
| `[p]cw setadmin @user` | Set admin |
| `[p]cw everyone` | Toggle @everyone pings |
| `[p]cw confirmation` | Toggle confirmations |
| `[p]cw setai URL KEY [model]` | Configure AI |

### Team Management
| Command | Description |
|---------|-------------|
| `[p]cw listteams` | Current teams |
| `[p]cw history [weeks]` | Participation history |
| `[p]cw searchteams "query"` | Search teams |

## Public Commands (No prefix needed)
```
!info     - Competition information
!status   - Current status
```

## Submission Format (Discord)
```
Team name: Amazing Duo
@partner our track!
https://suno.com/song/your-track-id
```

## Competition Schedule

### Weekly Mode (Default)
- **Monday 9 AM**: New submissions start
- **Friday Noon**: Voting starts
- **Sunday Evening**: Winner announced

### Bi-Weekly Mode
```bash
[p]cw biweekly    # Toggle bi-weekly mode
```
- **Odd weeks**: Competition runs
- **Even weeks**: Break week

## API Integration
```bash
[p]cw apiserver start                       # Start server
[p]cw apiconfig cors https://yoursite.com   # Configure CORS
[p]cw admintoken generate                   # Get admin token
[p]cw testpublicapi                         # Test endpoints
```

## Troubleshooting

### Bot Not Responding
```bash
[p]cogs             # Check if loaded
[p]reload collabwarz # Reload cog
```

### No Automation
```bash
[p]cw status        # Check if enabled
[p]cw toggle        # Enable if disabled
```

### Update Cog
```bash
[p]cog update collabwarz
[p]reload collabwarz
```

## Documentation
- **Installation Guide**: `collabwarz/INSTALLATION.md`
- **Quick Start**: `collabwarz/QUICK_START.md`
- **Full Documentation**: `collabwarz/README.md`

## Support
Run `[p]help collabwarz` in Discord for detailed help.

---
Made with ❤️ for SoundGarden
