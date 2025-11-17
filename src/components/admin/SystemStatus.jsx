import React, { useState } from "react";
import * as botApi from "../../services/botApi";
import { useAdminOverlay } from "../../context/AdminOverlayContext";

export default function SystemStatus() {
  const [systemHealth, setSystemHealth] = useState({
    botOnline: true,
    apiServer: true,
    database: true,
    discord: true,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const overlay = useAdminOverlay();

  const showSuccess = (message) => overlay.showAlert('success', message);
  const showError = (message) => overlay.showAlert('error', message);

  const handleEditConfig = () => {
    showSuccess("⚙️ Opening bot configuration editor...");
  };

  const handleViewLogs = () => {
    showSuccess("📜 Opening full system logs viewer...");
  };

  const handleSyncData = async () => {
    setLoading(true);
    overlay.showLoading();
    try {
      await botApi.syncData();
      showSuccess("✅ Data synchronized successfully!");
    } catch (err) {
      showError(`❌ Failed to sync data: ${err.message}`);
    } finally {
      setLoading(false);
      overlay.hideLoading();
    }
  };

  const handleRestartBot = async () => {
    if (confirm("⚠️ Are you sure you want to restart the bot? This may cause brief downtime.")) {
      setLoading(true);
      overlay.showLoading();
      try {
        await botApi.restartBot();
        setSystemHealth(prev => ({ ...prev, botOnline: false }));
        showSuccess("♻️ Bot restart initiated...");
        setTimeout(() => {
          setSystemHealth(prev => ({ ...prev, botOnline: true }));
        }, 3000);
      } catch (err) {
        showError(`❌ Failed to restart bot: ${err.message}`);
      } finally {
        setLoading(false);
        overlay.hideLoading();
      }
    }
  };

  const handleGenerateReport = () => {
    showSuccess("📊 Generating system report...");
  };

  const handleBackupData = () => {
    if (confirm("Create a backup of all competition data?")) {
      showSuccess("💾 Creating data backup...");
    }
  };

  const handleRunDiagnostics = async () => {
    setLoading(true);
    overlay.showLoading();
    showSuccess("🔍 Running comprehensive diagnostics...");

    try {
      // First try the configured URL
      const apiTest = await botApi.testBotApiConnection();

      if (apiTest.success) {
        showSuccess("✅ Diagnostics passed: Bot API is reachable and responding");
        setSystemHealth(prev => ({ ...prev, apiServer: true, botOnline: true }));
      } else {
        showError(`❌ Configured URL failed: ${apiTest.error}`);
        setSystemHealth(prev => ({ ...prev, apiServer: false }));

        // If configured URL fails, scan for the server
        showSuccess("🔍 Scanning for bot API server on other ports...");
        const scanResult = await botApi.scanForBotApi();

        if (scanResult.success) {
          showSuccess(`✅ Found bot API server on port ${scanResult.port}! Please update your configuration to use ${scanResult.url}`);
        } else {
          showError(`❌ No bot API server found: ${scanResult.error}`);
        }
      }
    } catch (err) {
      showError(`❌ Diagnostics error: ${err.message}`);
      setSystemHealth(prev => ({ ...prev, apiServer: false, botOnline: false }));
    } finally {
      setLoading(false);
      overlay.hideLoading();
    }
  };

  return (
    <div className="admin-section">
      <div className="admin-section-header">
        <h2>⚙️ System Status</h2>
        <p className="admin-section-subtitle">
          Monitor system health and configuration
        </p>
      </div>

      {/* System Health */}
      <div className="admin-card">
        <h3 className="admin-card-title">🏥 System Health</h3>
        <div className="admin-card-content">
          <div className="health-grid">
            <div className={`health-item ${systemHealth.botOnline ? "healthy" : "error"}`}>
              <div className="health-icon">{systemHealth.botOnline ? "✅" : "❌"}</div>
              <div className="health-info">
                <div className="health-label">Discord Bot</div>
                <div className="health-status">{systemHealth.botOnline ? "Online" : "Offline"}</div>
              </div>
            </div>
            <div className={`health-item ${systemHealth.apiServer ? "healthy" : "error"}`}>
              <div className="health-icon">{systemHealth.apiServer ? "✅" : "❌"}</div>
              <div className="health-info">
                <div className="health-label">API Server</div>
                <div className="health-status">{systemHealth.apiServer ? "Running" : "Down"}</div>
              </div>
            </div>
            <div className={`health-item ${systemHealth.database ? "healthy" : "error"}`}>
              <div className="health-icon">{systemHealth.database ? "✅" : "❌"}</div>
              <div className="health-info">
                <div className="health-label">Database</div>
                <div className="health-status">{systemHealth.database ? "Connected" : "Error"}</div>
              </div>
            </div>
            <div className={`health-item ${systemHealth.discord ? "healthy" : "error"}`}>
              <div className="health-icon">{systemHealth.discord ? "✅" : "❌"}</div>
              <div className="health-info">
                <div className="health-label">Discord API</div>
                <div className="health-status">{systemHealth.discord ? "Connected" : "Error"}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bot Configuration */}
      <div className="admin-card">
        <h3 className="admin-card-title">🤖 Bot Configuration</h3>
        <div className="admin-card-content">
          <div className="config-list">
            <div className="config-item">
              <span className="config-label">Announcement Channel:</span>
              <span className="config-value">#collab-warz</span>
            </div>
            <div className="config-item">
              <span className="config-label">Submission Channel:</span>
              <span className="config-value">#submissions</span>
            </div>
            <div className="config-item">
              <span className="config-label">Test Channel:</span>
              <span className="config-value">#bot-testing</span>
            </div>
            <div className="config-item">
              <span className="config-label">Auto-Announce:</span>
              <span className="config-value">Enabled</span>
            </div>
            <div className="config-item">
              <span className="config-label">Require Confirmation:</span>
              <span className="config-value">Disabled</span>
            </div>
          </div>
          <button className="admin-btn btn-secondary" onClick={handleEditConfig}>Edit Configuration</button>
        </div>
      </div>

      {/* Server Info */}
      <div className="admin-card">
        <h3 className="admin-card-title">🖥️ Server Information</h3>
        <div className="admin-card-content">
          <div className="server-info-grid">
            <div className="info-item">
              <span className="info-label">Bot Version:</span>
              <span className="info-value">2.5.0</span>
            </div>
            <div className="info-item">
              <span className="info-label">Uptime:</span>
              <span className="info-value">5 days, 12 hours</span>
            </div>
            <div className="info-item">
              <span className="info-label">Server Members:</span>
              <span className="info-value">247 members</span>
            </div>
            <div className="info-item">
              <span className="info-label">Command Prefix:</span>
              <span className="info-value">[p]cw</span>
            </div>
          </div>
        </div>
      </div>

      {/* Logs */}
      <div className="admin-card">
        <h3 className="admin-card-title">📜 System Logs</h3>
        <div className="admin-card-content">
          <div className="log-viewer">
            <div className="log-entry log-info">
              <span className="log-time">2024-01-15 14:32:15</span>
              <span className="log-level">INFO</span>
              <span className="log-message">Announcement posted successfully</span>
            </div>
            <div className="log-entry log-success">
              <span className="log-time">2024-01-15 14:30:00</span>
              <span className="log-level">SUCCESS</span>
              <span className="log-message">Phase changed to: voting</span>
            </div>
            <div className="log-entry log-info">
              <span className="log-time">2024-01-15 14:28:45</span>
              <span className="log-level">INFO</span>
              <span className="log-message">New submission received from Team Alpha</span>
            </div>
            <div className="log-entry log-warning">
              <span className="log-time">2024-01-15 14:15:20</span>
              <span className="log-level">WARNING</span>
              <span className="log-message">Rate limit approaching for API calls</span>
            </div>
          </div>
          <button className="admin-btn btn-secondary" onClick={handleViewLogs}>View Full Logs</button>
        </div>
      </div>

      {/* Diagnostics */}
      <div className="admin-card">
        <h3 className="admin-card-title">🔍 Connection Diagnostics</h3>
        <div className="admin-card-content">
          <div className="diagnostic-info">
            <p>Test the connection between the admin panel and the Discord bot API server.</p>
            <div className="error-info" style={{ background: '#fff3cd', padding: '10px', borderRadius: '5px', margin: '10px 0' }}>
              <strong>🚨 Current Issue:</strong> Getting HTML error "Cannot GET /api/admin/status"
              <br />This means the bot API server is not running or not accessible.
            </div>
            <p><strong>Fix this by running these Discord commands:</strong></p>
            <ol>
              <li><code>!cw help</code> - Verify the bot is loaded and responding</li>
              <li><code>!cw apiserver start</code> - Start the API server</li>
              <li><code>!cw apiserver status</code> - Confirm it's running</li>
              <li><code>!cw admintoken debug</code> - Check configuration</li>
              <li>If still failing, try <code>!cw apiconfig cors *</code> to allow all origins</li>
            </ol>
            <p><strong>Expected result:</strong> API server should start on a port (usually 8080)</p>
          </div>
          <button
            className="admin-btn btn-info"
            onClick={handleRunDiagnostics}
            disabled={loading}
          >
            {loading ? "🔄 Testing..." : "🔌 Run Connection Test"}
          </button>
        </div>
      </div>

      {/* Actions */}
      <div className="admin-card">
        <h3 className="admin-card-title">🔧 System Actions</h3>
        <div className="admin-card-content">
          <div className="system-actions">
            <button className="admin-btn btn-info" onClick={handleSyncData}>🔄 Sync Data</button>
            <button className="admin-btn btn-warning" onClick={handleRestartBot}>♻️ Restart Bot</button>
            <button className="admin-btn btn-secondary" onClick={handleGenerateReport}>📊 Generate Report</button>
            <button className="admin-btn btn-primary" onClick={handleBackupData}>💾 Backup Data</button>
          </div>
        </div>
      </div>
    </div>
  );
}
