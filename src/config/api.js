// API Configuration
const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

// Ensure no trailing slash
export const API_URL = API_BASE_URL.replace(/\/$/, "");

// API Endpoints
export const API_ENDPOINTS = {
  // Auth
  AUTH_DISCORD: `${API_URL}/auth/discord`,

  // Health check
  HEALTH: `${API_URL}/health`,

  // Public API (when Discord bot API is integrated)
  PUBLIC_API: `${API_URL}/api/public`,

  // Artists
  ARTISTS: `${API_URL}/api/public/artists`,

  // Teams
  TEAMS: `${API_URL}/api/public/teams`,

  // Songs
  SONGS: `${API_URL}/api/public/songs`,

  // Weeks
  WEEKS: `${API_URL}/api/public/weeks`,

  // Statistics
  STATISTICS: `${API_URL}/api/public/statistics`,
};

// Development mode helper
export const isDevelopment = import.meta.env.DEV;
export const isProduction = import.meta.env.PROD;

console.log(
  `🔗 API Configuration: ${API_URL} (${
    isDevelopment ? "Development" : "Production"
  })`
);
