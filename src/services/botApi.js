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
      const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
      throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
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
 */
export const generateAITheme = async () => {
  return await executeAdminAction("generate_theme");
};

/**
 * Start next week
 */
export const startNextWeek = async () => {
  return await executeAdminAction("start_next_week");
};

/**
 * Cancel the current week
 */
export const cancelWeek = async () => {
  return await executeAdminAction("cancel_week");
};

/**
 * End the current week and announce results
 */
export const endWeek = async () => {
  return await executeAdminAction("end_week");
};

/**
 * Send an announcement
 * @param {string} type - Announcement type
 * @param {string} message - Announcement message
 */
export const sendAnnouncement = async (type, message) => {
  return await executeAdminAction("send_announcement", { type, message });
};

/**
 * Reset all votes for the current week
 */
export const resetVotes = async () => {
  return await executeAdminAction("reset_votes");
};

/**
 * Remove invalid votes
 */
export const removeInvalidVotes = async () => {
  return await executeAdminAction("remove_invalid_votes");
};

/**
 * Export voting results
 * @param {string} week - Week identifier (optional, defaults to current)
 */
export const exportVotingResults = async (week) => {
  return await executeAdminAction("export_results", { week });
};

/**
 * Test AI configuration
 */
export const testAI = async () => {
  return await executeAdminAction("test_ai");
};

/**
 * Sync data with Discord bot
 */
export const syncData = async () => {
  return await executeAdminAction("sync_data");
};

/**
 * Restart the Discord bot
 */
export const restartBot = async () => {
  return await executeAdminAction("restart_bot");
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
