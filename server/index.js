import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import axios from "axios";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Discord OAuth credentials
const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const DISCORD_REDIRECT_URI =
  process.env.DISCORD_REDIRECT_URI ||
  "http://localhost:3001/auth/discord/callback";
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";

// Discord Bot Communication Configuration
const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const DISCORD_GUILD_ID = process.env.DISCORD_GUILD_ID;
const DISCORD_ADMIN_CHANNEL_ID = process.env.DISCORD_ADMIN_CHANNEL_ID;
const COMMAND_PREFIX = process.env.COMMAND_PREFIX || "!cw";

console.log(`Discord Guild ID: ${DISCORD_GUILD_ID}`);
console.log(`Admin Channel ID: ${DISCORD_ADMIN_CHANNEL_ID}`);

app.use(
  cors({
    origin: FRONTEND_URL,
    credentials: true,
  })
);
app.use(express.json());

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// Discord OAuth - Initiate login
app.get("/auth/discord", (req, res) => {
  const params = new URLSearchParams({
    client_id: DISCORD_CLIENT_ID,
    redirect_uri: DISCORD_REDIRECT_URI,
    response_type: "code",
    scope: "identify", // Minimal permissions - bot will verify server membership
  });

  res.redirect(`https://discord.com/api/oauth2/authorize?${params.toString()}`);
});

// Discord OAuth - Callback
app.get("/auth/discord/callback", async (req, res) => {
  const { code } = req.query;

  if (!code) {
    return res.redirect(`${FRONTEND_URL}?error=no_code`);
  }

  try {
    // Exchange code for access token
    const tokenResponse = await axios.post(
      "https://discord.com/api/oauth2/token",
      new URLSearchParams({
        client_id: DISCORD_CLIENT_ID,
        client_secret: DISCORD_CLIENT_SECRET,
        code: code,
        grant_type: "authorization_code",
        redirect_uri: DISCORD_REDIRECT_URI,
      }),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    const { access_token } = tokenResponse.data;

    // Get user info (minimal data needed)
    const userResponse = await axios.get("https://discord.com/api/users/@me", {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
    });

    const user = userResponse.data;

    // Create user object (server membership will be verified by bot during actions)
    const userData = {
      id: user.id,
      username:
        user.discriminator && user.discriminator !== "0"
          ? `${user.username}#${user.discriminator}`
          : user.username,
      avatar: user.avatar
        ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`
        : `https://cdn.discordapp.com/embed/avatars/${
            user.discriminator ? parseInt(user.discriminator) % 5 : 0
          }.png`,
    };

    // Redirect to frontend with user data
    const userDataEncoded = encodeURIComponent(JSON.stringify(userData));
    res.redirect(`${FRONTEND_URL}?auth=success&user=${userDataEncoded}`);
  } catch (error) {
    console.error(
      "Discord OAuth error:",
      error.response?.data || error.message
    );
    res.redirect(`${FRONTEND_URL}?error=auth_failed`);
  }
});

// Get current user info (if needed later)
app.get("/api/user", (req, res) => {
  // This would need proper session management
  res.json({ message: "User endpoint - implement session management" });
});

// ========== COLLABWARZ API ENDPOINTS ==========
// These endpoints communicate with Discord bot via Discord API

// Helper function to send Discord messages (bot commands)
async function sendDiscordCommand(command, waitForResponse = true) {
  if (!DISCORD_BOT_TOKEN || !DISCORD_ADMIN_CHANNEL_ID) {
    throw new Error('Discord bot token or admin channel ID not configured');
  }

  const url = `https://discord.com/api/v10/channels/${DISCORD_ADMIN_CHANNEL_ID}/messages`;
  
  console.log(`🎮 Sending Discord command: ${command}`);

  try {
    const response = await axios.post(url, {
      content: command
    }, {
      headers: {
        'Authorization': `Bot ${DISCORD_BOT_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    console.log(`✅ Command sent successfully`);

    if (waitForResponse) {
      // Wait a bit for bot to process and respond
      await new Promise(resolve => setTimeout(resolve, 2000));
      return await getLastBotResponse();
    }

    return { success: true, message: 'Command sent' };
  } catch (error) {
    console.error(`❌ Failed to send Discord command:`, error.message);
    throw error;
  }
}

// Helper function to get last bot response from admin channel
async function getLastBotResponse() {
  if (!DISCORD_BOT_TOKEN || !DISCORD_ADMIN_CHANNEL_ID) {
    throw new Error('Discord bot token or admin channel ID not configured');
  }

  const url = `https://discord.com/api/v10/channels/${DISCORD_ADMIN_CHANNEL_ID}/messages?limit=10`;

  try {
    const response = await axios.get(url, {
      headers: {
        'Authorization': `Bot ${DISCORD_BOT_TOKEN}`
      }
    });

    // Find the most recent bot message
    const botMessage = response.data.find(msg => msg.author.bot && !msg.content.startsWith(COMMAND_PREFIX));
    
    if (botMessage) {
      return parseDiscordBotResponse(botMessage.content);
    }

    return { error: 'No bot response found' };
  } catch (error) {
    console.error(`❌ Failed to get bot response:`, error.message);
    throw error;
  }
}

// Helper function to parse bot responses and extract competition data
function parseDiscordBotResponse(content) {
  // This will parse bot responses to extract competition status
  // For now, return a basic structure
  return {
    phase: "submission", 
    theme: "Cosmic Dreams",
    automation_enabled: true,
    week_cancelled: false,
    team_count: 0,
    timestamp: new Date().toISOString()
  };
}

// Helper function to get competition status via Discord commands
async function getCompetitionStatus() {
  try {
    console.log(`📊 Getting competition status via Discord`);
    
    // Send status command and parse response
    await sendDiscordCommand(`${COMMAND_PREFIX} status`, false);
    
    // Wait for bot response and parse
    await new Promise(resolve => setTimeout(resolve, 3000));
    const status = await getLastBotResponse();
    
    return status;
  } catch (error) {
    console.error('Failed to get competition status:', error.message);
    // Return fallback data
    return {
      phase: "unknown",
      theme: "Unable to fetch",
      automation_enabled: false,
      week_cancelled: false,
      team_count: 0,
      error: true,
      timestamp: new Date().toISOString()
    };
  }
}

// Test endpoints
app.get("/api/ping", (req, res) => {
  res.json({ status: "ok", message: "CollabWarz API is running via Discord" });
});

app.get("/api/test", (req, res) => {
  res.json({ status: "success", message: "Discord communication ready" });
});

// Admin endpoints (via Discord commands)
app.get("/api/admin/status", async (req, res) => {
  try {
    const status = await getCompetitionStatus();
    res.json(status);
  } catch (error) {
    console.error('Failed to get admin status:', error.message);
    res.status(500).json({
      error: 'Failed to get status from Discord bot',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Public endpoints (via Discord commands)
app.get("/api/public/status", async (req, res) => {
  try {
    const status = await getCompetitionStatus();
    res.json({
      competition: {
        phase: status.phase,
        theme: status.theme,
        week_cancelled: status.week_cancelled,
        team_count: status.team_count
      },
      timestamp: status.timestamp
    });
  } catch (error) {
    console.error('Failed to get public status:', error.message);
    res.status(500).json({
      error: 'Failed to get status from Discord bot',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Admin actions endpoint - sends Discord commands
app.post("/api/admin/actions", async (req, res) => {
  try {
    const { action, params = {}, ...directParams } = req.body;
    const actionParams = params.phase ? params : directParams;
    
    console.log(`🎮 Admin action via Discord: ${action}`, actionParams);

    let command;
    let successMessage;

    // Map admin actions to Discord bot commands
    switch (action) {
      case "set_theme":
      case "update_theme":
        command = `${COMMAND_PREFIX} settheme "${actionParams.theme}"`;
        successMessage = `Theme updated to: ${actionParams.theme}`;
        break;
        
      case "set_phase":
        command = `${COMMAND_PREFIX} setphase ${actionParams.phase}`;
        successMessage = `Phase changed to: ${actionParams.phase}`;
        break;
        
      case "next_phase":
        command = `${COMMAND_PREFIX} nextphase`;
        successMessage = "Phase advanced successfully";
        break;
        
      case "toggle_automation":
        command = `${COMMAND_PREFIX} toggle`;
        successMessage = `Automation toggled`;
        break;
        
      case "cancel_week":
        command = `${COMMAND_PREFIX} pause Week cancelled by admin`;
        successMessage = "Week cancelled successfully";
        break;
        
      case "reset_week":
        command = `${COMMAND_PREFIX} resume`;
        successMessage = "Week reset successfully";
        break;
        
      case "force_voting":
        command = `${COMMAND_PREFIX} setphase voting`;
        successMessage = "Voting phase started";
        break;
        
      case "announce_winners":
        command = `${COMMAND_PREFIX} checkvotes`;
        successMessage = "Winners announced successfully";
        break;
        
      default:
        return res.status(400).json({
          success: false,
          message: `Unknown action: ${action}`
        });
    }

    // Send command to Discord
    await sendDiscordCommand(command, false);

    // Return success response
    res.json({
      success: true,
      message: successMessage,
      command: command,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Failed to execute Discord command:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to send command to Discord bot',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Discord OAuth redirect URI: ${DISCORD_REDIRECT_URI}`);
});
