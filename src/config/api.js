// API Configuration
const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";
const BOT_API_BASE_URL =
  import.meta.env.VITE_BOT_API_URL || "http://localhost:8080";

// Ensure no trailing slash
export const API_URL = API_BASE_URL.replace(/\/$/, "");
export const BOT_API_URL = BOT_API_BASE_URL.replace(/\/$/, "");

// API Endpoints
export const API_ENDPOINTS = {
  // Auth (Express server)
  AUTH_DISCORD: `${API_URL}/auth/discord`,
  HEALTH: `${API_URL}/health`,

  // Discord Bot API (RedBot cog)
  // User membership verification
  USER_MEMBERSHIP: (userId) =>
    `${BOT_API_URL}/api/public/user/${userId}/membership`,

  // Collab Warz Data
  ARTISTS: `${BOT_API_URL}/api/public/artists`,
  TEAMS: `${BOT_API_URL}/api/public/teams`,
  SONGS: `${BOT_API_URL}/api/public/songs`,
  WEEKS: `${BOT_API_URL}/api/public/weeks`,
  STATISTICS: `${BOT_API_URL}/api/public/statistics`,
};

// Development mode helper
export const isDevelopment = import.meta.env.DEV;
export const isProduction = import.meta.env.PROD;

console.log(
  `🔗 API Configuration: ${API_URL} (${
    isDevelopment ? "Development" : "Production"
  })`
);
