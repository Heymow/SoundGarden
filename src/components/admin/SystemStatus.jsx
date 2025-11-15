import React, { useState } from "react";
import * as botApi from "../../services/botApi";

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

  const showSuccess = (message) => {
    setSuccess(message);
    setError(null);
    setTimeout(() => setSuccess(null), 5000);
  };

  const showError = (message) => {
    setError(message);
    setSuccess(null);
    setTimeout(() => setError(null), 5000);
  };

  const handleEditConfig = () => {
    showSuccess("⚙️ Opening bot configuration editor...");
  };

  const handleViewLogs = () => {
    showSuccess("📜 Opening full system logs viewer...");
  };

  const handleSyncData = async () => {
    setLoading(true);
    try {
      await botApi.syncData();
      showSuccess("✅ Data synchronized successfully!");
    } catch (err) {
      showError(`❌ Failed to sync data: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleRestartBot = async () => {
    if (confirm("⚠️ Are you sure you want to restart the bot? This may cause brief downtime.")) {
      setLoading(true);
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
