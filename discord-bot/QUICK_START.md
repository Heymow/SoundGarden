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
[p]cw setchannel #competition-channel
[p]cw settheme "Your First Theme"
[p]cw setphase submission
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
| `[p]cw toggle` | Enable/disable automation |
| `[p]cw settheme "New Theme"` | Set competition theme |
| `[p]cw generatetheme` | Generate AI theme for next week |
| `[p]cw setphase submission/voting` | Change phase manually |
| `[p]cw pause [reason]` | Pause competition temporarily |
| `[p]cw resume` | Resume paused competition |
| `[p]cw nextweek` | Start new competition week |
| `[p]cw apiserver start` | Start integrated API |
| `[p]cw checkvotes` | Check current results |
| `[p]cw sessionauth [enable/disable]` | � Configure Discord OAuth |
| `[p]cw votestats` | 📊 View voting statistics |
| `[p]cw clearvotes [user]` | 🧹 Remove duplicate votes |
| `[p]cw adjustvotes team ±N` | ⚖️ Manually adjust votes |
| `[p]cw declarewinner "Team" @user1 @user2` | 🚨 Manual override |

### 🎵 Users
| Command | Description |
|---------|-------------|
| `[p]cw theme` | Current theme |
| `[p]cw deadline` | Next deadline |
| `[p]cw history` | Competition history |
| `[p]cw teams stats @user` | User statistics |

---

## Automatic Scheduling

### Activation
```
[p]cw toggle
```

### How it Works
- **Monday 9:00 AM**: New week starts with new theme
- **Friday 12:00 PM**: Voting phase starts automatically
- **Sunday 8:00 PM**: Winner determination from votes
- **Auto-cancel**: If insufficient teams participating
- **Message moderation**: Automatic cleanup of invalid submissions

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
https://suno.com/song/your-track-id
```

### Validation & Restrictions
- **Suno.com URLs ONLY**: Other platforms automatically rejected
- Team name with "Team name:" prefix
- Partner mention (@) required
- Both members must be in Discord server
- **Automatic moderation**: Invalid messages deleted with feedback
- **Admin exemptions**: Admins can post anything anytime

---

## Automatic Winner Determination & Rewards

### Voting-Based System
1. **Sunday 8 PM**: Bot fetches voting results from frontend API
2. **Clear Winner**: Immediate winner announcement with vote counts
3. **Tie Detected**: 24-hour face-off between tied teams
4. **Face-off End**: Final winner or random selection if still tied
5. **Automatic Rep**: YAGPDB rewards distributed to winners

### Integrated API System
```
[p]cw apiserver start
[p]cw testpublicapi
[p]cw checkvotes
```

### � Simple Vote Security
**Session Token Authentication:**
- 🔐 **WEB INTERFACE PREFERRED**: Official website with Discord OAuth
- 🎫 **SESSION TOKENS**: Discord authentication for vote validation
- � **GUILD VALIDATION**: Only server members can vote
- 🚫 **NO DOUBLE VOTING**: Individual vote tracking prevents duplicates

**� Simple Security Setup:**
```
[p]cw sessionauth enable         # Enable Discord session token validation
[p]cw sessionauth status         # Check current authentication status
[p]cw apiserver start           # Start API server for frontend integration
```

**Admin Monitoring:**
```
[p]cw votestats                 # View voting statistics and results
[p]cw clearvotes                # Remove duplicate votes if detected
[p]cw adjustvotes "Team Alpha" -2  # Manual vote adjustment if needed
```

**🔒 Simple Security Features:**
- 🎫 **Discord OAuth Required** (when session auth enabled)
- 👤 **Guild Membership Check** (automatic validation)
- 🚫 **Duplicate Vote Prevention** (individual tracking)
- 📊 **Vote Statistics** (monitoring and transparency)

**💡 Philosophy: Simple & Effective**
Session token + guild membership = sufficient security:
- ✅ Prevents unauthorized voting (Discord OAuth)
- ✅ Prevents double voting (individual tracking)
- ✅ Easy to implement (no complex configuration)
- ✅ Easy to debug (clear error messages)
- ❌ Over-engineering avoided = maintainable code
```
[p]cw zerotolerance              # 🚫 ACTIVATE maximum security instantly
[p]cw security iplimit 1         # 1 vote per minute per IP (RECOMMENDED)  
[p]cw security userlimit 1       # 1 attempt per user (RECOMMENDED)
[p]cw security failedlimit 1     # 0 failed attempts tolerated (RECOMMENDED)
[p]cw security patterns on       # Pattern detection (REQUIRED)
```

**Admin Monitoring & Response:**
```
[p]cw securityreport      # Comprehensive security analysis
[p]cw suspicious          # View detected suspicious activity
[p]cw votestats           # Detailed voting & security statistics
[p]cw clearvotes          # Remove all duplicate votes
[p]cw adjustvotes "Team Alpha" -2  # Manual vote adjustment
[p]cw clearactivity       # Reset suspicious activity tracking
```

**🚫 What Gets Instantly Blocked:**
- � **ANY failed vote attempt** (web interface = no errors possible)
- 🚨 **Direct API/HTTP requests** (bypassing web interface)
- � **Multiple users from same IP** (script attack detected)
- 🚨 **Second attempt by same user** (already voted)
- � **Non-server members** (unauthorized voters)
- 🚨 **Any suspicious pattern** (automated behavior)

**� Why Zero-Tolerance Works:**
Web interface eliminates ALL legitimate error sources:
- ✅ No typos (graphical selection)
- ✅ No invalid data (form validation)  
- ✅ No network issues (proper retry handling)
- ✅ No user confusion (clear interface)
- ❌ Any deviation = security threat

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

## API Server & Frontend Integration

### API Setup
```
[p]cw apiserver start           # Start API server
[p]cw apiconfig cors https://yoursite.com  # Configure CORS
[p]cw testpublicapi            # Test all endpoints
```

### Suno Integration Setup
```
[p]cw sunoconfig enable         # Enable song metadata fetching
[p]cw testsuno https://suno.com/song/abc123  # Test metadata extraction
[p]cw sunoconfig status         # Check integration status
```

### Admin Panel Setup
```
[p]cw setadmin @YourUser       # Configure Discord admin (required first)
[p]cw admintoken generate      # Generate secure token (sent via DM) - Admin only
[p]cw admintoken status        # Check token status & ownership
```

### Available APIs
- **Public API**: Competition data, submissions, voting results, history, leaderboard
  - 🎵 **Song Metadata**: Titles, audio URLs, cover art, Suno profiles
  - 🎧 **Audio Playback**: Direct streaming URLs for frontend players
  - 👤 **Artist Integration**: Suno handles and profile links
- **Admin API**: Secure management, configuration updates, remote actions
  - 🛡️ **Moderation Tools**: Remove submissions, votes, entire weeks
  - 🔍 **Audit Capabilities**: Detailed vote inspection and user tracking
  - ⚙️ **Remote Control**: Phase management, theme updates, automation
- **Members API**: Guild member directory for team formation

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
**Cause**: AI API not configured
**Solution**: 
```
[p]cw setai https://api.openai.com/v1 YOUR_KEY
[p]cw generatetheme
```

### ❌ Automation inactive
**Cause**: No channel or automation disabled
**Solution**:
```
[p]cw setchannel #competition-channel
[p]cw toggle
```

### ❌ Messages not being moderated
**Cause**: Auto-delete disabled
**Solution**:
```
[p]cw autodeletemsgs
```

### ❌ Rep not distributed
**Cause**: Missing admin channel
**Solution**:
```
[p]cw setadminchannel ADMIN_CHANNEL_ID
```

### ❌ Teams not validated
**Cause**: Invalid submission format or non-Suno URL
**Solution**: Use exact format with Suno URL:
```
Team name: Team Name
@partner our submission
https://suno.com/song/track-id
```

### ❌ Song metadata not appearing
**Cause**: Suno integration disabled or API issues
**Solution**:
```
[p]cw sunoconfig enable
[p]cw testsuno https://suno.com/song/abc123
```

### ❌ API endpoints not working
**Cause**: API server not started
**Solution**:
```
[p]cw apiserver start
[p]cw testpublicapi
```

### ❌ Admin token generation fails
**Cause**: User not configured as Discord admin
**Solution**:
```
[p]cw setadmin @YourUser
[p]cw admintoken generate
```

### ❌ Admin API returns "Token user no longer configured as admin"
**Cause**: Admin token belongs to user who lost admin permissions
**Solution**: Generate new token with current admin:
```
[p]cw admintoken revoke
[p]cw admintoken generate
```

---

## Advanced Configuration

### AI Theme Generation
```
[p]cw setai https://api.openai.com/v1 YOUR_API_KEY
[p]cw generatetheme         # Generate theme for next week
[p]cw confirmtheme         # Confirm pending AI theme
[p]cw denytheme           # Reject AI theme
```

### Alternative AI Models
```
[p]cw setai https://api.anthropic.com/v1 CLAUDE_KEY claude-3-haiku
[p]cw aimodel gpt-4
[p]cw aitemp 0.8
[p]cw aitokens 150
```

### Competition Settings
```
[p]cw everyone               # Toggle @everyone pings
[p]cw autodeletemsgs        # Toggle message auto-deletion
[p]cw confirmation          # Enable admin confirmations
```

### Phase Management
```
[p]cw pause Technical issues detected
[p]cw resume
[p]cw cancelweek Competition rules violated
[p]cw endweek Great participation this week
```

---

## Support & Resources

### 📁 Important Files
- `collabwarz.py` - Main bot code
- `README.md` - **Complete documentation with ALL API guides**
- `info.json` - Cog metadata
- `requirements.txt` - Python dependencies

### 🔗 Useful Links
- [Red-DiscordBot Docs](https://docs.discord.red/)
- [YAGPDB Commands](https://docs.yagpdb.xyz/)
- [OpenAI API](https://platform.openai.com/docs)
- [Suno.com](https://suno.com/) - Required platform for submissions

### 📞 Help
1. Check `[p]cw status` for diagnostics
2. Review Red-DiscordBot logs
3. Test step by step with individual commands

---

## ✅ Deployment Checklist

### Basic Setup
- [ ] Red-DiscordBot installed and working
- [ ] Python dependencies installed (`aiohttp`)
- [ ] Cog `collabwarz.py` loaded successfully
- [ ] Competition channel configured with `[p]cw setchannel`
- [ ] Initial theme set with `[p]cw settheme`
- [ ] Admin users configured (see Admin Management below)
- [ ] Correct bot permissions (Manage Messages, Add Reactions)

### Admin Management
```bash
# Set primary admin (for confirmations)
[p]cw setadmin @primary_admin

# Add additional admins (multiple users can be admins)
[p]cw addadmin @admin1
[p]cw addadmin @admin2

# List all configured admins
[p]cw listadmins

# Remove an admin
[p]cw removeadmin @admin1
```

**Admin Access Levels:**
- **Primary Admin**: Receives confirmation DMs, set via `setadmin`
- **Additional Admins**: Full bot control, added via `addadmin`  
- **Permission-Based**: Users with Administrator/Manage Messages/Manage Guild permissions automatically get admin access

### Optional Features
- [ ] AI API configured for theme generation (`[p]cw setai`)
- [ ] Integrated API server started (`[p]cw apiserver start`)
- [ ] Admin token generated for web panel (`[p]cw admintoken generate`)
- [ ] YAGPDB integration for rep rewards
- [ ] Admin confirmations enabled (`[p]cw confirmation`)

### Final Tests
- [ ] Complete status check: `[p]cw status`
- [ ] Automation enabled: `[p]cw toggle`
- [ ] Test submission format validation
- [ ] Test message moderation system
- [ ] API endpoints working: `[p]cw testpublicapi`

🎉 **Your Collab Warz bot is ready for competitions!**

### Next Steps
1. **For Users**: Share submission format and Suno.com requirement
2. **For Developers**: Use README.md for complete API documentation
3. **For Admins**: Configure frontend voting system integration