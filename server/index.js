import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import axios from "axios";
import { createClient } from "redis";
import pkg from "pg";
const { Pool } = pkg;

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
// Track server start time for uptime
const SERVER_START_TS = Date.now();

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

// Redis Configuration for CollabWarz communication
const REDIS_URL =
  process.env.REDIS_URL ||
  process.env.REDIS_PRIVATE_URL ||
  "redis://localhost:6379";

// Shared secret for cog <-> backend auth (used by collabwarz cog)
const COLLABWARZ_TOKEN = process.env.COLLABWARZ_TOKEN || null;

console.log(`Discord Guild ID: ${DISCORD_GUILD_ID}`);
console.log(`Admin Channel ID: ${DISCORD_ADMIN_CHANNEL_ID}`);
console.log(`Bot Token configured: ${DISCORD_BOT_TOKEN ? "Yes" : "No"}`);
if (DISCORD_BOT_TOKEN && /^Bot\s+/i.test(DISCORD_BOT_TOKEN)) {
  console.warn(
    '⚠️ DISCORD_BOT_TOKEN contains a leading "Bot " prefix; this will be normalized by the server. Consider removing it from the environment variable.'
  );
}
if (DISCORD_BOT_TOKEN && /\s/.test(DISCORD_BOT_TOKEN.trim())) {
  console.warn(
    "⚠️ DISCORD_BOT_TOKEN contains whitespace characters. Trim your token or check your environment configuration."
  );
}
console.log(`Webhook URL configured: ${DISCORD_WEBHOOK_URL ? "Yes" : "No"}`);
console.log(`Command Prefix: ${COMMAND_PREFIX}`);
console.log(`Redis URL: ${REDIS_URL}`);
console.log(`CollabWarz Token configured: ${COLLABWARZ_TOKEN ? "Yes" : "No"}`);

// Normalize bot token usage - strip leading 'Bot ' or 'Bearer ' if present
function getBotAuthToken() {
  if (!DISCORD_BOT_TOKEN) return null;
  return DISCORD_BOT_TOKEN.trim()
    .replace(/^Bot\s+/i, "")
    .replace(/^Bearer\s+/i, "");
}
function getBotAuthHeader() {
  const t = getBotAuthToken();
  if (!t) return null;
  return `Bot ${t}`;
}

// Helper to format duration in a human readable way
function formatDuration(seconds) {
  const days = Math.floor(seconds / (60 * 60 * 24));
  const hours = Math.floor((seconds % (60 * 60 * 24)) / (60 * 60));
  const minutes = Math.floor((seconds % (60 * 60)) / 60);
  const secs = Math.floor(seconds % 60);
  const parts = [];
  if (days) parts.push(`${days} day${days !== 1 ? "s" : ""}`);
  if (hours) parts.push(`${hours} hour${hours !== 1 ? "s" : ""}`);
  if (minutes) parts.push(`${minutes} minute${minutes !== 1 ? "s" : ""}`);
  if (parts.length === 0) {
    return `${secs} second${secs !== 1 ? "s" : ""}`;
  }
  return parts.join(", ");
}

// Redis client and initialization
let redisClient;
let pgPool = null;

async function initPostgres() {
  const DATABASE_URL =
    process.env.DATABASE_URL || process.env.POSTGRES_URL || null;
  if (!DATABASE_URL) {
    console.log(
      "⚠️  No DATABASE_URL configured - Postgres persistence disabled"
    );
    return false;
  }

  try {
    const dbNeedsSsl =
      process.env.NODE_ENV === "production" ||
      process.env.POSTGRES_SSL === "true" ||
      (DATABASE_URL && DATABASE_URL.indexOf("sslmode=require") !== -1);
    const sslOpt = dbNeedsSsl ? { rejectUnauthorized: false } : false;
    pgPool = new Pool({ connectionString: DATABASE_URL, ssl: sslOpt });
    await pgPool.query("SELECT 1");
    console.log("✅ Postgres connected");
    try {
      console.log(
        "ℹ️ Postgres URL (masked):",
        DATABASE_URL.replace(/(postgres:\/\/.*@)(.*)$/, "$1*****")
      );
    } catch (e) {}

    // Ensure backups table exists
    const createBackups = `
      CREATE TABLE IF NOT EXISTS backups (
        id SERIAL PRIMARY KEY,
        guild_id BIGINT NOT NULL,
        file_name TEXT NOT NULL,
        backup_content JSONB NOT NULL,
        size BIGINT DEFAULT 0,
        created_by_user_id BIGINT,
        created_by_display TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `;
    await pgPool.query(createBackups);
    console.log("✅ Backups table ensured");
    return true;
  } catch (err) {
    console.error(
      "❌ Failed to initialize Postgres:",
      err.stack || err.message || err
    );
    pgPool = null;
    return false;
  }
}

async function saveBackupToDb(guildId, fileName, backupJson) {
  if (!pgPool) return false;
  try {
    const text = `INSERT INTO backups (guild_id, file_name, backup_content, size, created_by_user_id, created_by_display, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`;
    const size = Buffer.byteLength(JSON.stringify(backupJson));
    const createdBy =
      backupJson.created_by && backupJson.created_by.user_id
        ? backupJson.created_by.user_id
        : null;
    const createdByName =
      backupJson.created_by && backupJson.created_by.display_name
        ? backupJson.created_by.display_name
        : null;
    const createdAt = backupJson.timestamp
      ? new Date(backupJson.timestamp)
      : new Date();
    const values = [
      guildId,
      fileName,
      backupJson,
      size,
      createdBy,
      createdByName,
      createdAt,
    ];
    // Avoid duplicates: insert only if file_name for guild not present
    const exists = await pgPool.query(
      "SELECT 1 FROM backups WHERE guild_id=$1 AND file_name=$2 LIMIT 1",
      [guildId, fileName]
    );
    if (exists.rowCount === 0) {
      await pgPool.query(text, values);
    } else {
      // Optionally update to latest content
      await pgPool.query(
        "UPDATE backups SET backup_content=$1, size=$2, created_by_user_id=$3, created_by_display=$4, created_at=$5 WHERE guild_id=$6 AND file_name=$7",
        [
          backupJson,
          size,
          createdBy,
          createdByName,
          createdAt,
          guildId,
          fileName,
        ]
      );
    }
    return true;
  } catch (err) {
    console.error("❌ Failed to save backup to DB:", err.message || err);
    return false;
  }
}

async function listBackupsFromDb(guildId) {
  if (!pgPool) return [];
  try {
    const res = await pgPool.query(
      "SELECT file_name, size, created_by_user_id, created_by_display, created_at FROM backups WHERE guild_id=$1 ORDER BY created_at DESC",
      [guildId]
    );
    return res.rows.map((r) => ({
      file: r.file_name,
      size: parseInt(r.size, 10) || 0,
      ts: r.created_at.toISOString(),
      created_by: r.created_by_user_id
        ? { user_id: r.created_by_user_id, display_name: r.created_by_display }
        : null,
    }));
  } catch (err) {
    console.error("❌ Failed to list backups from DB:", err.message || err);
    return [];
  }
}

/**
 * Scan Redis for action-result keys and persist any backups found into Postgres
 * Useful when action-result arrives in Redis instead of HTTP.
 */
async function scanAndPersistBackupsFromRedis(guildId, limit = 200) {
  if (!pgPool || !redisClient) return 0;
  let persisted = 0;
  try {
    // Use scanIterator for efficiency
    const iterator = redisClient.scanIterator({
      MATCH: "collabwarz:action:*",
      COUNT: 100,
    });
    for await (const key of iterator) {
      try {
        const raw = await redisClient.get(key);
        if (!raw) continue;
        const parsed = JSON.parse(raw);
        const details = parsed.details || parsed.result || null;
        const maybeBackup =
          (details && details.backup) ||
          (details && details.result && details.result.backup);
        const maybeFile =
          (details && details.backup_file) ||
          (details && details.result && details.result.backup_file);
        if (maybeBackup && maybeFile) {
          const bid = maybeBackup.guild_id || guildId;
          if (!bid) continue;
          await saveBackupToDb(Number(bid), maybeFile, maybeBackup);
          persisted++;
          if (persisted >= limit) break;
        }
      } catch (err) {
        console.warn("⚠️ Error scanning action key", key, err.message || err);
        continue;
      }
    }
  } catch (err) {
    console.error(
      "❌ Failed to scan/persist backups from Redis:",
      err.message || err
    );
  }
  return persisted;
}

/**
 * Scan Redis for backup entries and return list without persisting to DB.
 * This allows the admin UI to show backups even when Postgres isn't configured.
 */
async function listBackupsFromRedis(guildId, limit = 200) {
  if (!redisClient) return [];
  const files = [];
  try {
    const iterator = redisClient.scanIterator({
      MATCH: "collabwarz:action:*",
      COUNT: 100,
    });
    for await (const key of iterator) {
      try {
        const raw = await redisClient.get(key);
        if (!raw) continue;
        const parsed = JSON.parse(raw);
        const details = parsed.details || parsed.result || null;
        const maybeBackup =
          (details && details.backup) ||
          (details && details.result && details.result.backup);
        const maybeFile =
          (details && details.backup_file) ||
          (details && details.result && details.result.backup_file);
        if (maybeBackup && maybeFile) {
          const bid = maybeBackup.guild_id || guildId;
          if (!bid || String(bid) !== String(guildId)) continue;
          files.push({
            file: maybeFile,
            size: Buffer.byteLength(JSON.stringify(maybeBackup)),
            ts:
              maybeBackup.timestamp ||
              parsed.processed_at ||
              parsed.created_at ||
              new Date().toISOString(),
            created_by: maybeBackup.created_by || null,
          });
          if (files.length >= limit) break;
        }
      } catch (err) {
        console.warn("⚠️ Error scanning action key", key, err.message || err);
      }
    }
  } catch (err) {
    console.error("❌ Failed to scan backups from Redis:", err.message || err);
  }
  // Sort by timestamp desc
  files.sort((a, b) => new Date(b.ts) - new Date(a.ts));
  return files;
}

async function getBackupFromRedis(guildId, fileName) {
  if (!redisClient) return null;
  try {
    const iterator = redisClient.scanIterator({
      MATCH: "collabwarz:action:*",
      COUNT: 100,
    });
    for await (const key of iterator) {
      try {
        const raw = await redisClient.get(key);
        if (!raw) continue;
        const parsed = JSON.parse(raw);
        const details = parsed.details || parsed.result || null;
        const maybeBackup =
          (details && details.backup) ||
          (details && details.result && details.result.backup);
        const maybeFile =
          (details && details.backup_file) ||
          (details && details.result && details.result.backup_file);
        if (maybeBackup && maybeFile && maybeFile === fileName) {
          const bid = maybeBackup.guild_id || guildId;
          if (!bid || String(bid) !== String(guildId)) continue;
          return maybeBackup;
        }
      } catch (err) {
        continue;
      }
    }
  } catch (err) {
    console.error(
      "❌ Failed to scan/pull backup from Redis:",
      err.message || err
    );
  }
  return null;
}

async function getBackupFromDb(guildId, fileName) {
  if (!pgPool) return null;
  try {
    const res = await pgPool.query(
      "SELECT backup_content FROM backups WHERE guild_id=$1 AND file_name=$2 LIMIT 1",
      [guildId, fileName]
    );
    if (res.rowCount === 0) return null;
    return res.rows[0].backup_content;
  } catch (err) {
    console.error("❌ Failed to fetch backup from DB:", err.message || err);
    return null;
  }
}
// In-memory queue fallback when Redis not configured (useful for local testing)
const inMemoryQueue = [];
const inMemoryProcessed = {}; // store processed action results when Redis is not configured
// Last known status from backend/cog when Redis not available
let inMemoryStatus = null;
// Status post logs for debugging: record recent POST attempts
const statusPostLogs = [];
// Competition logs for admin panel
const competitionLogs = [];
function pushStatusLog(entry) {
  try {
    entry.ts = new Date().toISOString();
    statusPostLogs.push(entry);
    if (statusPostLogs.length > 200) statusPostLogs.shift();
  } catch (e) {
    // ignore errors in logging
  }
}
function pushCompetitionLog(entry) {
  try {
    entry.ts = new Date().toISOString();
    competitionLogs.push(entry);
    if (competitionLogs.length > 200) competitionLogs.shift();
  } catch (e) {
    // ignore errors in logging
  }
}

async function initRedis() {
  if (!REDIS_URL || REDIS_URL === "redis://localhost:6379") {
    console.log(
      "⚠️  No Redis URL configured or using localhost - Redis communication disabled"
    );
    return false;
  }

  try {
    redisClient = createClient({
      url: REDIS_URL,
      retry_unfulfilled_commands: true,
      socket: {
        reconnectStrategy: (retries) => Math.min(retries * 50, 500),
      },
    });

    redisClient.on("error", (err) => {
      console.error("❌ Redis Client Error:", err);
    });

    redisClient.on("connect", () => {
      console.log("🔄 Redis Client Connecting...");
    });

    redisClient.on("ready", () => {
      console.log("✅ Redis Client Connected and Ready");
    });

    await redisClient.connect();

    // Test the connection
    await redisClient.ping();
    console.log("🏓 Redis connection verified");
    // If we had a recent status stored in memory, write it to Redis now
    if (inMemoryStatus) {
      try {
        await redisClient.set(
          "collabwarz:status",
          JSON.stringify(inMemoryStatus)
        );
        console.log("ℹ️  Rehydrated collabwarz:status from in-memory status");
      } catch (err) {
        console.warn(
          "⚠️ Failed to rehydrate in-memory status to Redis",
          err.message || err
        );
      }
    }

    return true;
  } catch (error) {
    console.error("❌ Failed to connect to Redis:", error.message);
    redisClient = null;
    return false;
  }
}

app.use(
  cors({
    origin: FRONTEND_URL,
    credentials: true,
  })
);
app.use(express.json());

// Helper: Resolve a channel name (e.g., 'general' or '#general') to a Discord channel ID if possible
async function resolveChannelNameToId(raw) {
  try {
    if (!raw) return null;
    // Support <#12345> or numeric IDs directly
    const idMatch = String(raw)
      .trim()
      .match(/^<#!?(\d+)>$|^(\d+)$/);
    if (idMatch) {
      return Number(idMatch[1] || idMatch[2]);
    }
    // Strip leading # if present, then resolve by name using Discord API
    const name = String(raw).trim().replace(/^#/, "");
    if (!DISCORD_BOT_TOKEN || !DISCORD_GUILD_ID) return null;
    const url = `https://discord.com/api/v10/guilds/${DISCORD_GUILD_ID}/channels`;
    const resp = await axios.get(url, {
      headers: { Authorization: getBotAuthHeader() },
      timeout: 5000,
    });
    if (resp && Array.isArray(resp.data)) {
      const found = resp.data.find(
        (c) => String(c.name).toLowerCase() === String(name).toLowerCase()
      );
      if (found) return Number(found.id);
    }
    if (resp && Array.isArray(resp.data)) {
      const found = resp.data.find(
        (c) => String(c.name).toLowerCase() === String(name).toLowerCase()
      );
      if (found) return Number(found.id);
    }
  } catch (e) {
    console.warn("⚠️ resolveChannelNameToId failed:", e.message || e);
    return null;
  }
  return null;
}

// Helper: Resolve a channel ID to a display name if possible (e.g., '#general')
async function resolveChannelIdToName(id) {
  try {
    if (!id) return null;
    if (!DISCORD_BOT_TOKEN || !DISCORD_GUILD_ID) return null;
    const url = `https://discord.com/api/v10/guilds/${DISCORD_GUILD_ID}/channels`;
    const resp = await axios.get(url, {
      headers: { Authorization: getBotAuthHeader() },
      timeout: 5000,
    });
    if (resp && Array.isArray(resp.data)) {
      const found = resp.data.find((c) => String(c.id) === String(id));
      if (found) return `#${found.name}`;
    }
    if (resp && Array.isArray(resp.data)) {
      const found = resp.data.find((c) => String(c.id) === String(id));
      if (found) return `#${found.name}`;
    }
  } catch (e) {
    console.warn("⚠️ resolveChannelIdToName failed:", e.message || e);
    return null;
  }
  return null;
}

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
// These endpoints communicate with CollabWarz cog via Redis

// Helper function to queue an action for the cog to process
async function queueCollabWarzAction(action, params = {}) {
  console.log(`📝 Queuing CollabWarz action: ${action}`, params);
  if (!redisClient) {
    console.log(
      "⚠️  Redis not available - action would be queued:",
      action,
      params
    );
    const actionData = {
      id: `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      action: action,
      params: params,
      timestamp: new Date().toISOString(),
      status: "pending",
    };
    inMemoryQueue.push(actionData);
    console.log(`ℹ️  Action queued in-memory: ${actionData.id}`);
    return actionData;
  }

  try {
    const actionData = {
      id: `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      action: action,
      params: params,
      timestamp: new Date().toISOString(),
      status: "pending",
    };

    // Add to Redis queue
    await redisClient.lPush("collabwarz:actions", JSON.stringify(actionData));

    console.log(`✅ Action queued successfully: ${actionData.id}`);
    return actionData;
  } catch (error) {
    console.error("❌ Failed to queue action:", error.message);
    throw error;
  }
}

// Helper function to get competition status from Redis
async function getCompetitionStatusFromRedis() {
  if (!redisClient) {
    console.log(
      "⚠️  Redis not available - returning in-memory status (if available)"
    );
    if (inMemoryStatus) return inMemoryStatus;
    return {
      phase: "unknown",
      theme: "Redis not available",
      automation_enabled: false,
      week_cancelled: false,
      team_count: 0,
      error: "Redis not configured",
      timestamp: new Date().toISOString(),
    };
  }

  try {
    // Get current status from Redis (set by the cog)
    const statusData = await redisClient.get("collabwarz:status");

    if (statusData) {
      const st = JSON.parse(statusData);
      // Expose common settings as top-level for UI convenience (backwards-compat)
      st.safe_mode_enabled =
        st.safe_mode_enabled ||
        (st.settings && st.settings.safe_mode_enabled) ||
        false;
      // In the past, some UIs read `guild_id` and `guild_name` from top-level - ensure availability
      if (!st.guild_id && st.guildId) st.guild_id = st.guildId;
      return st;
    }

    // Return fallback data if no status available
    return {
      phase: "unknown",
      theme: "Not available",
      automation_enabled: false,
      week_cancelled: false,
      team_count: 0,
      error: "No status data available",
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error("❌ Failed to get status from Redis:", error.message);
    return {
      phase: "error",
      theme: "Redis error",
      automation_enabled: false,
      week_cancelled: false,
      team_count: 0,
      error: error.message,
      timestamp: new Date().toISOString(),
    };
  }
}

// Endpoint to accept status updates from collabwarz cog (backend mode)
app.post("/api/collabwarz/status", async (req, res) => {
  try {
    const auth = validateCogAuth(req, res);
    if (!auth.ok) {
      return res.status(401).json({ success: false, message: auth.message });
    }

    const payload = req.body || {};
    if (!payload || !payload.phase) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid status payload" });
    }

    // Try to store in redis; fall back to in-memory
    let storedIn = null;
    try {
      if (redisClient) {
        await redisClient.set("collabwarz:status", JSON.stringify(payload));
        storedIn = "redis";
      } else {
        payload.last_received = new Date().toISOString();
        inMemoryStatus = payload;
        storedIn = "in-memory";
      }
    } catch (err) {
      payload.last_received = new Date().toISOString();
      inMemoryStatus = payload;
      storedIn = `redis-fallback: ${err.message}`;
    }

    pushStatusLog({
      result: "stored",
      storedIn,
      phase: payload.phase || null,
      theme: payload.theme || null,
      guild_id: payload.guild_id || null,
    });

    console.log(
      `/api/collabwarz/status received: ${
        payload.phase || "(no phase)"
      } @ ${new Date().toISOString()} (storedIn=${storedIn})`
    );

    return res.json({ success: true, storedIn });
  } catch (error) {
    console.error("/api/collabwarz/status failed:", error.message || error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// Admin-only: Retrieve recent status POST logs (in-memory)
app.get("/api/admin/status-log", verifyAdminAuth, async (req, res) => {
  try {
    // Return the last 100 entries
    return res.json({ success: true, logs: statusPostLogs.slice(-100) });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// Admin-only: Receive competition logs from cog
// Admin-only: Receive competition logs from admin web UI
app.post("/api/admin/log", verifyAdminAuth, (req, res) => {
  try {
    pushCompetitionLog(req.body);
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// Cog-only: Receive competition logs from the CollabWarz cog (validated with X-CW-Token header)
app.post("/api/collabwarz/log", (req, res) => {
  try {
    const auth = validateCogAuth(req, res);
    // For better diagnostics: record header presence and masked token values if auth fails
    if (!auth.ok) {
      const tokenHeader =
        req.header("x-cw-token") || req.header("X-CW-Token") || null;
      const authHeader =
        req.header("Authorization") || req.header("authorization") || null;
      // Mask token values for logs (do not print full tokens)
      const mask = (t) => {
        if (!t) return null;
        try {
          if (t.length <= 8) return "****";
          return `${t.substring(0, 6)}...${t.substring(t.length - 4)}`;
        } catch (e) {
          return "****";
        }
      };
      pushStatusLog({
        result: "auth_failed",
        headerPresent: !!tokenHeader,
        authHeaderPresent: !!authHeader,
        tokenMask: mask(tokenHeader),
        authMask: mask(authHeader ? authHeader.replace(/Bearer /i, "") : null),
        ip: req.ip || req.headers["x-forwarded-for"] || null,
        reason: auth.message,
      });
      console.warn(
        `/api/collabwarz/log auth failed: headerPresent=${!!tokenHeader} authHeaderPresent=${!!authHeader} reason=${
          auth.message
        }`
      );
      return res.status(401).json({ success: false, message: auth.message });
    }
    // Push to in-memory competition logs and print an audit message
    pushCompetitionLog(req.body);
    console.log(
      `🔔 Competition log received from cog: ${
        req.body.message || "(no message)"
      } (guild=${req.body.guild_name || req.body.guild_id || "N/A"})`
    );
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// Admin-only: Retrieve recent competition logs
app.get("/api/admin/competition-logs", verifyAdminAuth, async (req, res) => {
  try {
    // Return the last 100 entries
    return res.json({ success: true, logs: competitionLogs.slice(-100) });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

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
  console.log(
    `🔑 Using bot token: ${
      getBotAuthToken() ? getBotAuthToken().substring(0, 20) : "<none>"
    }...`
  );

  try {
    const response = await axios.post(
      url,
      {
        content: command,
      },
      {
        headers: {
          Authorization: getBotAuthHeader(),
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
        Authorization: getBotAuthHeader(),
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

// Admin endpoints (via Redis communication)
app.get("/api/admin/status", verifyAdminAuth, async (req, res) => {
  try {
    const status = await getCompetitionStatusFromRedis();
    res.json(status);
  } catch (error) {
    console.error("Failed to get admin status from Redis:", error.message);
    res.status(500).json({
      error: "Failed to get status from Redis",
      message: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

// Admin: Get current guild config (read from Redis status)
app.get("/api/admin/config", verifyAdminAuth, async (req, res) => {
  try {
    let cfg = {};
    try {
      const statusRaw = redisClient
        ? await redisClient.get("collabwarz:status")
        : inMemoryStatus
        ? JSON.stringify(inMemoryStatus)
        : null;
      if (statusRaw) {
        const st = JSON.parse(statusRaw);
        // Provide a useful subset of config to the admin UI
        cfg = {
          announcement_channel:
            st.announcement_channel || st.announcementChannel || null,
          submission_channel:
            st.submission_channel || st.submissionChannel || null,
          test_channel: st.test_channel || st.testChannel || null,
          auto_announce:
            typeof st.automation_enabled !== "undefined"
              ? st.automation_enabled
              : st.auto_announce || false,
          require_confirmation:
            typeof st.require_confirmation !== "undefined"
              ? st.require_confirmation
              : st.settings &&
                typeof st.settings.require_confirmation !== "undefined"
              ? st.settings.require_confirmation
              : st.requireConfirmation || false,
          safe_mode_enabled:
            typeof st.safe_mode_enabled !== "undefined"
              ? st.safe_mode_enabled
              : st.safeModeEnabled || false,
          api_server_enabled: !!st.api_server_enabled,
          api_server_port: st.api_server_port || st.api_server_port || null,
          use_everyone_ping: !!st.use_everyone_ping,
          min_teams_required:
            st.min_teams_required || st.min_teams_required || null,
        };
        // If we have numeric channel IDs, resolve them to friendly names where possible
        try {
          for (const ck of [
            "announcement_channel",
            "submission_channel",
            "test_channel",
          ]) {
            if (cfg[ck] && String(cfg[ck]).match(/^\d+$/)) {
              const name = await resolveChannelIdToName(cfg[ck]);
              if (name) cfg[`${ck}_display`] = `${name} (${cfg[ck]})`;
            }
          }
        } catch (e) {
          // ignore resolution failures
        }
      }
    } catch (e) {
      // ignore
    }
    return res.json({ success: true, config: cfg });
  } catch (err) {
    console.error("/api/admin/config error:", err.message || err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// Admin: Update guild config (queued action for cog)
app.post("/api/admin/config", verifyAdminAuth, async (req, res) => {
  try {
    const updates = (req.body && req.body.updates) || req.body || {};
    if (!updates || Object.keys(updates).length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "No updates provided" });
    }
    // Sanitize: allow only a safe subset of keys
    const allowed = new Set([
      "announcement_channel",
      "submission_channel",
      "test_channel",
      "auto_announce",
      "require_confirmation",
      "safe_mode_enabled",
      "api_server_enabled",
      "api_server_port",
      "use_everyone_ping",
      "min_teams_required",
    ]);
    const clean = {};
    Object.keys(updates).forEach((k) => {
      if (allowed.has(k)) clean[k] = updates[k];
    });
    if (Object.keys(clean).length === 0)
      return res
        .status(400)
        .json({ success: false, message: "No allowed keys to update" });

    // Normalize channel refs (#name, <#id>, id) if server has permissions
    try {
      for (const chanKey of [
        "announcement_channel",
        "submission_channel",
        "test_channel",
      ]) {
        if (clean[chanKey]) {
          const resolved = await resolveChannelNameToId(clean[chanKey]);
          if (resolved) {
            console.log(
              `🔁 /api/admin/config: Resolved ${chanKey} '${String(
                updates[chanKey]
              )}' -> ${resolved}`
            );
            clean[chanKey] = resolved;
          }
        }
      }
      // Convert numeric strings/boolean strings to correct types
      if (
        typeof clean.api_server_port !== "undefined" &&
        clean.api_server_port !== null &&
        clean.api_server_port !== ""
      ) {
        const v = parseInt(clean.api_server_port, 10);
        if (!isNaN(v)) clean.api_server_port = v;
      }
      if (
        typeof clean.min_teams_required !== "undefined" &&
        clean.min_teams_required !== null &&
        clean.min_teams_required !== ""
      ) {
        const v = parseInt(clean.min_teams_required, 10);
        if (!isNaN(v)) clean.min_teams_required = v;
      }
      for (const boolKey of [
        "auto_announce",
        "require_confirmation",
        "safe_mode_enabled",
        "api_server_enabled",
        "use_everyone_ping",
      ]) {
        if (typeof clean[boolKey] === "string") {
          const v = clean[boolKey].toLowerCase();
          clean[boolKey] = v === "true" || v === "1" || v === "yes";
        }
      }
    } catch (e) {
      console.warn("⚠️ Normalization for config values failed", e.message || e);
    }

    console.log("/api/admin/config: queueing updates", clean);
    const actionData = await queueCollabWarzAction("update_config", {
      updates: clean,
    });
    return res.json({ success: true, actionId: actionData.id });
  } catch (err) {
    console.error("/api/admin/config POST error:", err.message || err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// Admin: return list of guild channels (for dropdowns)
app.get("/api/admin/channels", verifyAdminAuth, async (req, res) => {
  try {
    if (!DISCORD_BOT_TOKEN || !DISCORD_GUILD_ID) {
      const msg =
        "Server not configured to fetch Discord channels: DISCORD_BOT_TOKEN and/or DISCORD_GUILD_ID not set";
      console.warn("/api/admin/channels: " + msg);
      return res.status(400).json({ success: false, message: msg });
    }
    const url = `https://discord.com/api/v10/guilds/${DISCORD_GUILD_ID}/channels`;
    const resp = await axios.get(url, {
      headers: { Authorization: getBotAuthHeader() },
      timeout: 5000,
    });
    if (!resp || !Array.isArray(resp.data))
      return res.json({ success: true, channels: [] });
    // Filter to text channels (type === 0)
    const channels = resp.data
      .filter((c) => c.type === 0)
      .map((c) => ({ id: c.id, name: c.name, display: `#${c.name}` }))
      .sort((a, b) => a.name.localeCompare(b.name));
    console.log(
      `/api/admin/channels fetched ${channels.length} text channels for guild ${DISCORD_GUILD_ID}`
    );
    return res.json({ success: true, channels });
  } catch (err) {
    console.error(
      "/api/admin/channels error:",
      (err.response && err.response.status) || err.message || err
    );
    let msg =
      err.message || "Unknown error when fetching channels from Discord";
    if (err.response && err.response.status) {
      const status = err.response.status;
      if (status === 401)
        msg = "Invalid Discord bot token. Check DISCORD_BOT_TOKEN";
      else if (status === 403)
        msg =
          "Discord API forbidden (403). Bot may lack permissions or be banned from guild";
      else if (status === 404)
        msg = "Guild not found (404). Check DISCORD_GUILD_ID";
      else if (err.response.data && err.response.data.message)
        msg = `${status}: ${err.response.data.message}`;
    }
    return res
      .status(err.response?.status || 500)
      .json({ success: false, message: msg });
  }
});

// Admin system diagnostics endpoint
app.get("/api/admin/system", verifyAdminAuth, async (req, res) => {
  try {
    const redisConnected = !!redisClient && redisClient.isOpen === true;
    let queueLength = 0;
    let lastStatusTimestamp = null;
    let backendMode = false;

    if (redisConnected) {
      queueLength = await redisClient.lLen("collabwarz:actions");
      try {
        const statusRaw = await redisClient.get("collabwarz:status");
        if (statusRaw) {
          const st = JSON.parse(statusRaw);
          lastStatusTimestamp = st.last_updated || st.timestamp || null;
        }
      } catch (e) {
        // ignore parse errors
      }
    } else {
      queueLength = inMemoryQueue.length;
      if (inMemoryStatus)
        lastStatusTimestamp =
          inMemoryStatus.last_updated || inMemoryStatus.timestamp || null;
      backendMode = !!inMemoryStatus; // if we have in-memory status, likely backend mode
    }

    // Optionally gather a couple of dynamic values: cog version from status and guild info
    let cogVersion = null;
    let cogUptimeReadable = null;
    let cogUptimeSeconds = null;
    let statusFromCog = null;
    try {
      const st = await getCompetitionStatusFromRedis();
      statusFromCog = st || null;
      if (st && st.cog_version) cogVersion = st.cog_version;
      if (st && typeof st.cog_uptime_seconds === "number") {
        cogUptimeSeconds = st.cog_uptime_seconds;
        cogUptimeReadable = formatDuration(cogUptimeSeconds);
      }
    } catch (e) {}
    let guildInfo = null;
    try {
      if (DISCORD_BOT_TOKEN && DISCORD_GUILD_ID) {
        const url = `https://discord.com/api/v10/guilds/${DISCORD_GUILD_ID}?with_counts=true`;
        const resGuild = await axios.get(url, {
          headers: { Authorization: getBotAuthHeader() },
          timeout: 3000,
        });
        if (resGuild && resGuild.data) {
          guildInfo = {
            id: resGuild.data.id,
            name: resGuild.data.name,
            member_count:
              resGuild.data.approximate_member_count ||
              resGuild.data.member_count ||
              null,
          };
        }
      }
    } catch (e) {
      // ignore; do not fail the diagnostics for Discord API failures
      guildInfo = null;
    }

    const uptimeSeconds = Math.floor((Date.now() - SERVER_START_TS) / 1000);
    // If Discord API info missing, use data from Redis status (if cog published)
    if (!guildInfo && statusFromCog) {
      try {
        if (
          statusFromCog.guild_id ||
          statusFromCog.guildName ||
          statusFromCog.guild_name
        ) {
          guildInfo = {
            id: statusFromCog.guild_id || statusFromCog.guildId || null,
            name: statusFromCog.guild_name || statusFromCog.guildName || null,
            member_count:
              statusFromCog.guild_member_count ||
              statusFromCog.member_count ||
              null,
          };
        }
      } catch (e) {}
    }

    const diagnostics = {
      redisConnected,
      redisUrl: REDIS_URL || null,
      queueLength,
      inMemoryQueue: inMemoryQueue.length,
      lastStatusTimestamp,
      backendMode,
      collabwarzTokenConfigured: !!COLLABWARZ_TOKEN,
      discordBotTokenConfigured: !!DISCORD_BOT_TOKEN,
      discordAdminChannelSet: !!DISCORD_ADMIN_CHANNEL_ID,
      discordWebhookSet: !!DISCORD_WEBHOOK_URL,
      postgresConnected: !!pgPool,
      postgresUrl: process.env.DATABASE_URL
        ? process.env.DATABASE_URL.replace(
            /(postgres:\/\/.*:@)(.*)$/,
            "$1*****"
          )
        : null,
      commandPrefix: COMMAND_PREFIX,
      serverStart: new Date(SERVER_START_TS).toISOString(),
      serverUptimeSeconds: uptimeSeconds,
      serverUptimeReadable: formatDuration(uptimeSeconds),
      cogVersion: cogVersion,
      cogUptimeSeconds: cogUptimeSeconds,
      cogUptimeReadable: cogUptimeReadable,
      guildInfo: guildInfo,
      cliTimestamp: new Date().toISOString(),
    };

    res.json({ success: true, diagnostics });
  } catch (error) {
    console.error("❌ /api/admin/system error:", error.message || error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Admin debug: test the configured bot token by querying Discord's users/@me
app.get("/api/admin/debug/token", verifyAdminAuth, async (req, res) => {
  try {
    if (!DISCORD_BOT_TOKEN)
      return res
        .status(400)
        .json({ success: false, message: "DISCORD_BOT_TOKEN not configured" });
    const url = "https://discord.com/api/v10/users/@me";
    const response = await axios.get(url, {
      headers: { Authorization: getBotAuthHeader() },
      timeout: 5000,
    });
    return res.json({
      success: true,
      status: response.status,
      data: response.data,
    });
  } catch (err) {
    console.error(
      "/api/admin/debug/token error:",
      err.response
        ? { status: err.response.status, data: err.response.data }
        : err.message || err
    );
    let msg = err.message || "Failed to validate token";
    if (err.response && err.response.status) {
      if (err.response.status === 401) msg = "Invalid token (401)";
      else if (err.response.status === 403)
        msg = "Forbidden (403) - bot may lack permissions";
      else if (err.response.status === 404)
        msg = "Not found (404) - possibly wrong token or API route";
      else if (err.response.data && err.response.data.message)
        msg = `${err.response.status}: ${err.response.data.message}`;
    }
    return res.status(err.response?.status || 500).json({
      success: false,
      message: msg,
      details: err.response?.data || null,
    });
  }
});

// Simple middleware for cog auth
// The cog posts logs and action results using a header 'X-CW-Token' with a shared secret
// The server validates the header against the `COLLABWARZ_TOKEN` env var to avoid unauthorized postings.
function validateCogAuth(req, res) {
  // Accept either 'X-CW-Token' header (preferred) OR an Authorization: Bearer token.
  const header = req.header("x-cw-token") || req.header("X-CW-Token");
  const authHeader = req.header("Authorization") || req.header("authorization");
  let bearer = null;
  if (authHeader) {
    try {
      const parts = authHeader.split(" ");
      if (parts.length === 2 && parts[0].toLowerCase() === "bearer") {
        bearer = parts[1];
      }
    } catch (e) {
      bearer = null;
    }
  }

  if (!COLLABWARZ_TOKEN) {
    // If not configured, reject to avoid accidental exposure
    return {
      ok: false,
      message: "Server not configured with COLLABWARZ_TOKEN",
    };
  }

  // If the token matches either header or bearer token, accept
  if (header && header === COLLABWARZ_TOKEN) return { ok: true };
  if (bearer && bearer === COLLABWARZ_TOKEN) return { ok: true };

  return {
    ok: false,
    message: "Invalid or missing X-CW-Token / Authorization bearer token",
  };
}

// Admin auth validation: uses Discord OAuth access token in Authorization header
// If DISCORD_ADMIN_IDS env var is set, only those user IDs are allowed.
const DISCORD_ADMIN_IDS = process.env.DISCORD_ADMIN_IDS
  ? process.env.DISCORD_ADMIN_IDS.split(",").map((s) => s.trim())
  : null;

async function verifyAdminAuth(req, res, next) {
  const authHeader = req.header("Authorization");
  if (!authHeader)
    return res.status(401).json({ error: "Missing Authorization header" });
  const [scheme, token] = authHeader.split(" ");
  if (!token || scheme.toLowerCase() !== "bearer")
    return res.status(401).json({ error: "Invalid Authorization scheme" });

  // If no admin IDs are configured, allow all (dev mode)
  if (!DISCORD_ADMIN_IDS || DISCORD_ADMIN_IDS.length === 0) {
    req.admin_user = { token };
    return next();
  }

  try {
    // Validate the bearer token via Discord API to get the user ID
    const discordRes = await axios.get("https://discord.com/api/users/@me", {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 5000,
    });
    const user = discordRes.data;
    if (!user || !user.id)
      return res.status(403).json({ error: "Invalid token" });
    if (!DISCORD_ADMIN_IDS.includes(user.id))
      return res.status(403).json({ error: "Forbidden: not an admin" });
    req.admin_user = user;
    return next();
  } catch (error) {
    console.error("❌ verifyAdminAuth error", error.message || error);
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

// Endpoint used by the cog to poll for the next action
app.get("/api/collabwarz/next-action", async (req, res) => {
  try {
    const auth = validateCogAuth(req, res);
    if (!auth.ok) {
      return res.status(401).json({ success: false, message: auth.message });
    }

    if (!redisClient) {
      // If Redis not configured, fall back to the in-memory queue
      if (inMemoryQueue.length === 0) return res.status(204).send();
      const actionData = inMemoryQueue.shift();
      return res.json({ success: true, action: actionData });
    }

    const actionString = await redisClient.rPop("collabwarz:actions");
    if (!actionString) {
      return res.status(204).send();
    }

    const actionData = JSON.parse(actionString);
    return res.json({ success: true, action: actionData });
  } catch (error) {
    console.error("❌ /api/collabwarz/next-action error:", error.message);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// Endpoint used by the cog to post processing results
app.post("/api/collabwarz/action-result", async (req, res) => {
  try {
    const auth = validateCogAuth(req, res);
    if (!auth.ok) {
      return res.status(401).json({ success: false, message: auth.message });
    }

    const { id, status, details } = req.body || {};
    if (!id || !status) {
      return res
        .status(400)
        .json({ success: false, message: "id and status are required" });
    }

    const resultData = {
      id,
      status,
      details: details || null,
      processed_at: new Date().toISOString(),
    };

    // Store a short-lived record for inspection
    if (redisClient) {
      await redisClient.setEx(
        `collabwarz:action:${id}`,
        86400,
        JSON.stringify(resultData)
      );
    } else {
      // store in memory for inspection during tests/local runs
      inMemoryProcessed[id] = resultData;
    }

    // If Postgres is enabled and this action produced a backup, persist it
    try {
      // details may include backup directly or inside details.result
      const maybeBackup =
        (details && details.backup) ||
        (details && details.result && details.result.backup);
      const maybeFile =
        (details && details.backup_file) ||
        (details && details.result && details.result.backup_file);
      if (pgPool && maybeBackup && maybeFile) {
        const guildId = maybeBackup.guild_id || process.env.DISCORD_GUILD_ID;
        if (guildId) {
          await saveBackupToDb(Number(guildId), maybeFile, maybeBackup);
          console.log("✅ Persisted backup to Postgres:", maybeFile);
        }
      }
    } catch (err) {
      console.warn(
        "⚠️ Could not persist backup to Postgres:",
        err.message || err
      );
    }

    return res.json({ success: true, stored: !!redisClient });
  } catch (error) {
    console.error("❌ /api/collabwarz/action-result error:", error.message);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// Public endpoints (via Redis communication)
app.get("/api/public/status", async (req, res) => {
  try {
    const status = await getCompetitionStatusFromRedis();
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

// Return current submissions for admin UI
app.get("/api/admin/submissions", verifyAdminAuth, async (req, res) => {
  try {
    const status = await getCompetitionStatusFromRedis();
    let submissions = (status && status.submissions) || {};
    let submissionsArr = [];
    if (submissions && Object.keys(submissions).length > 0) {
      submissionsArr = Object.keys(submissions).map((k) => submissions[k]);
    } else {
      // Fallback to submitted_teams if submissions map isn't available
      const submittedTeams = (status && status.submitted_teams) || {};
      const weekKeys = Object.keys(submittedTeams || {}).sort();
      const latestWeek = weekKeys.length ? weekKeys[weekKeys.length - 1] : null;
      const teamsList = latestWeek ? submittedTeams[latestWeek] || [] : [];
      submissionsArr = teamsList.map((t) => ({ team_name: t, members: [] }));
    }
    res.json({ submissions: submissionsArr });
  } catch (error) {
    console.error("Failed to get submissions from Redis:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// List backups persisted in Postgres (if configured)
app.get("/api/admin/backups", verifyAdminAuth, async (req, res) => {
  try {
    if (!pgPool) {
      console.warn(
        "⚠️ GET /api/admin/backups called but Postgres pool not initialized - falling back to Redis scan"
      );
      const guildId = req.query.guildId || process.env.DISCORD_GUILD_ID || null;
      if (!guildId) {
        console.warn(
          "⚠️ GET /api/admin/backups: DISCORD_GUILD_ID not configured"
        );
        return res
          .status(400)
          .json({ success: false, message: "Guild ID not configured" });
      }
      // Try to retrieve backups from Redis if available
      if (redisClient) {
        const list = await listBackupsFromRedis(guildId);
        return res.json({ success: true, backups: list });
      }
      // No Redis or Postgres - attempt to call cog backend URL if configured
      const backendUrl = process.env.COLLABWARZ_BACKEND_URL || null;
      if (backendUrl && COLLABWARZ_TOKEN) {
        try {
          const url = `${backendUrl.replace(/\/$/, "")}/api/admin/backups`;
          const resp = await axios.get(url, {
            headers: { "X-CW-Token": COLLABWARZ_TOKEN },
          });
          if (resp && resp.data)
            return res.json({
              success: true,
              backups: resp.data.backups || [],
            });
        } catch (err) {
          console.warn(
            "⚠️ Failed to query Cog backend for backups:",
            err.message || err
          );
        }
      }
      return res.status(404).json({
        success: false,
        message: "Backups not available on this server",
      });
    }
    const guildId = req.query.guildId || process.env.DISCORD_GUILD_ID || null;
    if (!guildId) {
      console.warn(
        "⚠️ GET /api/admin/backups: DISCORD_GUILD_ID not configured"
      );
      return res
        .status(400)
        .json({ success: false, message: "Guild ID not configured" });
    }
    // If there are no backups in DB yet, scan Redis action keys to persist missed backups
    let list = await listBackupsFromDb(guildId);
    if (list.length === 0 && redisClient && pgPool) {
      console.log(
        `ℹ️ No backups in DB for guild ${guildId}, scanning Redis for action results...`
      );
      const persisted = await scanAndPersistBackupsFromRedis(guildId, 100);
      if (persisted > 0) {
        console.log(
          `✅ Persisted ${persisted} backup(s) from Redis to Postgres`
        );
        list = await listBackupsFromDb(guildId);
      }
    }
    console.log(
      `ℹ️ GET /api/admin/backups: returning ${list.length} backups for guild ${guildId}`
    );
    return res.json({ success: true, backups: list });
  } catch (err) {
    console.error("❌ Failed to list backups:", err.message || err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// On-demand: scan Redis for backups and persist to Postgres (admin-only)
app.post("/api/admin/backups/scan", verifyAdminAuth, async (req, res) => {
  try {
    if (!pgPool || !redisClient) {
      return res.status(400).json({
        success: false,
        message: "Requires Postgres and Redis configured",
      });
    }
    const guildId = req.query.guildId || process.env.DISCORD_GUILD_ID || null;
    if (!guildId)
      return res
        .status(400)
        .json({ success: false, message: "Guild ID required" });
    const limit = Number(req.query.limit) || 200;
    const persisted = await scanAndPersistBackupsFromRedis(guildId, limit);
    return res.json({ success: true, persisted });
  } catch (err) {
    console.error("❌ /api/admin/backups/scan error:", err.message || err);
    return res
      .status(500)
      .json({ success: false, message: err.message || err });
  }
});

// Download a specific backup from Postgres
app.get("/api/admin/backups/:filename", verifyAdminAuth, async (req, res) => {
  try {
    if (!pgPool) {
      // Try to fetch from Redis if Postgres disabled
      const guildId = process.env.DISCORD_GUILD_ID || null;
      if (!guildId)
        return res
          .status(400)
          .json({ success: false, message: "Guild ID not configured" });
      if (redisClient) {
        const fileName = req.params.filename;
        const backup = await getBackupFromRedis(guildId, fileName);
        if (!backup)
          return res
            .status(404)
            .json({ success: false, message: "Backup not found" });
        return res.json({ success: true, backup: backup, file: fileName });
      }
      // Fallback: try to call cog backend if configured
      const backendUrl = process.env.COLLABWARZ_BACKEND_URL || null;
      if (backendUrl && COLLABWARZ_TOKEN) {
        try {
          const url = `${backendUrl.replace(/\/$/, "")}/api/admin/backups/${
            req.params.filename
          }`;
          const resp = await axios.get(url, {
            headers: { "X-CW-Token": COLLABWARZ_TOKEN },
          });
          if (resp && resp.data)
            return res.json({
              success: true,
              backup: resp.data.backup || resp.data,
              file: req.params.filename,
            });
        } catch (err) {
          console.warn(
            "⚠️ Failed to query Cog backend for backup file:",
            err.message || err
          );
        }
      }
      return res
        .status(404)
        .json({ success: false, message: "Backups not available" });
    }
    const guildId = process.env.DISCORD_GUILD_ID || null;
    if (!guildId)
      return res
        .status(400)
        .json({ success: false, message: "Guild ID not configured" });
    const fileName = req.params.filename;
    if (!fileName)
      return res
        .status(400)
        .json({ success: false, message: "Filename required" });
    const backup = await getBackupFromDb(guildId, fileName);
    if (!backup)
      return res
        .status(404)
        .json({ success: false, message: "Backup not found" });
    return res.json({ success: true, backup: backup, file: fileName });
  } catch (err) {
    console.error("❌ Failed to get backup:", err.message || err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// Admin actions endpoint - sends Discord commands
// Admin actions endpoint - queues actions via Redis
app.post("/api/admin/actions", verifyAdminAuth, async (req, res) => {
  try {
    const { action, params = {}, ...directParams } = req.body;
    // Prefer explicit `params` object when provided; fall back to top-level fields
    const actionParams =
      params && Object.keys(params).length ? params : directParams;

    console.log(`🎮 Admin action via Redis: ${action}`, actionParams);

    let successMessage;

    // Validate and prepare action
    switch (action) {
      case "set_theme":
      case "update_theme":
        if (!actionParams.theme) {
          return res.status(400).json({
            success: false,
            message: "Theme parameter required",
          });
        }
        successMessage = `Theme update queued: ${actionParams.theme}`;
        break;

      case "set_phase":
        if (!actionParams.phase) {
          return res.status(400).json({
            success: false,
            message: "Phase parameter required",
          });
        }
        successMessage = `Phase change queued: ${actionParams.phase}`;
        break;

      case "set_safe_mode":
      case "setSafeMode":
      case "setsafemode":
        if (typeof actionParams.enable === "undefined") {
          return res.status(400).json({
            success: false,
            message: "enable parameter required (true/false)",
          });
        }
        if (typeof actionParams.enable !== "boolean") {
          // Accept numeric 0/1 as boolean
          if (actionParams.enable === 0 || actionParams.enable === 1) {
            actionParams.enable = Boolean(actionParams.enable);
          } else if (typeof actionParams.enable === "string") {
            const v = actionParams.enable.toLowerCase();
            if (v === "true" || v === "1") actionParams.enable = true;
            else if (v === "false" || v === "0") actionParams.enable = false;
          }
        }
        if (typeof actionParams.enable !== "boolean") {
          return res.status(400).json({
            success: false,
            message: "enable must be boolean (true/false)",
          });
        }
        successMessage = `Safe mode ${
          actionParams.enable ? "enabled" : "disabled"
        } queued`;
        break;

      case "next_phase":
        successMessage = "Phase advance queued";
        break;
      case "toggle_automation":
        successMessage = "Automation toggle queued";
        break;

      case "start_new_week":
        if (!actionParams.theme) {
          return res
            .status(400)
            .json({ success: false, message: "Theme parameter required" });
        }
        successMessage = `Start new week: ${actionParams.theme}`;
        break;

      case "syncdata":
      case "sync_data":
      case "syncData":
        successMessage = "Data sync queued";
        break;

      case "clear_submissions":
        successMessage = "Clear submissions queued";
        break;
      case "remove_submission":
        if (!actionParams.team_name) {
          return res
            .status(400)
            .json({ success: false, message: "team_name parameter required" });
        }
        successMessage = `Remove submission queued for: ${actionParams.team_name}`;
        break;
      case "remove_vote":
        if (!actionParams.week || !actionParams.user_id) {
          return res
            .status(400)
            .json({ success: false, message: "week and user_id required" });
        }
        successMessage = `Remove vote queued for uid ${actionParams.user_id} on week ${actionParams.week}`;
        break;

      case "cancel_week":
        successMessage = "Week cancellation queued";
        break;

      case "reset_week":
        successMessage = "Week reset queued";
        break;

      case "force_voting":
        successMessage = "Voting phase start queued";
        break;

      case "announce_winners":
        successMessage = "Winner announcement queued";
        break;

      // Backup-related admin actions - queue to the bot (the bot cog handles file writing / listing)
      case "backup_data":
      case "backupData":
      case "export_backup":
      case "exportBackup":
        successMessage = "Backup export queued";
        break;

      case "list_backups":
      case "get_backups":
      case "backup_list":
      case "backups_list":
        successMessage = "Backups listing queued";
        break;

      case "download_backup":
      case "backup_download":
      case "get_backup":
      case "get_backup_file":
        if (!actionParams.filename) {
          return res
            .status(400)
            .json({ success: false, message: "filename parameter required" });
        }
        successMessage = `Backup download queued: ${actionParams.filename}`;
        break;

      case "restore_backup":
        // Accept either a backup object or filename param for the restore
        if (!actionParams.backup && !actionParams.filename) {
          return res.status(400).json({
            success: false,
            message: "backup object or filename required",
          });
        }
        successMessage = "Backup restore queued";
        break;

      default:
        return res.status(400).json({
          success: false,
          message: `Unknown action: ${action}`,
        });
    }

    // Queue the action for the cog to process
    const queuedAction = await queueCollabWarzAction(action, actionParams);

    // Return success response
    res.json({
      success: true,
      message: successMessage,
      actionId: queuedAction.id,
      timestamp: queuedAction.timestamp,
    });

    // If this is a backup action, attempt to wait for result in Redis and persist to Postgres immediately
    try {
      const backupActions = [
        "backup_data",
        "backupData",
        "export_backup",
        "exportBackup",
      ];
      if (backupActions.includes(action)) {
        const waitTimeoutMs = 12000; // wait up to 12s
        const pollIntervalMs = 500;
        const start = Date.now();
        let found = false;
        while (Date.now() - start < waitTimeoutMs && !found) {
          if (redisClient) {
            try {
              const k = `collabwarz:action:${queuedAction.id}`;
              const raw = await redisClient.get(k);
              if (raw) {
                const parsed = JSON.parse(raw);
                const details = parsed || parsed.details || null;
                // details may contain a backup
                const maybeBackup =
                  (details && details.backup) ||
                  (details && details.result && details.result.backup);
                const maybeFile =
                  (details && details.backup_file) ||
                  (details && details.result && details.result.backup_file);
                if (maybeBackup && maybeFile && pgPool) {
                  await saveBackupToDb(
                    Number(
                      maybeBackup.guild_id || process.env.DISCORD_GUILD_ID
                    ),
                    maybeFile,
                    maybeBackup
                  );
                  console.log(
                    "✅ Persisted backup to Postgres from Redis result (queued action):",
                    maybeFile
                  );
                }
                found = true;
                break;
              }
            } catch (err) {
              // ignore errors while polling
            }
          } else {
            const inMem = inMemoryProcessed[queuedAction.id];
            if (inMem) {
              const details =
                (inMem && inMem.details) || (inMem && inMem.result) || null;
              const maybeBackup =
                (details && details.backup) ||
                (details && details.result && details.result.backup);
              const maybeFile =
                (details && details.backup_file) ||
                (details && details.result && details.result.backup_file);
              if (maybeBackup && maybeFile && pgPool) {
                await saveBackupToDb(
                  Number(maybeBackup.guild_id || process.env.DISCORD_GUILD_ID),
                  maybeFile,
                  maybeBackup
                );
                console.log(
                  "✅ Persisted backup to Postgres from inMemory result (queued action):",
                  maybeFile
                );
              }
              found = true;
              break;
            }
          }
          await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
        }
      }
    } catch (err) {
      console.warn(
        "⚠️ Could not auto-persist backup result after queued action:",
        err.message || err
      );
    }
  } catch (error) {
    console.error("❌ Failed to queue action:", error.message);
    res.status(500).json({
      success: false,
      error: "Failed to queue action via Redis",
      message: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

// Delete submission via admin API (proxy to queue)
app.delete(
  "/api/admin/submissions/:team_name",
  verifyAdminAuth,
  async (req, res) => {
    try {
      const teamName = req.params.team_name;
      if (!teamName)
        return res.status(400).json({ error: "team_name is required" });
      const queued = await queueCollabWarzAction("remove_submission", {
        team_name: teamName,
      });
      return res.json({
        success: true,
        message: "Removal queued",
        actionId: queued.id,
      });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }
);

// Delete vote via admin API (proxy to queue)
app.delete(
  "/api/admin/votes/:week/:user_id",
  verifyAdminAuth,
  async (req, res) => {
    try {
      const week = req.params.week;
      const userId = req.params.user_id;
      if (!week || !userId)
        return res.status(400).json({ error: "week and user_id are required" });
      const queued = await queueCollabWarzAction("remove_vote", {
        week,
        user_id: userId,
      });
      return res.json({
        success: true,
        message: "Vote removal queued",
        actionId: queued.id,
      });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }
);

// Debug endpoint to inspect in-memory queue (only in non-production)
app.get("/api/debug/queue", (req, res) => {
  if (process.env.NODE_ENV === "production")
    return res.status(403).json({ error: "Forbidden" });
  res.json({ queueLength: inMemoryQueue.length, queue: inMemoryQueue });
});
app.get("/api/debug/processed", (req, res) => {
  if (process.env.NODE_ENV === "production")
    return res.status(403).json({ error: "Forbidden" });
  res.json({ processed: Object.values(inMemoryProcessed).slice(-200) });
});

// Admin queue + processing state endpoint (used by frontend UI)
app.get("/api/admin/queue", verifyAdminAuth, async (req, res) => {
  try {
    if (!redisClient) {
      // In-memory fallback
      return res.json({
        queueLength: inMemoryQueue.length,
        queue: inMemoryQueue.slice(0, 100),
        processed: Object.values(inMemoryProcessed).slice(-100),
        backend: "in-memory",
      });
    }

    const queueRaw = await redisClient.lRange("collabwarz:actions", 0, 99);
    const queue = queueRaw.map((s) => {
      try {
        return JSON.parse(s);
      } catch (e) {
        return { raw: s };
      }
    });

    const keys = await redisClient.keys("collabwarz:action:*");
    let processed = [];
    if (keys && keys.length) {
      // Limit to latest 100
      const limited = keys.slice(-100);
      for (const key of limited) {
        const value = await redisClient.get(key);
        try {
          processed.push(JSON.parse(value));
        } catch (e) {
          processed.push({ raw: value });
        }
      }
    }

    return res.json({
      queueLength: await redisClient.lLen("collabwarz:actions"),
      queue,
      processed,
      backend: "redis",
    });
  } catch (error) {
    console.error("❌ /api/admin/queue error:", error.message);
    return res.status(500).json({ error: error.message });
  }
});

// Admin history
app.get("/api/admin/history", verifyAdminAuth, async (req, res) => {
  try {
    const status = await getCompetitionStatusFromRedis();
    const weeks = (status && status.weeks) || [];
    res.json({ weeks });
  } catch (error) {
    console.error("Failed to get admin history from Redis:", error.message);
    return res.status(500).json({ error: error.message });
  }
});

// Get voting details for a specific week
app.get("/api/admin/votes/:week/details", verifyAdminAuth, async (req, res) => {
  try {
    const week = req.params.week;
    const status = await getCompetitionStatusFromRedis();
    const voting =
      (status && status.voting_results && status.voting_results[week]) || {};
    res.json({ week, results: voting });
  } catch (error) {
    console.error("Failed to get vote details:", error.message);
    return res.status(500).json({ error: error.message });
  }
});

// Startup function to initialize Redis and start server
async function startServer() {
  try {
    // Initialize Redis connection
    await initRedis();
    // Initialize Postgres connection
    await initPostgres();

    // Start Express server
    app.listen(PORT, () => {
      console.log(`✅ Server running on http://localhost:${PORT}`);
      console.log(`📡 Discord OAuth redirect URI: ${DISCORD_REDIRECT_URI}`);
      console.log(`🔄 Redis communication ready for CollabWarz cog`);
    });
  } catch (error) {
    console.error("❌ Failed to start server:", error.message);
    process.exit(1);
  }
}

// Start the server
startServer();
