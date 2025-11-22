import React, { useState, useEffect, useRef } from "react";
import * as botApi from "../../services/botApi";
import { useAdminOverlay } from "../../context/AdminOverlay";

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
  const [safeModeEnabled, setSafeModeEnabled] = useState(false);
  const fileInputRef = useRef(null);
  const [latestBackup, setLatestBackup] = useState(null);
  const [backups, setBackups] = useState([]);
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
    if (!(await overlay.confirm("⚠️ Are you sure you want to restart the bot? This may cause brief downtime."))) return;
    await overlay.blockingRun('Restarting bot...', async () => {
      overlay.startAction('restart_bot');
      await botApi.restartBot();
      setSystemHealth(prev => ({ ...prev, botOnline: false }));
      showSuccess("♻️ Bot restart initiated...");
      setTimeout(() => {
        setSystemHealth(prev => ({ ...prev, botOnline: true }));
      }, 3000);
      overlay.endAction('restart_bot');
    });
  };

  const handleGenerateReport = () => {
    showSuccess("📊 Generating system report...");
  };

  const handleBackupData = async () => {
    if (!(await overlay.confirm("Create a backup of all competition data?"))) return;
    await overlay.blockingRun('Creating backup...', async () => {
      overlay.startAction('backup_data');
      const res = await botApi.backupData();
      if (!res || (typeof res.success !== 'undefined' && !res.success)) {
        // Show server-provided message if available
        showError(`❌ Backup failed: ${res?.message || 'Unknown error'}`);
        overlay.endAction('backup_data');
        return;
      }
      // If server returns a backup payload, download it
      if (res && res.backup) {
        try {
          const blob = new Blob([JSON.stringify(res.backup, null, 2)], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `collabwarz-backup-${res.backup.guild_id || 'unknown'}-${new Date().toISOString()}.json`;
          document.body.appendChild(a);
          a.click();
          a.remove();
          URL.revokeObjectURL(url);
        } catch (err) {
          console.warn('Failed to download backup file', err);
        }
      }
      showSuccess("💾 Backup created successfully!");
      try {
        const list = await botApi.getBackups();
        if (list && Array.isArray(list.backups)) {
          setBackups(list.backups);
          if (list.backups.length > 0) setLatestBackup(list.backups[0]);
        }
      } catch (e) { }
      overlay.endAction('backup_data');
    });
  };

  const handleRestoreClick = () => {
    if (fileInputRef.current) fileInputRef.current.click();
  };

  const handleRestoreFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const backup = JSON.parse(text);
      // Show a quick preview of differences and confirm
      const currentStatus = await botApi.getAdminStatus().catch(() => ({}));
      const previewText = buildBackupPreview(currentStatus, backup);
      if (!(await overlay.confirm(`Preview changes:\n\n${previewText}\n\nProceed with restore?`))) return;
      await overlay.blockingRun('Restoring backup...', async () => {
        overlay.startAction('restore_backup');
        try {
          const res = await botApi.restoreBackup(backup);
          if (res && res.success) {
            showSuccess('✅ Backup restored successfully!');
            // Refresh admin status and backup list
            const updatedStatus = await botApi.getAdminStatus().catch(() => ({}));
            if (updatedStatus && typeof updatedStatus.safe_mode_enabled !== 'undefined') setSafeModeEnabled(!!updatedStatus.safe_mode_enabled);
            try {
              const list = await botApi.getBackups();
              if (list && Array.isArray(list.backups)) {
                setBackups(list.backups);
                if (list.backups.length > 0) setLatestBackup(list.backups[0]);
              }
            } catch (e) { }
          } else {
            showError(`❌ Restore failed: ${res?.message || 'Unknown error'}`);
          }
        } catch (err) {
          showError(`❌ Restore failed: ${err.message}`);
        } finally {
          overlay.endAction('restore_backup');
        }
      });
    } catch (err) {
      showError('❌ Failed to read backup file or invalid JSON');
    } finally {
      e.target.value = '';
    }
  };

  const handleToggleSafeMode = async () => {
    const newVal = !safeModeEnabled;
    if (!(await overlay.confirm(`${newVal ? 'Enable' : 'Disable'} Safe Mode? This will ${newVal ? 'block' : 'allow'} destructive admin actions.`))) return;
    await overlay.blockingRun(`${newVal ? 'Enabling' : 'Disabling'} Safe Mode...`, async () => {
      overlay.startAction('set_safe_mode');
      try {
        const res = await botApi.setSafeMode(newVal);
        if (res && res.success) {
          setSafeModeEnabled(newVal);
          showSuccess(`✅ Safe Mode ${newVal ? 'enabled' : 'disabled'}`);
        } else {
          showError(`❌ Failed to set Safe Mode: ${res?.message || 'Unknown error'}`);
        }
      } catch (err) {
        showError(`❌ Failed to set Safe Mode: ${err.message}`);
      } finally {
        overlay.endAction('set_safe_mode');
      }
    });
  };

  const handleRestoreLastBackup = async () => {
    if (!latestBackup) return;
    try {
      const filename = latestBackup.file || latestBackup.backup_file;
      if (!filename) { showError('❌ No backup filename available'); return; }
      const data = await botApi.downloadBackup(filename);
      if (!data || !data.backup) { showError('❌ Failed to fetch latest backup'); return; }
      const backup = data.backup;
      const currentStatus = await botApi.getAdminStatus().catch(() => ({}));
      const previewText = buildBackupPreview(currentStatus, backup);
      if (!(await overlay.confirm(`Preview changes for last backup:\n\n${previewText}\n\nProceed with restore?`))) return;
      await overlay.blockingRun('Restoring backup...', async () => {
        overlay.startAction('restore_backup');
        const res = await botApi.restoreBackup(backup);
        if (res && res.success) {
          showSuccess('✅ Last backup restored successfully');
          try {
            const list = await botApi.getBackups();
            if (list && Array.isArray(list.backups)) {
              setBackups(list.backups);
              if (list.backups.length > 0) setLatestBackup(list.backups[0]);
            }
          } catch (e) { }
        } else {
          showError(`❌ Restore failed: ${res?.message || 'Unknown error'}`);
        }
        overlay.endAction('restore_backup');
      })
    } catch (err) { showError(`❌ Restore failed: ${err.message}`); }
  };

  useEffect(() => {
    // Fetch the current admin status to initialize safe mode toggle
    const fetchStatus = async () => {
      try {
        const status = await botApi.getAdminStatus();
        if (status && typeof status.safe_mode_enabled !== 'undefined') {
          setSafeModeEnabled(!!status.safe_mode_enabled);
        }
      } catch (err) {
        console.warn('Failed to get admin status', err);
      }
    };
    fetchStatus();
    const loadBackups = async () => {
      try {
        const list = await botApi.getBackups();
        if (list && Array.isArray(list.backups)) {
          setBackups(list.backups);
          if (list.backups.length > 0) setLatestBackup(list.backups[0]);
        }
      } catch (e) {
        console.warn('Failed to load backups:', e);
        showError('⚠️ Failed to load backups from server (not implemented on this instance)');
      }
    };
    loadBackups();
  }, []);

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

  // Simple preview diff builder (returns a short string listing only differences)
  const buildBackupPreview = (current = {}, backup = {}) => {
    const diffs = [];
    try {
      if (backup.current_theme && backup.current_theme !== current.theme) {
        diffs.push(`Theme: ${current.theme || '<none>'} -> ${backup.current_theme}`);
      }
      if (backup.current_phase && backup.current_phase !== current.phase) {
        diffs.push(`Phase: ${current.phase || '<none>'} -> ${backup.current_phase}`);
      }
      if (backup.submitted_teams) {
        const currentCount = (current.submitted_teams && Object.keys(current.submitted_teams).length) || 0;
        const backupCount = Object.keys(backup.submitted_teams || {}).length;
        if (currentCount !== backupCount) diffs.push(`Submitted teams: ${currentCount} -> ${backupCount}`);
      }
      if (backup.submissions) {
        const cur = current.submissions || {};
        const curKeys = new Set(Object.keys(cur));
        const bkKeys = new Set(Object.keys(backup.submissions || {}));
        const added = [...bkKeys].filter(k => !curKeys.has(k));
        const removed = [...curKeys].filter(k => !bkKeys.has(k));
        if (added.length) diffs.push(`Submissions added: ${added.slice(0, 5).join(', ')}${added.length > 5 ? '...' : ''}`);
        if (removed.length) diffs.push(`Submissions removed: ${removed.slice(0, 5).join(', ')}${removed.length > 5 ? '...' : ''}`);
      }
      if (diffs.length === 0) return 'No major differences detected';
      return diffs.join('\n');
    } catch (e) {
      return 'Preview unavailable';
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

      {/* Backups List */}
      <div className="admin-card">
        <h3 className="admin-card-title">💾 Backups</h3>
        <div className="admin-card-content">
          {backups.length === 0 ? (
            <div>No backups available</div>
          ) : (
            <div className="backup-list">
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left' }}>File</th>
                    <th style={{ textAlign: 'left' }}>Created</th>
                    <th style={{ textAlign: 'left' }}>By</th>
                    <th style={{ textAlign: 'left' }}>Size</th>
                    <th style={{ textAlign: 'left' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {backups.map((b) => (
                    <tr key={b.file} style={{ borderTop: '1px solid #eee' }}>
                      <td style={{ padding: '8px' }}>{b.file}</td>
                      <td style={{ padding: '8px' }}>{new Date(b.ts).toLocaleString()}</td>
                      <td style={{ padding: '8px' }}>{(b.created_by && (b.created_by.display_name || b.created_by.user_id)) || 'Unknown'}</td>
                      <td style={{ padding: '8px' }}>{Math.round((b.size || 0) / 1024)} KB</td>
                      <td style={{ padding: '8px' }}>
                        <button className="admin-btn btn-info" onClick={async () => {
                          try {
                            const data = await botApi.downloadBackup(b.file);
                            if (data && data.backup) {
                              const blob = new Blob([JSON.stringify(data.backup, null, 2)], { type: 'application/json' });
                              const url = URL.createObjectURL(blob);
                              const a = document.createElement('a');
                              a.href = url;
                              a.download = b.file;
                              document.body.appendChild(a);
                              a.click();
                              a.remove();
                              URL.revokeObjectURL(url);
                            }
                          } catch (e) { console.warn('Failed to download backup:', e); }
                        }}>⬇️</button>
                        <button className="admin-btn btn-warning" onClick={async () => {
                          if (safeModeEnabled) { showError('Restore blocked: Safe Mode is enabled'); return; }
                          try {
                            const data = await botApi.downloadBackup(b.file);
                            if (!data || !data.backup) { showError('Failed to fetch backup'); return; }
                            const backupObj = data.backup;
                            const currentStatus = await botApi.getAdminStatus().catch(() => ({}));
                            const previewText = buildBackupPreview(currentStatus, backupObj);
                            if (!(await overlay.confirm(`Preview changes:\n\n${previewText}\n\nProceed with restore?`))) return;
                            await overlay.blockingRun('Restoring backup...', async () => {
                              overlay.startAction('restore_backup');
                              const res = await botApi.restoreBackup(backupObj);
                              if (res && res.success) {
                                showSuccess('✅ Backup restored successfully');
                                // Refresh status and list
                                const updatedStatus = await botApi.getAdminStatus().catch(() => ({}));
                                if (updatedStatus && typeof updatedStatus.safe_mode_enabled !== 'undefined') setSafeModeEnabled(!!updatedStatus.safe_mode_enabled);
                                try {
                                  const list = await botApi.getBackups();
                                  if (list && Array.isArray(list.backups)) {
                                    setBackups(list.backups);
                                    if (list.backups.length > 0) setLatestBackup(list.backups[0]);
                                  }
                                } catch (e) { }
                              } else {
                                showError(`❌ Restore failed: ${res?.message || 'Unknown error'}`);
                              }
                              overlay.endAction('restore_backup');
                            })
                          } catch (e) { showError(`Restore failed: ${e?.message || e}`); }
                        }} disabled={safeModeEnabled}>♻️</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
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
            <div className="config-item">
              <span className="config-label">Safe Mode:</span>
              <span className="config-value">{safeModeEnabled ? 'Enabled' : 'Disabled'}</span>
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
            <button
              className="admin-btn btn-info"
              onClick={handleSyncData}
              disabled={!safeModeEnabled}
              title={!safeModeEnabled ? 'Enable Safe Mode in System Settings to run Sync Data' : ''}
            >🔄 Sync Data</button>
            <button className="admin-btn btn-warning" onClick={handleRestartBot}>♻️ Restart Bot</button>
            <button className="admin-btn btn-secondary" onClick={handleGenerateReport}>📊 Generate Report</button>
            <button className="admin-btn btn-primary" onClick={handleBackupData}>💾 Backup Data</button>
            <button className="admin-btn btn-info" disabled={!latestBackup} onClick={async () => {
              if (!latestBackup) return;
              const filename = latestBackup.file || latestBackup.backup_file;
              if (!filename) { showError('❌ No latest backup filename available'); return; }
              try {
                const data = await botApi.downloadBackup(filename);
                if (data && data.backup) {
                  const blob = new Blob([JSON.stringify(data.backup, null, 2)], { type: 'application/json' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = filename;
                  document.body.appendChild(a);
                  a.click();
                  a.remove();
                  URL.revokeObjectURL(url);
                  showSuccess('✅ Backup downloaded');
                } else {
                  showError('❌ Failed to download latest backup');
                }
              } catch (e) { console.warn('Failed to download latest backup:', e); showError('❌ Failed to download latest backup'); }
            }}>⬇️ Download Last Backup</button>
            <button className="admin-btn btn-secondary" onClick={handleRestoreClick} disabled={safeModeEnabled}>♻️ Recover from Backup (Upload)</button>
            <button className="admin-btn btn-warning" onClick={handleRestoreLastBackup} disabled={!latestBackup || safeModeEnabled}>♻️ Restore Last Backup</button>
            <input ref={fileInputRef} type="file" accept="application/json" style={{ display: 'none' }} onChange={handleRestoreFile} />
            <button className={`admin-btn ${safeModeEnabled ? 'btn-secondary' : 'btn-info'}`} onClick={handleToggleSafeMode}>
              {safeModeEnabled ? '🔒 Safe Mode ON' : '🔓 Safe Mode OFF'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
