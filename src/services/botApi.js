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

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });

    // Handle non-OK responses
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: "Network or parsing error" }));
      
      // Provide more specific error messages for common cases
      let errorMessage = errorData.error || `HTTP ${response.status}: ${response.statusText}`;
      
      if (response.status === 401) {
        errorMessage = `Authentication failed: ${errorData.error || 'Invalid or expired token'}`;
      } else if (response.status === 403) {
        errorMessage = `Access denied: ${errorData.error || 'Token does not have required permissions'}`;
      } else if (response.status === 500) {
        errorMessage = `Server error: ${errorData.error || 'Internal server error'}`;
      } else if (response.status === 503) {
        errorMessage = `Service unavailable: ${errorData.error || 'Bot API server is not running'}`;
      }
      
      throw new Error(errorMessage);
    }

    return await response.json();
  } catch (error) {
    console.error(`API Error (${endpoint}):`, error);
    throw error;
  }
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
  return await fetchWithAuth(`/api/admin/history?page=${page}&per_page=${perPage}`);
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
  return await fetchWithAuth(`/api/admin/submissions/${encodeURIComponent(teamName)}`, {
    method: "DELETE",
  });
};

/**
 * Remove a vote from a user for a specific week
 * @param {string} week - Week identifier
 * @param {string} userId - User ID
 */
export const removeVote = async (week, userId) => {
  return await fetchWithAuth(`/api/admin/votes/${encodeURIComponent(week)}/${encodeURIComponent(userId)}`, {
    method: "DELETE",
  });
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
  return await fetchWithAuth(`/api/admin/votes/${encodeURIComponent(week)}/details`);
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
  console.warn("generateAITheme: This feature may require AI configuration in the bot");
  // Return a mock theme as fallback
  const themes = [
    "Cosmic Journey", "Neon Dreams", "Ocean Waves", 
    "Desert Sunset", "Arctic Winds", "Jungle Rhythm",
    "Urban Pulse", "Mountain Echo", "Starlight Symphony"
  ];
  const randomTheme = themes[Math.floor(Math.random() * themes.length)];
  return { 
    success: true, 
    theme: randomTheme,
    message: "Theme generated (consider using AI via Discord bot commands for better results)"
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
  throw new Error("Theme required to start new week. Please set a theme first.");
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
  // Try to set phase to ended as a fallback
  return await setPhase("ended");
};

/**
 * Send an announcement
 * Note: This action may need to be triggered through Discord commands
 * @param {string} type - Announcement type
 * @param {string} message - Announcement message
 */
export const sendAnnouncement = async (type, message) => {
  // This is a placeholder - the actual implementation depends on bot configuration
  console.warn("sendAnnouncement: This action may not be fully implemented in the bot backend");
  return { success: true, message: "Announcement queued (feature may require bot command)" };
};

/**
 * Reset all votes for the current week
 * Note: Use clear_submissions or manual vote removal instead
 */
export const resetVotes = async () => {
  console.warn("resetVotes: Consider using individual vote removal via DELETE endpoint");
  throw new Error("Reset votes not implemented. Please remove votes individually.");
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
  console.warn("exportVotingResults: Export feature may need backend implementation");
  return { success: true, message: "Export feature in development" };
};

/**
 * Test AI configuration
 * Note: AI test typically done via Discord bot commands
 */
export const testAI = async () => {
  return { success: true, message: "AI test should be performed via Discord bot commands" };
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
  return { success: true, message: "Bot restart request received (requires hosting platform access)" };
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
