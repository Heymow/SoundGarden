# 🚀 Quick Start Guide - Collab Warz Bot

## Express Installation (5 minutes)

### 1. Prerequisites
```bash
pip install Red-DiscordBot aiohttp
```

### 2. Automatic Installation
```bash
python install.py
```
Follow the interactive wizard to configure your bot.

### 3. Load the Cog
```
[p]load collabwarz
```

### 4. Minimal Configuration
```
[p]cw setapi https://api.openai.com/v1 YOUR_API_KEY
[p]cw setchannel CHANNEL_ID
[p]cw status
```

---

## Quick YAGPDB Setup

### YAGPDB Prerequisites
1. YAGPDB installed on your server
2. Reputation system enabled
3. Admin channel configured

### Bot Configuration
```
[p]cw setadminchannel ADMIN_CHANNEL_ID
[p]cw setrepamount 2
```

### Test Rewards
```
[p]cw declarewinner "Test Team" @user1 @user2
```

---

## Essential Commands

### 👑 Administration
| Command | Description |
|---------|-------------|
| `[p]cw status` | Complete bot status |
| `[p]cw scheduler on/off` | Schedule control |
| `[p]cw generatetheme` | New AI theme |
| `[p]cw setfrontendapi [url] [key]` | Configure voting API |
| `[p]cw checkvotes` | Check current results |
| `[p]cw declarewinner "Team" @user1 @user2` | 🚨 Manual override |

### 🎵 Users
| Command | Description |
|---------|-------------|
| `[p]cw theme` | Current theme |
| `[p]cw deadline` | Next deadline |
| `[p]cw history` | Theme history |
| `[p]cw teams stats @user` | User statistics |

---

## Automatic Scheduling

### Activation
```
[p]cw scheduler on
```

### How it Works
- **Friday 12:00 PM**: Voting phase starts
- **Sunday 8:00 PM**: Winner determination from votes
- **Sunday 9:00 PM**: Next theme generation
- **Monday 9:00 AM**: New week starts (or Tuesday if face-off active)
- **Auto-cancel**: If < 2 teams participating

### Face-off System
- **Tie Detection**: Automatic 24-hour face-off
- **Delayed Start**: Next week starts Tuesday instead of Monday
- **Final Tie**: Random selection between tied teams

---

## Discord Submissions

### Required Format
```
Team name: My Amazing Team
@partner here's our track!
[SoundCloud/YouTube link]
```

### Validation
- Team name with "Team name:"
- Partner mention (@)
- Both members in same team

---

## Automatic Winner Determination & Rewards

### Voting-Based System
1. **Sunday 8 PM**: Bot fetches voting results from frontend API
2. **Clear Winner**: Immediate winner announcement with vote counts
3. **Tie Detected**: 24-hour face-off between tied teams
4. **Face-off End**: Final winner or random selection if still tied
5. **Automatic Rep**: YAGPDB rewards distributed to winners

### Frontend API Integration
```
[p]cw setfrontendapi https://yoursite.com optional-api-key
[p]cw testfrontend
[p]cw checkvotes
```

### Generated Message Examples

**Normal Winner:**
```
🏆 WINNER ANNOUNCEMENT! 🏆

🎵 Winning Team: Amazing Duo
👥 Members: @Alice & @Bob

📊 Final Results:
� Amazing Duo: 127 votes
• Digital Dreams: 89 votes
• Beat Masters: 45 votes

�🌸 Rep Rewards:
• @Alice: +2 petals (Total: 15 petals)
• @Bob: +2 petals (Total: 8 petals)
```

**Face-off Winner:**
```
⚔️ FACE-OFF WINNER! ⚔️

🏆 Amazing Duo wins the 24-hour tie-breaker! 🏆

📊 Face-off Results:
🏆 Amazing Duo: 156 votes
• Digital Dreams: 134 votes
```

---

## Team Management

### Team Search
```
[p]cw teams search alice        # Alice's teams
[p]cw teams week 2025-W44      # Week's teams
[p]cw teams stats @alice       # Alice's stats
```

### Permanent History
- All teams preserved
- Search by user/week
- Participation statistics
- Frequent partner analysis

---

## Quick Troubleshooting

### ❌ Themes not generating
**Cause**: API not configured
**Solution**: 
```
[p]cw setapi https://api.openai.com/v1 YOUR_KEY
[p]cw generatetheme
```

### ❌ Scheduler inactive
**Cause**: No channel configured
**Solution**:
```
[p]cw setchannel CHANNEL_ID
[p]cw scheduler on
```

### ❌ Rep not distributed
**Cause**: Missing admin channel
**Solution**:
```
[p]cw setadminchannel ADMIN_CHANNEL_ID
```

### ❌ Teams not validated
**Cause**: Incorrect Discord format
**Solution**: Use exact format:
```
Team name: Team Name
@partner our submission
```

---

## Advanced Configuration

### Alternative AI Models
```
[p]cw setapi https://api.anthropic.com/v1 CLAUDE_KEY
[p]cw setmodel claude-3-haiku-20240307
```

### Competition Settings
```
[p]cw minteams 3              # Minimum 3 teams
[p]cw togglevalidation        # Disable Discord validation
[p]cw toggleping             # Disable @everyone
```

### Custom Schedules
```
[p]cw setschedule friday 18:00    # End Friday 6 PM
[p]cw setschedule sunday 12:00    # Theme Sunday 12 PM
```

---

## Support & Resources

### 📁 Important Files
- `collabwarz.py` - Main bot code
- `README.md` - Complete documentation  
- `config_example.json` - Example configuration
- `test_yagpdb_rewards.py` - System tests

### 🔗 Useful Links
- [Red-DiscordBot Docs](https://docs.discord.red/)
- [YAGPDB Commands](https://docs.yagpdb.xyz/)
- [OpenAI API](https://platform.openai.com/docs)

### 📞 Help
1. Check `[p]cw status` for diagnostics
2. Review Red-DiscordBot logs
3. Test step by step with individual commands

---

## ✅ Deployment Checklist

- [ ] Red-DiscordBot installed and working
- [ ] Python dependencies installed (`aiohttp`)
- [ ] Cog `collabwarz.py` loaded
- [ ] AI API configured and tested
- [ ] Competition channel configured
- [ ] YAGPDB installed with rep system
- [ ] Admin channel configured for YAGPDB
- [ ] Correct bot permissions
- [ ] Complete test with `[p]cw status`
- [ ] Scheduler activated
- [ ] First theme generated

🎉 **Your Collab Warz bot is operational!**