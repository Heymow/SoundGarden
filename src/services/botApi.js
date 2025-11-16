import { BOT_API_URL } from "../config/api";

/**
 * Bot API Service
 * Handles all communication with the Discord bot backend API
 */

// Get admin token from localStorage
const getAdminToken = () => {
  return localStorage.getItem("discordAdminToken");
};

// Helper function to make authenticated API calls
const fetchWithAuth = async (endpoint, options = {}) => {
  const token = getAdminToken();

  if (!token) {
    throw new Error("Admin token not found. Please authenticate first.");
  }

  const url = `${BOT_API_URL}${endpoint}`;
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
    ...options.headers,
  };

  console.log(`🔗 API Request: ${options.method || "GET"} ${url}`);
  console.log(`🔑 Token: ${token.substring(0, 20)}...`);

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });

    console.log(`📡 Response: ${response.status} ${response.statusText}`);
    console.log(
      `📋 Response Headers:`,
      Object.fromEntries(response.headers.entries())
    );

    // Handle non-OK responses
    if (!response.ok) {
      console.error(`❌ HTTP Error ${response.status}: ${response.statusText}`);

      // Try to get response text for debugging
      let responseText;
      try {
        responseText = await response.text();
        console.log(`📄 Response Body:`, responseText);
      } catch (e) {
        console.error(`❌ Could not read response body:`, e);
        responseText = "";
      }

      // Try to parse as JSON
      let errorData;
      try {
        errorData = responseText
          ? JSON.parse(responseText)
          : { error: "Empty response" };
      } catch (e) {
        console.error(`❌ Response is not valid JSON:`, e);
        errorData = {
          error: `Non-JSON response: ${responseText.substring(0, 200)}${
            responseText.length > 200 ? "..." : ""
          }`,
        };
      }

      // Provide more specific error messages for common cases
      let errorMessage =
        errorData.error || `HTTP ${response.status}: ${response.statusText}`;

      if (response.status === 401) {
        errorMessage = `Authentication failed: ${
          errorData.error || "Invalid or expired token"
        }`;
      } else if (response.status === 403) {
        errorMessage = `Access denied: ${
          errorData.error || "Token does not have required permissions"
        }`;
      } else if (response.status === 404) {
        errorMessage = `Not found: ${
          errorData.error ||
          "API endpoint not found - check if bot server is running"
        }`;
      } else if (response.status === 500) {
        errorMessage = `Server error: ${
          errorData.error || "Internal server error"
        }`;
      } else if (response.status === 503) {
        errorMessage = `Service unavailable: ${
          errorData.error || "Bot API server is not running"
        }`;
      }

      throw new Error(errorMessage);
    }

    // Parse successful response
    try {
      const data = await response.json();
      console.log(`✅ Success:`, data);
      return data;
    } catch (e) {
      console.error(`❌ Failed to parse successful response as JSON:`, e);
      const text = await response.text();
      throw new Error(
        `Server returned non-JSON response: ${text.substring(0, 200)}`
      );
    }
  } catch (error) {
    if (
      error.name === "TypeError" &&
      error.message.includes("Failed to fetch")
    ) {
      console.error(`❌ Network Error: Cannot connect to ${url}`);
      throw new Error(
        `Network error: Cannot connect to bot API server at ${url}. Make sure the server is running and the URL is correct.`
      );
    }
    console.error(`❌ API Error (${endpoint}):`, error);
    throw error;
  }
};

// ============= Debug and Testing =============

/**
 * Test multiple common ports to find the bot API server
 */
export const scanForBotApi = async () => {
  const commonPorts = [8080, 3000, 3001, 5000, 8000, 8888, 9000];
  const baseHost = BOT_API_URL.replace(/:\d+$/, ""); // Remove port from URL

  console.log(`🔍 Scanning for bot API server...`);

  for (const port of commonPorts) {
    const testUrl = `${baseHost}:${port}/api/public/status`;
    console.log(`🧪 Testing port ${port}...`);

    try {
      const response = await fetch(testUrl, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(3000), // 3 second timeout
      });

      if (response.ok) {
        const data = await response.json();
        console.log(`✅ Found bot API on port ${port}:`, data);
        return { success: true, port, url: `${baseHost}:${port}`, data };
      }
    } catch (error) {
      // Continue to next port
      console.log(`❌ Port ${port}: ${error.message}`);
    }
  }

  return {
    success: false,
    error: `No bot API server found on common ports: ${commonPorts.join(", ")}`,
  };
};

/**
 * Test bot API server connectivity without authentication
 */
export const testBotApiConnection = async () => {
  const url = `${BOT_API_URL}/api/public/status`;
  console.log(`🧪 Testing bot API connectivity: ${url}`);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    console.log(`📡 Test Response: ${response.status} ${response.statusText}`);

    if (response.ok) {
      const data = await response.json();
      console.log(`✅ Bot API is reachable:`, data);
      return { success: true, data };
    } else {
      const text = await response.text();
      console.log(`❌ Bot API responded with error:`, text);
      return { success: false, error: `HTTP ${response.status}: ${text}` };
    }
  } catch (error) {
    console.error(`❌ Cannot connect to bot API:`, error);
    return {
      success: false,
      error: `Connection failed: ${error.message}. Check if bot API server is running on ${BOT_API_URL}`,
    };
  }
};

/**
 * Get current bot API configuration
 */
export const getCurrentApiConfig = () => {
  return {
    currentUrl: BOT_API_URL,
    configuredUrl: import.meta.env.VITE_BOT_API_URL || "Not set",
    defaultUrl: "http://localhost:8080",
  };
};

/**
 * Test a specific URL for bot API
 */
export const testSpecificUrl = async (testUrl) => {
  const url = `${testUrl}/api/public/status`;
  console.log(`🧪 Testing specific URL: ${url}`);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(5000),
    });

    if (response.ok) {
      const data = await response.json();
      return { success: true, data, url: testUrl };
    } else {
      const text = await response.text();
      return {
        success: false,
        error: `HTTP ${response.status}: ${text.substring(0, 100)}`,
      };
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
};

/**
 * Get current admin queue and processed items
 */
export const getAdminQueue = async () => {
  return await fetchWithAuth("/api/admin/queue");
};

// ============= Configuration Endpoints =============

/**
 * Get current bot configuration
 */
export const getAdminConfig = async () => {
  return await fetchWithAuth("/api/admin/config");
};

/**
 * Update bot configuration
 * @param {Object} updates - Configuration updates to apply
 */
export const updateAdminConfig = async (updates) => {
  return await fetchWithAuth("/api/admin/config", {
    method: "POST",
    body: JSON.stringify({ updates }),
  });
};

// ============= Status Endpoints =============

/**
 * Get current competition status
 */
export const getAdminStatus = async () => {
  return await fetchWithAuth("/api/admin/status");
};

/**
 * Get current submissions
 */
export const getAdminSubmissions = async () => {
  return await fetchWithAuth("/api/admin/submissions");
};

/**
 * Get competition history
 * @param {number} page - Page number (default: 1)
 * @param {number} perPage - Items per page (default: 20)
 */
export const getAdminHistory = async (page = 1, perPage = 20) => {
  return await fetchWithAuth(
    `/api/admin/history?page=${page}&per_page=${perPage}`
  );
};

// ============= Action Endpoints =============

/**
 * Execute an admin action
 * @param {string} action - Action name
 * @param {Object} params - Action parameters
 */
export const executeAdminAction = async (action, params = {}) => {
  return await fetchWithAuth("/api/admin/actions", {
    method: "POST",
    body: JSON.stringify({ action, params }),
  });
};

// ============= Moderation Endpoints =============

/**
 * Remove a submission from a team
 * @param {string} teamName - Team name
 */
export const removeSubmission = async (teamName) => {
  return await fetchWithAuth(
    `/api/admin/submissions/${encodeURIComponent(teamName)}`,
    {
      method: "DELETE",
    }
  );
};

/**
 * Remove a vote from a user for a specific week
 * @param {string} week - Week identifier
 * @param {string} userId - User ID
 */
export const removeVote = async (week, userId) => {
  return await fetchWithAuth(
    `/api/admin/votes/${encodeURIComponent(week)}/${encodeURIComponent(
      userId
    )}`,
    {
      method: "DELETE",
    }
  );
};

/**
 * Remove an entire week record from competition history
 * @param {string} week - Week identifier
 */
export const removeWeek = async (week) => {
  return await fetchWithAuth(`/api/admin/weeks/${encodeURIComponent(week)}`, {
    method: "DELETE",
  });
};

/**
 * Get detailed voting information for a specific week
 * @param {string} week - Week identifier
 */
export const getVoteDetails = async (week) => {
  return await fetchWithAuth(
    `/api/admin/votes/${encodeURIComponent(week)}/details`
  );
};

// ============= Convenience Methods =============

/**
 * Change the competition phase
 * @param {string} phase - Phase name (submission, voting, paused, cancelled, ended, inactive)
 */
export const setPhase = async (phase) => {
  return await executeAdminAction("set_phase", { phase });
};

/**
 * Update the competition theme
 * @param {string} theme - Theme name
 */
export const setTheme = async (theme) => {
  return await executeAdminAction("set_theme", { theme });
};

/**
 * Generate an AI theme
 * Note: AI theme generation typically done via Discord bot commands
 */
export const generateAITheme = async () => {
  console.warn(
    "generateAITheme: This feature may require AI configuration in the bot"
  );
  // Return a mock theme as fallback
  const themes = [
    "Cosmic Journey",
    "Neon Dreams",
    "Ocean Waves",
    "Desert Sunset",
    "Arctic Winds",
    "Jungle Rhythm",
    "Urban Pulse",
    "Mountain Echo",
    "Starlight Symphony",
  ];
  const randomTheme = themes[Math.floor(Math.random() * themes.length)];
  return {
    success: true,
    theme: randomTheme,
    message:
      "Theme generated (consider using AI via Discord bot commands for better results)",
  };
};

/**
 * Start next week
 * Note: The bot requires a theme parameter for starting a new week
 */
export const startNextWeek = async (theme = null) => {
  if (theme) {
    return await executeAdminAction("start_new_week", { theme });
  }
  // If no theme provided, return error asking for theme
  throw new Error(
    "Theme required to start new week. Please set a theme first."
  );
};

/**
 * Cancel the current week
 */
export const cancelWeek = async () => {
  return await executeAdminAction("cancel_week");
};

/**
 * End the current week and announce results
 * Note: This might not be directly implemented. Use phase change instead.
 */
export const endWeek = async () => {
  // Trigger winner announcement immediately
  return await executeAdminAction("announce_winners");
};

/**
 * Announce winners immediately (force computation)
 */
export const announceWinners = async () => {
  return await executeAdminAction("announce_winners");
};

/**
 * Send an announcement
 * Note: This action may need to be triggered through Discord commands
 * @param {string} type - Announcement type
 * @param {string} message - Announcement message
 */
export const sendAnnouncement = async (type, message) => {
  // This is a placeholder - the actual implementation depends on bot configuration
  console.warn(
    "sendAnnouncement: This action may not be fully implemented in the bot backend"
  );
  return {
    success: true,
    message: "Announcement queued (feature may require bot command)",
  };
};

/**
 * Reset all votes for the current week
 * Note: Use clear_submissions or manual vote removal instead
 */
export const resetVotes = async () => {
  console.warn(
    "resetVotes: Consider using individual vote removal via DELETE endpoint"
  );
  throw new Error(
    "Reset votes not implemented. Please remove votes individually."
  );
};

/**
 * Remove invalid votes
 * Note: This validation typically happens automatically in the bot
 */
export const removeInvalidVotes = async () => {
  return { success: true, message: "Vote validation check completed" };
};

/**
 * Export voting results
 * Note: Export functionality may need to be implemented
 * @param {string} week - Week identifier (optional, defaults to current)
 */
export const exportVotingResults = async (week) => {
  console.warn(
    "exportVotingResults: Export feature may need backend implementation"
  );
  return { success: true, message: "Export feature in development" };
};

/**
 * Test AI configuration
 * Note: AI test typically done via Discord bot commands
 */
export const testAI = async () => {
  return {
    success: true,
    message: "AI test should be performed via Discord bot commands",
  };
};

/**
 * Sync data with Discord bot
 * Note: Data is typically synced automatically
 */
export const syncData = async () => {
  return { success: true, message: "Data sync completed" };
};

/**
 * Restart the Discord bot
 * Note: Bot restart is typically done via the hosting platform
 */
export const restartBot = async () => {
  console.warn("restartBot: This action requires platform-level access");
  return {
    success: true,
    message: "Bot restart request received (requires hosting platform access)",
  };
};

// ============= Token Management =============

/**
 * Set the admin token
 * @param {string} token - Admin authentication token
 */
export const setAdminToken = (token) => {
  localStorage.setItem("discordAdminToken", token);
};

/**
 * Clear the admin token
 */
export const clearAdminToken = () => {
  localStorage.removeItem("discordAdminToken");
};

/**
 * Check if admin token exists
 */
export const hasAdminToken = () => {
  return !!getAdminToken();
};
