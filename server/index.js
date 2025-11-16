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

// Bot API Configuration (internal Railway communication)
// Railway services can communicate internally via service names or internal URLs
const BOT_API_URL = process.env.BOT_INTERNAL_URL || "https://worker-production-31cd.up.railway.app";
const BOT_API_TOKEN = process.env.BOT_ADMIN_TOKEN; // JWT token for bot authentication

console.log(`Bot API URL: ${BOT_API_URL}`);

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
// These endpoints communicate with the Discord bot internally

// Helper function to call bot API with authentication
async function callBotAPI(endpoint, options = {}) {
  const url = `${BOT_API_URL}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers
  };

  // Add bot authentication token if available
  if (BOT_API_TOKEN) {
    headers['Authorization'] = `Bearer ${BOT_API_TOKEN}`;
  }

  console.log(`🤖 Calling bot API: ${options.method || 'GET'} ${url}`);

  try {
    const response = await axios({
      url,
      method: options.method || 'GET',
      data: options.data,
      headers,
      timeout: 10000
    });

    console.log(`✅ Bot API response: ${response.status}`);
    return response.data;
  } catch (error) {
    console.error(`❌ Bot API error: ${error.message}`);
    if (error.response) {
      console.error(`Bot response: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
    }
    throw new Error(`Bot API communication failed: ${error.message}`);
  }
}

// Test endpoints
app.get("/api/ping", (req, res) => {
  res.json({ status: "ok", message: "CollabWarz API is running" });
});

app.get("/api/test", (req, res) => {
  res.json({ status: "success", message: "Test endpoint works" });
});

// Admin endpoints (communicating with bot)
app.get("/api/admin/status", async (req, res) => {
  try {
    // Forward auth header to bot
    const botResponse = await callBotAPI('/api/admin/status', {
      headers: {
        'Authorization': req.headers.authorization
      }
    });
    res.json(botResponse);
  } catch (error) {
    console.error('Failed to get admin status from bot:', error.message);
    // Fallback response if bot is unavailable
    res.status(503).json({
      error: 'Bot API unavailable',
      message: 'Cannot connect to Discord bot',
      fallback: true
    });
  }
});

// Public endpoints (communicating with bot)
app.get("/api/public/status", async (req, res) => {
  try {
    const botResponse = await callBotAPI('/api/public/status');
    res.json(botResponse);
  } catch (error) {
    console.error('Failed to get public status from bot:', error.message);
    // Fallback response if bot is unavailable
    res.status(503).json({
      error: 'Bot API unavailable',
      message: 'Cannot connect to Discord bot',
      fallback: true
    });
  }
});

// Admin actions endpoint - communicates with bot
app.post("/api/admin/actions", async (req, res) => {
  try {
    console.log(`🎮 Admin action request:`, req.body);
    
    // Forward the action to the bot with authentication
    const botResponse = await callBotAPI('/api/admin/actions', {
      method: 'POST',
      data: req.body,
      headers: {
        'Authorization': req.headers.authorization
      }
    });

    console.log(`✅ Bot executed action successfully:`, botResponse);
    res.json(botResponse);

  } catch (error) {
    console.error('❌ Failed to execute action via bot:', error.message);
    
    // Return a proper error response
    res.status(500).json({
      success: false,
      error: 'Bot API communication failed',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Discord OAuth redirect URI: ${DISCORD_REDIRECT_URI}`);
});
