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
const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL; // Webhook for sending commands as "human"
const COMMAND_PREFIX = process.env.COMMAND_PREFIX || "!cw";

console.log(`Discord Guild ID: ${DISCORD_GUILD_ID}`);
console.log(`Admin Channel ID: ${DISCORD_ADMIN_CHANNEL_ID}`);
console.log(`Bot Token configured: ${DISCORD_BOT_TOKEN ? "Yes" : "No"}`);
console.log(`Webhook URL configured: ${DISCORD_WEBHOOK_URL ? "Yes" : "No"}`);
console.log(`Command Prefix: ${COMMAND_PREFIX}`);

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
  console.log(`🎮 Sending Discord command: ${command}`);

  // Try webhook first (appears as human message - RedBot will process it)
  if (DISCORD_WEBHOOK_URL) {
    return await sendViaWebhook(command, waitForResponse);
  }

  // Fallback to bot API (may be ignored by RedBot)
  return await sendViaBot(command, waitForResponse);
}

// Send command via webhook (appears as human user)
async function sendViaWebhook(command, waitForResponse) {
  console.log(`📡 Using webhook: ${DISCORD_WEBHOOK_URL.substring(0, 50)}...`);

  try {
    const response = await axios.post(
      DISCORD_WEBHOOK_URL,
      {
        content: command,
        username: "CollabWarz Admin", // Custom name
        avatar_url: "https://cdn.discordapp.com/emojis/🎵.png", // Optional custom avatar
      },
      {
        headers: {
          "Content-Type": "application/json",
        },
        timeout: 10000,
      }
    );

    console.log(
      `✅ Webhook command sent successfully - Status: ${response.status}`
    );

    if (waitForResponse) {
      await new Promise((resolve) => setTimeout(resolve, 3000));
      return await getLastBotResponse();
    }

    return {
      success: true,
      message: "Command sent via webhook",
      messageId: response.data?.id,
    };
  } catch (error) {
    console.error(`❌ Webhook failed:`, error.message);
    throw new Error(`Webhook communication failed: ${error.message}`);
  }
}

// Send command via bot API (fallback method)
async function sendViaBot(command, waitForResponse) {
  // Check configuration
  if (!DISCORD_BOT_TOKEN) {
    throw new Error("DISCORD_BOT_TOKEN environment variable not set");
  }
  if (!DISCORD_ADMIN_CHANNEL_ID) {
    throw new Error("DISCORD_ADMIN_CHANNEL_ID environment variable not set");
  }

  const url = `https://discord.com/api/v10/channels/${DISCORD_ADMIN_CHANNEL_ID}/messages`;
  console.log(`📡 Using bot API: ${url}`);
  console.log(`🔑 Using bot token: ${DISCORD_BOT_TOKEN.substring(0, 20)}...`);

  try {
    const response = await axios.post(
      url,
      {
        content: command,
      },
      {
        headers: {
          Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
          "Content-Type": "application/json",
        },
        timeout: 10000,
      }
    );

    console.log(`✅ Command sent successfully - Status: ${response.status}`);
    console.log(`📨 Response data:`, response.data);

    if (waitForResponse) {
      // Wait a bit for bot to process and respond
      await new Promise((resolve) => setTimeout(resolve, 2000));
      return await getLastBotResponse();
    }

    return {
      success: true,
      message: "Command sent",
      messageId: response.data.id,
    };
  } catch (error) {
    console.error(`❌ Failed to send Discord command:`, error.message);

    if (error.response) {
      console.error(`Discord API Error:`, {
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data,
      });

      // Provide more specific error messages
      if (error.response.status === 401) {
        throw new Error("Invalid Discord bot token - check DISCORD_BOT_TOKEN");
      } else if (error.response.status === 403) {
        throw new Error(
          "Bot lacks permissions to send messages in this channel"
        );
      } else if (error.response.status === 404) {
        throw new Error(
          "Admin channel not found - check DISCORD_ADMIN_CHANNEL_ID"
        );
      }
    }

    throw error;
  }
}

// Helper function to get last bot response from admin channel
async function getLastBotResponse() {
  if (!DISCORD_BOT_TOKEN || !DISCORD_ADMIN_CHANNEL_ID) {
    throw new Error("Discord bot token or admin channel ID not configured");
  }

  const url = `https://discord.com/api/v10/channels/${DISCORD_ADMIN_CHANNEL_ID}/messages?limit=10`;

  console.log(`📖 Reading bot responses from: ${url}`);

  try {
    const response = await axios.get(url, {
      headers: {
        Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
      },
      timeout: 10000,
    });

    // Find the most recent bot message
    const botMessage = response.data.find(
      (msg) => msg.author.bot && !msg.content.startsWith(COMMAND_PREFIX)
    );

    if (botMessage) {
      return parseDiscordBotResponse(botMessage.content);
    }

    return { error: "No bot response found" };
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
    timestamp: new Date().toISOString(),
  };
}

// Helper function to get competition status via Discord commands
async function getCompetitionStatus() {
  try {
    console.log(`📊 Getting competition status via Discord`);

    // Send status command and parse response
    await sendDiscordCommand(`${COMMAND_PREFIX} status`, false);

    // Wait for bot response and parse
    await new Promise((resolve) => setTimeout(resolve, 3000));
    const status = await getLastBotResponse();

    return status;
  } catch (error) {
    console.error("Failed to get competition status:", error.message);
    // Return fallback data
    return {
      phase: "unknown",
      theme: "Unable to fetch",
      automation_enabled: false,
      week_cancelled: false,
      team_count: 0,
      error: true,
      timestamp: new Date().toISOString(),
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

// Discord configuration diagnostic endpoint
app.get("/api/discord/config", (req, res) => {
  const config = {
    botTokenSet: !!DISCORD_BOT_TOKEN,
    guildIdSet: !!DISCORD_GUILD_ID,
    adminChannelIdSet: !!DISCORD_ADMIN_CHANNEL_ID,
    webhookUrlSet: !!DISCORD_WEBHOOK_URL,
    commandPrefix: COMMAND_PREFIX,
    guildId: DISCORD_GUILD_ID || "NOT_SET",
    adminChannelId: DISCORD_ADMIN_CHANNEL_ID || "NOT_SET",
    communicationMethod: DISCORD_WEBHOOK_URL ? "webhook" : "bot",
  };

  const basicConfigured =
    config.botTokenSet && config.guildIdSet && config.adminChannelIdSet;
  const webhookConfigured = !!DISCORD_WEBHOOK_URL;

  res.json({
    configured: basicConfigured,
    webhookReady: webhookConfigured,
    config,
    message: webhookConfigured
      ? "Webhook communication ready (recommended)"
      : basicConfigured
      ? "Bot communication ready (may be ignored by RedBot)"
      : "Missing Discord configuration",
  });
});

// Test Discord communication endpoint
app.post("/api/discord/test", async (req, res) => {
  try {
    const testCommand = `${COMMAND_PREFIX} status`;
    console.log(`🧪 Testing Discord communication with: ${testCommand}`);

    await sendDiscordCommand(testCommand, false);

    res.json({
      success: true,
      message: "Test command sent successfully",
      command: testCommand,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Discord communication test failed",
      message: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

// Admin endpoints (via Discord commands)
app.get("/api/admin/status", async (req, res) => {
  try {
    const status = await getCompetitionStatus();
    res.json(status);
  } catch (error) {
    console.error("Failed to get admin status:", error.message);
    res.status(500).json({
      error: "Failed to get status from Discord bot",
      message: error.message,
      timestamp: new Date().toISOString(),
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
        team_count: status.team_count,
      },
      timestamp: status.timestamp,
    });
  } catch (error) {
    console.error("Failed to get public status:", error.message);
    res.status(500).json({
      error: "Failed to get status from Discord bot",
      message: error.message,
      timestamp: new Date().toISOString(),
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
          message: `Unknown action: ${action}`,
        });
    }

    // Send command to Discord
    await sendDiscordCommand(command, false);

    // Return success response
    res.json({
      success: true,
      message: successMessage,
      command: command,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("❌ Failed to execute Discord command:", error.message);
    res.status(500).json({
      success: false,
      error: "Failed to send command to Discord bot",
      message: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Discord OAuth redirect URI: ${DISCORD_REDIRECT_URI}`);
});
