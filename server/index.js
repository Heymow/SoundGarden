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
// These endpoints proxy/simulate the bot's CollabWarz API

// Test endpoints
app.get("/api/ping", (req, res) => {
  res.json({ status: "ok", message: "CollabWarz API is running" });
});

app.get("/api/test", (req, res) => {
  res.json({ status: "success", message: "Test endpoint works" });
});

// Admin endpoints (mock for now)
app.get("/api/admin/status", (req, res) => {
  // Mock admin status response
  res.json({
    phase: "submission",
    theme: "Cosmic Dreams",
    automation_enabled: true,
    week_cancelled: false,
    team_count: 0,
    voting_results: {},
    next_phase_change: null,
    timestamp: new Date().toISOString(),
  });
});

// Public endpoints (mock for now)
app.get("/api/public/status", (req, res) => {
  res.json({
    competition: {
      phase: "submission",
      theme: "Cosmic Dreams",
      week_cancelled: false,
      team_count: 0,
    },
    timestamp: new Date().toISOString(),
  });
});

// Admin actions endpoint
app.post("/api/admin/actions", (req, res) => {
  const { action, params, ...directParams } = req.body;

  // Support both formats: { action, params: { ... } } and { action, ... }
  const actionParams = params || directParams;

  console.log(`Admin action received: ${action}`, actionParams);

  // Mock responses for different actions
  switch (action) {
    case "update_theme":
    case "set_theme":
      res.json({
        success: true,
        message: `Theme updated to: ${actionParams.theme}`,
        data: { theme: actionParams.theme },
      });
      break;

    case "next_phase":
      res.json({
        success: true,
        message: "Phase advanced successfully",
        data: { phase: "voting" },
      });
      break;

    case "set_phase":
      res.json({
        success: true,
        message: `Phase changed to: ${actionParams.phase}`,
        data: { phase: actionParams.phase },
      });
      break;

    case "toggle_automation":
      res.json({
        success: true,
        message: `Automation ${actionParams.enabled ? "enabled" : "disabled"}`,
        data: { automation_enabled: actionParams.enabled },
      });
      break;

    case "cancel_week":
      res.json({
        success: true,
        message: "Week cancelled successfully",
        data: { week_cancelled: true },
      });
      break;

    case "reset_week":
      res.json({
        success: true,
        message: "Week reset successfully",
        data: { week_cancelled: false, phase: "submission" },
      });
      break;

    case "force_voting":
      res.json({
        success: true,
        message: "Voting phase started",
        data: { phase: "voting" },
      });
      break;

    case "announce_winners":
      res.json({
        success: true,
        message: "Winners announced successfully",
        data: { phase: "results" },
      });
      break;

    default:
      res.status(400).json({
        success: false,
        message: `Unknown action: ${action}`,
      });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Discord OAuth redirect URI: ${DISCORD_REDIRECT_URI}`);
});
