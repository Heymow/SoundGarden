import React, { useState, useEffect } from "react";
import * as botApi from "../../services/botApi";

/**
 * AdminTokenSetup Component
 * Provides UI for admins to input and save their admin token
 * Also validates the token and checks admin status with the bot
 */
export default function AdminTokenSetup({ onTokenValidated }) {
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [hasStoredToken, setHasStoredToken] = useState(false);

  useEffect(() => {
    // Check if a token is already stored
    setHasStoredToken(botApi.hasAdminToken());
  }, []);

  const handleTokenSubmit = async (e) => {
    e.preventDefault();
    
    if (!token.trim()) {
      setError("Please enter a valid token");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Save the token
      botApi.setAdminToken(token.trim());
      
      // Validate the token by making a test API call
      await botApi.getAdminStatus();
      
      // If successful, token is valid and user is an admin
      setHasStoredToken(true);
      if (onTokenValidated) {
        onTokenValidated();
      }
    } catch (err) {
      // Token validation failed - remove it
      botApi.clearAdminToken();
      setHasStoredToken(false);
      
      if (err.message.includes("403") || err.message.includes("Invalid token")) {
        setError("Invalid token or you are not authorized as an admin. Please check your token and admin configuration.");
      } else if (err.message.includes("401") || err.message.includes("Missing authorization")) {
        setError("Token format is invalid. Please copy the complete token from your Discord DM.");
      } else if (err.message.includes("503") || err.message.includes("API not enabled")) {
        setError("Bot API is not enabled or not running. Please ensure the Discord bot API server is active.");
      } else {
        setError(`Token validation failed: ${err.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleClearToken = () => {
    if (confirm("Are you sure you want to clear the stored admin token?")) {
      botApi.clearAdminToken();
      setToken("");
      setHasStoredToken(false);
      setError(null);
    }
  };

  const handleTestConnection = async () => {
    setLoading(true);
    setError(null);

    try {
      const status = await botApi.getAdminStatus();
      alert(`✅ Connection successful!\n\nPhase: ${status.phase}\nTheme: ${status.theme}`);
    } catch (err) {
      setError(`Connection test failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  if (hasStoredToken) {
    return (
      <div className="admin-token-status">
        <div className="token-status-card">
          <div className="token-status-icon">✅</div>
          <div className="token-status-content">
            <h3>Admin Token Configured</h3>
            <p>You are authenticated as an admin.</p>
            <div className="token-actions">
              <button 
                className="btn-secondary" 
                onClick={handleTestConnection}
                disabled={loading}
              >
                {loading ? "Testing..." : "🔍 Test Connection"}
              </button>
              <button 
                className="btn-danger" 
                onClick={handleClearToken}
                disabled={loading}
              >
                🗑️ Clear Token
              </button>
            </div>
          </div>
        </div>
        {error && (
          <div className="token-error">
            <strong>Error:</strong> {error}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="admin-token-setup">
      <div className="token-setup-card">
        <div className="token-setup-header">
          <h2>🔐 Admin Authentication Required</h2>
          <p>Please enter your admin token to access the admin panel.</p>
        </div>

        <div className="token-setup-instructions">
          <h3>How to get your admin token:</h3>
          <ol>
            <li>Ensure you are configured as an admin in the Discord bot using:
              <code>[p]cw setadmin @YourUsername</code> or <code>[p]cw addadmin @YourUsername</code>
            </li>
            <li>Generate your admin token using Discord:
              <code>[p]cw admintoken generate</code>
            </li>
            <li>Check your Discord DMs for the token</li>
            <li>Copy the complete token and paste it below</li>
          </ol>
        </div>

        <form onSubmit={handleTokenSubmit} className="token-setup-form">
          <div className="form-group">
            <label htmlFor="adminToken">Admin Token</label>
            <textarea
              id="adminToken"
              className="token-input"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Paste your admin token here..."
              rows={4}
              disabled={loading}
              required
            />
          </div>

          {error && (
            <div className="token-error">
              <strong>⚠️ Error:</strong> {error}
            </div>
          )}

          <div className="form-actions">
            <button 
              type="submit" 
              className="btn-primary"
              disabled={loading || !token.trim()}
            >
              {loading ? "Validating..." : "💾 Save and Validate Token"}
            </button>
          </div>
        </form>

        <div className="token-setup-help">
          <h4>Troubleshooting:</h4>
          <ul>
            <li>Make sure the Discord bot API server is running</li>
            <li>Verify you're configured as an admin: <code>[p]cw listadmins</code></li>
            <li>Ensure the bot API is enabled: <code>[p]cw apiserver enable</code></li>
            <li>Check that VITE_BOT_API_URL is correctly configured in your .env file</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
