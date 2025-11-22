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
  const [currentIssue, setCurrentIssue] = useState(null);
  const [serverInfo, setServerInfo] = useState(null);
  const [adminConfig, setAdminConfig] = useState(null);
  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [configDraft, setConfigDraft] = useState(null);
  const [channels, setChannels] = useState([]);
  const [channelsError, setChannelsError] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [logsModalOpen, setLogsModalOpen] = useState(false);
  const [logsData, setLogsData] = useState([]);
  const overlay = useAdminOverlay();

  const showSuccess = (message) => overlay.showAlert('success', message);
  const showError = (message) => overlay.showAlert('error', message);

  const handleEditConfig = async () => {
    try {
      // Fetch channels first so we can try to resolve existing configured channels into the dropdown
      try {
        const chRes = await botApi.getAdminChannels();
        if (chRes && Array.isArray(chRes.channels) && chRes.channels.length > 0) setChannels(chRes.channels);
        else if (chRes && chRes.success === false && chRes.message) showError(`⚠️ Failed to load channels: ${chRes.message}`);
        else if (chRes && Array.isArray(chRes.channels) && chRes.channels.length === 0) showError('⚠️ Channel list empty - check that the bot is in the guild and has permission to list channels.');
      } catch (e) {
        console.warn("Failed to load channels", e);
        showError(`⚠️ Failed to load channels: ${e?.message || e}`);
      }

      const cfg = await botApi.getAdminConfig();
      if (cfg && cfg.config) {
        setAdminConfig(cfg.config);
        // Normalize channel fields for the dropdowns - prefer the channel id as string
        const normalizeChannelForDraft = (val) => {
          if (!val && val !== 0) return "";
          if (typeof val === "number") return String(val);
          if (typeof val === "string") {
            const m = val.match(/^<#(\d+)>$/);
            if (m) return m[1];
            if (/^\d+$/.test(val)) return val;
            // unknown format - keep as raw in "__other"
            return "__other";
          }
          return "";
        };

        const draft = { ...cfg.config };
        // Convert numeric ids / mentions to plain id strings for selects
        for (const c of ["announcement_channel", "submission_channel", "test_channel"]) {
          const raw = cfg.config?.[c];
          const parsed = normalizeChannelForDraft(raw);
          if (parsed === "__other") {
            draft[c] = "__other";
            draft[`${c}_raw`] = raw;
          } else {
            // If channels exist, ensure parsed id matches a known channel, otherwise treat as __other
            if (channels && channels.length > 0) {
              const found = channels.find(ch => ch.id === String(parsed));
              if (found) {
                draft[c] = parsed || "";
                if (draft[`${c}_raw`]) delete draft[`${c}_raw`];
              } else if (parsed) {
                draft[c] = "__other";
                draft[`${c}_raw`] = raw;
              } else {
                draft[c] = "";
                if (draft[`${c}_raw`]) delete draft[`${c}_raw`];
              }
            } else {
              draft[c] = parsed || "";
              if (draft[`${c}_raw`]) delete draft[`${c}_raw`];
            }
          }
        }

        // If there are configured channel ids missing from the channel list, add placeholders
        try {
          const addMissing = (field) => {
            const val = draft[field];
            if (!val || val === '__other') return;
            const idStr = String(val);
            const found = (channels || []).some(ch => ch.id === idStr);
            if (!found) {
              setChannels(prev => {
                const exists = (prev || []).some(ch => ch.id === idStr);
                if (exists) return prev;
                const appended = [{ id: idStr, name: `${idStr}`, display: `${idStr}` }, ...(prev || [])];
                return appended;
              });
            }
          };
          addMissing('announcement_channel');
          addMissing('submission_channel');
          addMissing('test_channel');
        } catch (e) { console.warn('Failed to add missing channels to dropdown', e); }
        setConfigDraft(draft);
        setSaveSuccess(false);
        setConfigModalOpen(true);
      } else {
        showError("❌ Failed to load bot configuration");
      }
    } catch (err) {
      showError(`❌ Failed to load config: ${err.message}`);
    }
  };

  const handleViewLogs = async () => {
    try {
      const logResponse = await botApi.getCompetitionLogs();
      if (logResponse && logResponse.logs) {
        setLogsData(logResponse.logs);
        setLogsModalOpen(true);
      } else {
        showError('❌ Failed to fetch logs');
      }
    } catch (err) {
      showError(`❌ Failed to fetch logs: ${err.message}`);
    }
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

  // Note: The previous 'Restart Bot' action was removed because it requires platform-level access.
  // Keep a placeholder function for future platform integration if needed.

  const handleGenerateReport = () => {
    const report = {
      timestamp: new Date().toISOString(),
      systemHealth,
      safeModeEnabled,
      backups: backups.map(b => ({
        file: b.file || b.backup_file,
        created_at: b.created_at,
        size: b.size || 'unknown'
      })),
      totalBackups: backups.length,
      latestBackup: latestBackup ? {
        file: latestBackup.file || latestBackup.backup_file,
        created_at: latestBackup.created_at
      } : null
    };

    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `system-report-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    showSuccess("📊 System report generated and downloaded");
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

  const handleConfigSave = async () => {
    if (!configDraft) return;
    // Build updates: compare with adminConfig
    const normalizedDraft = { ...configDraft };
    // Normalize channel fields for sending: use raw if __other
    for (const c of ["announcement_channel", "submission_channel", "test_channel"]) {
      if (normalizedDraft[c] === '__other') {
        normalizedDraft[c] = normalizedDraft[`${c}_raw`] || '';
      }
      // convert plain numeric string to number
      if (typeof normalizedDraft[c] === 'string' && /^\d+$/.test(normalizedDraft[c])) {
        normalizedDraft[c] = Number(normalizedDraft[c]);
      }
    }
    const updates = {};
    Object.keys(normalizedDraft).forEach((k) => {
      // skip raw helper fields
      if (k.endsWith('_raw')) return;
      const draftVal = normalizedDraft[k];
      const existingVal = adminConfig?.[k];
      if (String(draftVal) !== String(existingVal || '')) updates[k] = draftVal;
    });
    if (Object.keys(updates).length === 0) { showError('No changes to save'); return; }
    setIsSaving(true);
    setSaveSuccess(false);
    await overlay.blockingRun('Applying configuration...', async () => {
      overlay.startAction('update_config');
      try {
        // Pre-parse channel mentions: <#123> or numeric strings - these may still be strings
        for (const c of ['announcement_channel', 'submission_channel', 'test_channel']) {
          if (typeof updates[c] === 'string') {
            const m = updates[c].match(/^<#(\d+)>$/);
            if (m) updates[c] = Number(m[1]);
            else if (/^\d+$/.test(updates[c])) updates[c] = Number(updates[c]);
          }
        }
        const res = await botApi.updateAdminConfig(updates);
        if (res && res.success) {
          showSuccess('✅ Configuration update queued');
          setConfigModalOpen(false);
          // Poll the server to get the updated config once the cog has applied it
          let attempts = 0;
          const maxAttempts = 12;
          while (attempts < maxAttempts) {
            try {
              const newcfg = await botApi.getAdminConfig();
              if (newcfg && newcfg.config) {
                setAdminConfig(newcfg.config);
                const changed = Object.keys(updates).some(k => String(newcfg.config[k]) !== String(adminConfig?.[k] || ''));
                // If new config contains the latest values, stop polling
                const allMatch = Object.keys(updates).every(k => String(newcfg.config[k]) === String(updates[k]));
                if (allMatch) break;
              }
            } catch (e) { /* ignore and continue polling */ }
            attempts++;
            await new Promise(r => setTimeout(r, 1000));
          }
          setSaveSuccess(true);
          setTimeout(() => setSaveSuccess(false), 4000);
        } else {
          showError(`❌ Failed to update config: ${res?.message || 'unknown'}`);
        }
      } catch (err) {
        showError(`❌ Failed to update config: ${err.message}`);
      } finally {
        overlay.endAction('update_config');
      }
    });
    setIsSaving(false);
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

  const fetchChannels = async () => {
    try {
      const ch = await botApi.getAdminChannels();
      if (ch && Array.isArray(ch.channels) && ch.channels.length > 0) {
        setChannels(ch.channels);
        setChannelsError(null);
        return ch.channels;
      } else {
        // If server returned an error, surface it; otherwise, display a helpful warning
        if (ch && ch.success === false && ch.message) {
          showError(`⚠️ Failed to load channels: ${ch.message}`);
          setChannelsError(ch.message);
        } else {
          // Use available server info if present to help diagnostics
          const guildId = serverInfo?.guildInfo?.id || null;
          const msg = 'Channel list returned empty. Ensure the bot is in the configured guild and has permission to view channels.';
          showError(`⚠️ ${msg}`);
          setChannelsError(msg);
          console.warn('Admin channels endpoint returned empty or malformed list', ch);
        }
      }
    } catch (e) {
      console.warn('Failed to load admin channels:', e);
      const message = `Failed to load channels: ${e?.message || e}`;
      showError(`⚠️ ${message}`);
      setChannelsError(message);
      return null;
    }
  };

  const handleRefreshChannels = async () => {
    const res = await fetchChannels();
    if (res && res.length > 0) showSuccess(`✅ Channels refreshed (${res.length})`);
    else showError('⚠️ No channels available after refresh');
  };

  const handleTestBotToken = async () => {
    try {
      const res = await botApi.testBotToken();
      if (res && res.success) {
        showSuccess(`✅ Bot token valid: ${res.data && res.data.username ? res.data.username : 'bot user'}`);
      } else {
        showError(`❌ Bot token test failed: ${res?.message || 'Unknown'}`);
      }
    } catch (err) {
      showError(`❌ Bot token test failed: ${err?.message || err}`);
    }
  };

  useEffect(() => {
    // Fetch the current admin status to initialize safe mode toggle
    const fetchStatus = async () => {
      try {
        const status = await botApi.getAdminStatus();
        if (status && typeof status.safe_mode_enabled !== 'undefined') {
          setSafeModeEnabled(!!status.safe_mode_enabled);
        }
        setCurrentIssue(null); // Clear issue if successful
      } catch (err) {
        console.warn('Failed to get admin status', err);
        setCurrentIssue('Getting HTML error "Cannot GET /api/admin/status". This means the bot API server is not running, not accessible, or authentication failed.');
      }
    };
    fetchStatus();
    const loadSystemInfo = async () => {
      try {
        const sys = await botApi.getAdminSystem();
        if (sys && sys.diagnostics) setServerInfo(sys.diagnostics);
      } catch (e) {
        console.warn('Failed to get admin system diagnostics:', e);
      }
    };
    loadSystemInfo();
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
    const loadConfig = async () => {
      try {
        const cfg = await botApi.getAdminConfig();
        if (cfg && cfg.config) setAdminConfig(cfg.config);
      } catch (e) {
        console.warn('Failed to load admin config:', e);
      }
    };
    loadConfig();
    fetchChannels();
    // Also refresh serverInfo that includes cog status when opening the screen
    // Do not show toast when automatically refreshing on mount
    refreshSystemInfo(false);
    // Fetch recent competition logs at mount
    const loadLogs = async () => {
      try {
        const logResponse = await botApi.getCompetitionLogs();
        if (logResponse && Array.isArray(logResponse.logs)) {
          setLogsData(logResponse.logs || []);
        }
      } catch (e) {
        console.warn('Failed to load competition logs:', e);
      }
    };
    loadLogs();
  }, []);

  const refreshSystemInfo = async (showToast = false) => {
    try {
      const sys = await botApi.getAdminSystem();
      if (sys && sys.diagnostics) {
        setServerInfo(sys.diagnostics);
        if (showToast) showSuccess('✅ Server info refreshed');
      }
      // Also attempt to refresh channel list if any change may occur
      await fetchChannels();
    } catch (e) { showError('❌ Failed to refresh server info'); }
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
        setCurrentIssue(null);
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
          {channelsError && (
            <div style={{ marginBottom: '8px', color: 'var(--admin-text-muted)' }}>
              ⚠️ {channelsError}
            </div>
          )}
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
              <span className="config-value">{adminConfig?.announcement_channel_display || adminConfig?.announcement_channel || serverInfo?.announcement_channel || 'Not configured'}</span>
            </div>
            <div className="config-item">
              <span className="config-label">Submission Channel:</span>
              <span className="config-value">{adminConfig?.submission_channel_display || adminConfig?.submission_channel || serverInfo?.submission_channel || 'Not configured'}</span>
            </div>
            <div className="config-item">
              <span className="config-label">Test Channel:</span>
              <span className="config-value">{adminConfig?.test_channel_display || adminConfig?.test_channel || serverInfo?.test_channel || 'Not configured'}</span>
            </div>
            <div className="config-item">
              <span className="config-label">Auto-Announce:</span>
              <span className="config-value">{(adminConfig && adminConfig.auto_announce) || serverInfo?.automation_enabled ? 'Enabled' : 'Disabled'}</span>
            </div>
            <div className="config-item">
              <span className="config-label">Require Confirmation:</span>
              <span className="config-value">{(adminConfig && adminConfig.require_confirmation) || serverInfo?.require_confirmation ? 'Enabled' : 'Disabled'}</span>
            </div>
            <div className="config-item">
              <span className="config-label">Safe Mode:</span>
              <span className="config-value">{safeModeEnabled ? 'Enabled' : 'Disabled'}</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="admin-btn btn-secondary" onClick={handleEditConfig}>Edit Configuration</button>
            <button className="admin-btn btn-info" onClick={async () => { try { const cfg = await botApi.getAdminConfig(); if (cfg && cfg.config) setAdminConfig(cfg.config); showSuccess('✅ Config refreshed'); } catch (e) { showError('❌ Failed to refresh config'); } }}>Refresh Configuration</button>
            <button className="admin-btn btn-secondary" onClick={handleTestBotToken}>🔐 Test Bot Token</button>
          </div>
        </div>
      </div>

      {/* Server Info */}
      <div className="admin-card">
        <h3 className="admin-card-title">🖥️ Server Information</h3>
        <div className="admin-card-content">
          <div className="server-info-grid">
            <div className="info-item">
              <span className="info-label">Bot Version:</span>
              <span className="info-value">{serverInfo?.cogVersion || serverInfo?.cog_version || 'Unknown'}</span>
            </div>
            <div className="info-item">
              <span className="info-label">Server Uptime:</span>
              <span className="info-value">{serverInfo?.serverUptimeReadable || 'Unknown'}</span>
            </div>
            <div className="info-item">
              <span className="info-label">Bot Uptime:</span>
              <span className="info-value">{serverInfo?.cogUptimeReadable || serverInfo?.cog_uptime_readable || 'Unknown'}</span>
            </div>
            <div className="info-item">
              <span className="info-label">Server Members:</span>
              <span className="info-value">{serverInfo?.guildInfo?.member_count ? `${serverInfo.guildInfo.member_count} members` : (serverInfo?.guildInfo?.id ? 'Unknown' : 'Not configured')}</span>
            </div>
            <div className="info-item">
              <span className="info-label">Guild:</span>
              <span className="info-value">{serverInfo?.guildInfo?.name || serverInfo?.guildInfo?.id || 'Not configured'}</span>
            </div>
            <div className="info-item">
              <span className="info-label">Command Prefix:</span>
              <span className="info-value">{serverInfo?.commandPrefix || serverInfo?.command_prefix || '!cw'}</span>
            </div>
          </div>
          <div style={{ marginTop: '10px' }}>
            <button className="admin-btn btn-secondary" onClick={() => refreshSystemInfo(true)}>🔄 Refresh Server Info</button>
          </div>
        </div>
      </div>

      {/* Logs */}
      <div className="admin-card">
        <h3 className="admin-card-title">📜 System Logs</h3>
        <div className="admin-card-content">
          <div className="log-viewer">
            {logsData && logsData.length > 0 ? (
              // show up to 4 latest logs
              logsData.slice(-4).map((log, index) => (
                <div key={index} className={`log-entry log-${log.level?.toLowerCase() || 'info'}`}>
                  <span className="log-time">{log.timestamp ? new Date(log.timestamp).toLocaleString() : 'Unknown'}</span>
                  <span className="log-level">{log.level || 'INFO'}</span>
                  <span className="log-message">{log.message || JSON.stringify(log)}</span>
                </div>
              ))
            ) : (
              <div className="log-entry log-empty">
                <span className="log-message">No logs available</span>
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
            <button className="admin-btn btn-secondary" onClick={handleViewLogs}>View Full Logs</button>
            <button className="admin-btn btn-info" onClick={async () => {
              try {
                const logResponse = await botApi.getCompetitionLogs();
                if (logResponse && Array.isArray(logResponse.logs)) setLogsData(logResponse.logs || []);
                showSuccess('✅ Logs refreshed');
              } catch (e) { showError('❌ Failed to refresh logs'); }
            }}>Refresh Logs</button>
          </div>
        </div>
      </div>

      {/* Diagnostics */}
      <div className="admin-card">
        <h3 className="admin-card-title">🔍 Connection Diagnostics</h3>
        <div className="admin-card-content">
          <div className="diagnostic-info">
            <p>Test the connection between the admin panel and the Discord bot API server.</p>
            {currentIssue && (
              <div className="error-info" style={{ background: '#fff3cd', padding: '10px', borderRadius: '5px', margin: '10px 0' }}>
                <strong>🚨 Current Issue:</strong> {currentIssue}
              </div>
            )}
            {currentIssue && (
              <>
                <p><strong>Fix this by running these Discord commands:</strong></p>
                <ol>
                  <li><code>!cw help</code> - Verify the bot is loaded and responding</li>
                  <li><code>!cw apiserver start</code> - Start the API server</li>
                  <li><code>!cw apiserver status</code> - Confirm it's running</li>
                  <li><code>!cw admintoken debug</code> - Check configuration</li>
                  <li>If still failing, try <code>!cw apiconfig cors *</code> to allow all origins</li>
                </ol>
                <p><strong>Expected result:</strong> API server should start on a port (usually 8080)</p>
              </>
            )}
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
            {/* Restart Bot removed: controlled at platform level */}
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

      {/* Logs Modal */}
      {logsModalOpen && (
        <div className="admin-modal-overlay" onClick={() => setLogsModalOpen(false)}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h3>📜 System Logs</h3>
              <button className="admin-modal-close" onClick={() => setLogsModalOpen(false)}>×</button>
            </div>
            <div className="admin-modal-content">
              <div className="log-viewer">
                {logsData.length > 0 ? logsData.map((log, index) => (
                  <div key={index} className={`log-entry log-${log.level?.toLowerCase() || 'info'}`}>
                    <span className="log-time">{log.timestamp || 'Unknown'}</span>
                    <span className="log-level">{log.level || 'INFO'}</span>
                    <span className="log-message">{log.message || log}</span>
                  </div>
                )) : (
                  <p>No logs available</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Config Modal */}
      {configModalOpen && (
        <div className="admin-modal-overlay" onClick={() => setConfigModalOpen(false)}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h3>⚙️ Edit Bot Configuration {isSaving ? ' - Saving…' : (saveSuccess ? ' - Saved ✓' : '')}</h3>
              <button className="admin-modal-close" onClick={() => { setIsSaving(false); setSaveSuccess(false); setConfigModalOpen(false); }}>×</button>
            </div>
            <div className="admin-modal-content">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <p style={{ color: 'var(--admin-text-muted)', margin: 0 }}>Changes are queued and will be applied by the cog shortly.</p>
                <button className="admin-btn btn-secondary" style={{ marginLeft: 'auto' }} onClick={handleRefreshChannels}>🔁 Refresh Channels</button>
              </div>
              <div className="config-edit-grid">
                {channels.length === 0 && (
                  <div style={{ marginBottom: 8, color: 'var(--admin-text-muted)' }}>
                    {channelsError ? `⚠️ ${channelsError}` : '⚠️ Channel list not available. Ensure the server is configured with the bot token or enter channels via "Other..." as an ID or mention.'}
                  </div>
                )}
                <label>Announcement Channel (id or mention)</label>
                <select value={configDraft?.announcement_channel ?? ''} onChange={(e) => {
                  const v = e.target.value;
                  if (v === '__other') setConfigDraft(prev => ({ ...(prev || {}), announcement_channel: '__other', announcement_channel_raw: '' }));
                  else setConfigDraft(prev => ({ ...(prev || {}), announcement_channel: v, announcement_channel_raw: undefined }));
                }}>
                  <option value="">Not configured</option>
                  {channels.map(c => <option key={c.id} value={c.id}>{`#${c.name}`}</option>)}
                  <option value="__other">Other...</option>
                </select>
                {configDraft?.announcement_channel === '__other' && (
                  <input type="text" placeholder="id or <#id>" value={configDraft?.announcement_channel_raw || ''} onChange={(e) => setConfigDraft(prev => ({ ...(prev || {}), announcement_channel_raw: e.target.value }))} />
                )}

                <label>Submission Channel</label>
                <select value={configDraft?.submission_channel ?? ''} onChange={(e) => {
                  const v = e.target.value;
                  if (v === '__other') setConfigDraft(prev => ({ ...(prev || {}), submission_channel: '__other', submission_channel_raw: '' }));
                  else setConfigDraft(prev => ({ ...(prev || {}), submission_channel: v, submission_channel_raw: undefined }));
                }}>
                  <option value="">Not configured</option>
                  {channels.map(c => <option key={c.id} value={c.id}>{`#${c.name}`}</option>)}
                  <option value="__other">Other...</option>
                </select>
                {configDraft?.submission_channel === '__other' && (
                  <input type="text" placeholder="id or <#id>" value={configDraft?.submission_channel_raw || ''} onChange={(e) => setConfigDraft(prev => ({ ...(prev || {}), submission_channel_raw: e.target.value }))} />
                )}

                <label>Test Channel</label>
                <select value={configDraft?.test_channel ?? ''} onChange={(e) => {
                  const v = e.target.value;
                  if (v === '__other') setConfigDraft(prev => ({ ...(prev || {}), test_channel: '__other', test_channel_raw: '' }));
                  else setConfigDraft(prev => ({ ...(prev || {}), test_channel: v, test_channel_raw: undefined }));
                }}>
                  <option value="">Not configured</option>
                  {channels.map(c => <option key={c.id} value={c.id}>{`#${c.name}`}</option>)}
                  <option value="__other">Other...</option>
                </select>
                {configDraft?.test_channel === '__other' && (
                  <input type="text" placeholder="id or <#id>" value={configDraft?.test_channel_raw || ''} onChange={(e) => setConfigDraft(prev => ({ ...(prev || {}), test_channel_raw: e.target.value }))} />
                )}

                <label className="checkbox-row">Auto-Announce</label>
                <div className="checkbox-row">
                  <input type="checkbox" checked={!!configDraft?.auto_announce} onChange={(e) => setConfigDraft(prev => ({ ...(prev || {}), auto_announce: e.target.checked }))} />
                  <span style={{ color: 'var(--admin-text-muted)' }}>{configDraft?.auto_announce ? 'Enabled' : 'Disabled'}</span>
                </div>

                <label className="checkbox-row">Require Confirmation</label>
                <div className="checkbox-row">
                  <input type="checkbox" checked={!!configDraft?.require_confirmation} onChange={(e) => setConfigDraft(prev => ({ ...(prev || {}), require_confirmation: e.target.checked }))} />
                  <span style={{ color: 'var(--admin-text-muted)' }}>{configDraft?.require_confirmation ? 'Enabled' : 'Disabled'}</span>
                </div>

                <label className="checkbox-row">Safe Mode</label>
                <div className="checkbox-row">
                  <input type="checkbox" checked={!!configDraft?.safe_mode_enabled} onChange={(e) => setConfigDraft(prev => ({ ...(prev || {}), safe_mode_enabled: e.target.checked }))} />
                  <span style={{ color: 'var(--admin-text-muted)' }}>{configDraft?.safe_mode_enabled ? 'Enabled' : 'Disabled'}</span>
                </div>

                <label className="checkbox-row">Use Everyone Ping</label>
                <div className="checkbox-row">
                  <input type="checkbox" checked={!!configDraft?.use_everyone_ping} onChange={(e) => setConfigDraft(prev => ({ ...(prev || {}), use_everyone_ping: e.target.checked }))} />
                  <span style={{ color: 'var(--admin-text-muted)' }}>{configDraft?.use_everyone_ping ? 'Enabled' : 'Disabled'}</span>
                </div>

                <label>Min Teams Required</label>
                <input type="number" min={0} placeholder="Minimum teams" value={configDraft?.min_teams_required || 0} onChange={(e) => setConfigDraft(prev => ({ ...(prev || {}), min_teams_required: Number(e.target.value) }))} />

                <label className="checkbox-row">API Server Enabled</label>
                <div className="checkbox-row">
                  <input type="checkbox" checked={!!configDraft?.api_server_enabled} onChange={(e) => setConfigDraft(prev => ({ ...(prev || {}), api_server_enabled: e.target.checked }))} />
                  <span style={{ color: 'var(--admin-text-muted)' }}>{configDraft?.api_server_enabled ? 'Enabled' : 'Disabled'}</span>
                </div>

                <label>API Server Port</label>
                <input type="number" min={1} max={65535} value={configDraft?.api_server_port || 8080} onChange={(e) => setConfigDraft(prev => ({ ...(prev || {}), api_server_port: Number(e.target.value) }))} />
              </div>
              <div style={{ marginTop: 10, color: 'var(--admin-text-muted)' }}>
                <small>Note: After saving, the cog will apply updates. Use the Refresh button to confirm the changes.</small>
              </div>
              <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                <button className="admin-btn btn-primary" onClick={handleConfigSave} disabled={!configDraft || JSON.stringify(configDraft) === JSON.stringify(adminConfig) || isSaving}>
                  {isSaving ? 'Saving…' : 'Save'} {saveSuccess && <span style={{ color: '#4CAF50', marginLeft: '8px' }}>✓</span>}
                </button>
                <button className="admin-btn btn-secondary" onClick={() => { setIsSaving(false); setSaveSuccess(false); setConfigModalOpen(false); }}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
