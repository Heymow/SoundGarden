# Admin Panel Integration - Testing Guide

## Overview

This document outlines how to test the admin panel integration with the Discord bot backend.

## Pre-Testing Setup

### 1. Start the Discord Bot with API Enabled

```bash
# In Discord, run these commands:
[p]cw apiserver enable
[p]cw apiconfig api_server_port 8080
[p]cw apiconfig api_server_enabled true
[p]cw generatetoken
```

Save the token provided by the bot.

### 2. Start the Backend Server

```bash
cd server
npm install
npm start
```

The server should start on port 3001.

### 3. Start the Frontend

```bash
npm install
npm run dev
```

The frontend should start on port 3000.

### 4. Set Admin Token

1. Open http://localhost:3000/admin in browser
2. Open browser console (F12)
3. Run: `localStorage.setItem('discordAdminToken', 'YOUR_TOKEN_HERE');`
4. Refresh the page

## Testing Checklist

### Competition Management Tab

#### Phase Control
- [ ] Click each phase button (Submission, Voting, Paused, Ended, Cancelled, Inactive)
- [ ] Verify success message appears
- [ ] Check that the phase badge updates correctly
- [ ] Verify the bot's actual phase changed in Discord

#### Theme Management
- [ ] Enter a new theme in "Current Theme" input
- [ ] Click "Update Theme" button
- [ ] Verify success message appears
- [ ] Check bot status in Discord to confirm theme changed

#### AI Theme Generation
- [ ] Click "🤖 Generate AI Theme" button
- [ ] Verify a random theme is suggested in "Next Week's Theme" field
- [ ] Note: This is client-side fallback (real AI needs bot commands)

#### Week Control
- [ ] Click "▶️ Start Next Week"
  - Should show error about needing a theme (expected behavior)
- [ ] Click "🏆 End Week & Announce Winner"
  - Should set phase to "ended"
- [ ] Click "❌ Cancel This Week"
  - Confirm the dialog
  - Should set phase to "cancelled"

#### Competition Settings
- [ ] Modify "Minimum Teams Required"
- [ ] Modify "Reputation Points for Winner"
- [ ] Toggle "Auto-announce phase changes"
- [ ] Toggle "Validate submissions format"
- [ ] Click "Save Settings"
- [ ] Verify success message appears

### Voting Management Tab

#### Current Results Display
- [ ] Verify voting results load automatically
- [ ] Check that vote counts display correctly
- [ ] Verify progress bars show proportional widths
- [ ] Check that rankings (🥇🥈🥉) appear correctly

#### Vote Audit
- [ ] Select a week from the dropdown
- [ ] Click "Load Detailed Audit"
- [ ] Verify vote details table appears
- [ ] Check that voter names, votes, and timestamps display
- [ ] Click "Remove" on a vote
  - Confirm the dialog
  - Verify vote is removed and audit reloads

#### Voting Controls
- [ ] Click "🔄 Reset All Votes"
  - Should show error (feature requires individual removal)
- [ ] Click "🗑️ Remove Invalid Votes"
  - Should show placeholder success message
- [ ] Click "📊 Export Results"
  - Should show placeholder success message

### Team Management Tab

#### Current Week Submissions
- [ ] Verify submissions load automatically
- [ ] Check that team names display
- [ ] Verify member names are shown
- [ ] Check that submission URLs are clickable
- [ ] Click "✓ Approve" on a submission
  - Should show success message (approval is placeholder)
- [ ] Click "✗ Reject" on a submission
  - Confirm the dialog
  - Verify submission is removed
  - Check that list updates

### Admin Dashboard Tab

#### Statistics
- [ ] Verify stats load on page load
- [ ] Check that current phase displays
- [ ] Verify theme displays correctly
- [ ] Check submission and vote counts

#### Quick Actions
- [ ] Click "▶️ Start New Week"
  - Should show error about needing theme
- [ ] Click "🔄 Change Phase"
  - Should cycle through phases
- [ ] Click "🏆 Announce Winner"
  - Should set phase to "ended"

### Announcements Tab

#### Send Announcement
- [ ] Select "Custom Message" type
- [ ] Enter a test message
- [ ] Click "Send Announcement"
  - Should show placeholder success (needs Discord commands)
- [ ] Try other announcement types (Submission Start, Voting Start, etc.)

#### Auto Settings
- [ ] Toggle "Enable Auto-Announcements"
- [ ] Toggle "Require Admin Confirmation"
- [ ] Click "Save Settings"
- [ ] Verify success message

### AI Config Tab

#### AI Settings
- [ ] Enter API URL
- [ ] Modify model name
- [ ] Adjust temperature slider
- [ ] Adjust max tokens
- [ ] Click "Save Configuration"
- [ ] Verify success message
- [ ] Click "Test AI Connection"
  - Should show placeholder message

### System Tab

#### System Health
- [ ] Check that status indicators display
- [ ] Verify health checks show correct status

#### System Actions
- [ ] Click "🔄 Sync Data"
  - Should show placeholder success
- [ ] Click "♻️ Restart Bot"
  - Confirm the dialog
  - Should show placeholder message (requires platform access)

## Error Testing

### Authentication Errors
- [ ] Clear localStorage token
- [ ] Try any admin action
- [ ] Should see "Admin token not found" error
- [ ] Set invalid token
- [ ] Try any admin action
- [ ] Should see authentication error

### Network Errors
- [ ] Stop the Discord bot
- [ ] Try any admin action
- [ ] Should see network/connection error
- [ ] Verify error message displays properly

### Validation Errors
- [ ] Try to update theme with empty value
- [ ] Should see validation error

## Visual Testing

### Loading States
- [ ] Click any action button
- [ ] Verify button shows disabled state during loading
- [ ] Check that loading text appears where applicable

### Success Messages
- [ ] Perform any successful action
- [ ] Verify green success alert appears
- [ ] Check that it auto-dismisses after 5 seconds
- [ ] Verify checkmark icon displays

### Error Messages
- [ ] Trigger any error
- [ ] Verify red error alert appears
- [ ] Check that it auto-dismisses after 5 seconds
- [ ] Verify X icon displays

### Responsive Design
- [ ] Resize browser to mobile width
- [ ] Check that all admin sections are usable
- [ ] Verify buttons don't overflow
- [ ] Check that tables scroll horizontally if needed

## API Endpoint Testing

### Test with curl

```bash
# Get status (replace TOKEN with your admin token)
curl -H "Authorization: Bearer TOKEN" http://localhost:8080/api/admin/status

# Get submissions
curl -H "Authorization: Bearer TOKEN" http://localhost:8080/api/admin/submissions

# Set phase
curl -X POST -H "Authorization: Bearer TOKEN" -H "Content-Type: application/json" \
  -d '{"action":"set_phase","params":{"phase":"voting"}}' \
  http://localhost:8080/api/admin/actions

# Set theme
curl -X POST -H "Authorization: Bearer TOKEN" -H "Content-Type: application/json" \
  -d '{"action":"set_theme","params":{"theme":"Cosmic Dreams"}}' \
  http://localhost:8080/api/admin/actions

# Get vote details
curl -H "Authorization: Bearer TOKEN" \
  http://localhost:8080/api/admin/votes/2024-01-15/details

# Remove a submission
curl -X DELETE -H "Authorization: Bearer TOKEN" \
  http://localhost:8080/api/admin/submissions/Team%20Alpha
```

## Expected Results

### All Actions Should:
1. Show loading state immediately
2. Disable button during action
3. Show success or error message
4. Auto-dismiss message after 5 seconds
5. Update UI with new data when applicable
6. Log any errors to console

### All Data Loading Should:
1. Happen automatically on component mount
2. Show loading indicator during fetch
3. Display data when loaded
4. Show error message if fetch fails
5. Provide user feedback

## Common Issues

### Token Issues
- **Problem**: "Invalid token" error
- **Solution**: Regenerate token via `[p]cw generatetoken`

### CORS Issues
- **Problem**: CORS errors in console
- **Solution**: Configure bot's `cors_origins` setting

### Port Conflicts
- **Problem**: Frontend won't start
- **Solution**: Check if port 3000 is available

### Bot Not Responding
- **Problem**: All API calls timeout
- **Solution**: Verify bot API server is enabled and running

## Performance Testing

- [ ] Test rapid button clicks (should not double-submit)
- [ ] Test loading large vote audit data
- [ ] Test with slow network connection
- [ ] Verify no memory leaks after extended use

## Security Testing

- [ ] Verify token is not exposed in network requests (should be in header)
- [ ] Check that sensitive config data is hidden
- [ ] Verify admin-only actions require authentication
- [ ] Test that expired tokens are rejected

## Success Criteria

✅ All admin actions connect to bot API
✅ Authentication works with Bearer tokens
✅ Loading states prevent double-submissions
✅ Success/error messages display properly
✅ Data loads from backend on component mount
✅ No console errors during normal operation
✅ Build completes without errors
✅ No security vulnerabilities detected

## Notes

- Some actions (AI generation, announcements, bot restart) may show placeholder responses as they require Discord bot commands or platform access
- The system is designed to fail gracefully with helpful error messages
- All API calls include proper error handling
- Token management is handled via localStorage for simplicity
