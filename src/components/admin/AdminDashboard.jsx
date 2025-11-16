import React, { useState, useEffect } from "react";
import * as botApi from "../../services/botApi";

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    currentPhase: "voting",
    currentTheme: "Cosmic Dreams",
    activeWeek: "2024-W03",
    totalSubmissions: 0,
    totalVotes: 0,
    activeTeams: 0,
    totalArtists: 0,
    systemStatus: "operational",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [queueInfo, setQueueInfo] = useState({ queueLength: 0, queue: [], processed: [] });
  const [pendingPhases, setPendingPhases] = useState([]);
  const [pendingNextWeek, setPendingNextWeek] = useState(null);
  const [systemDiag, setSystemDiag] = useState(null);
  const [isLoggedIn, setIsLoggedIn] = useState(botApi.hasAdminToken());
  const [statusLogs, setStatusLogs] = useState([]);
  const [showLogs, setShowLogs] = useState(false);

  useEffect(() => {
    loadStats();
    loadQueue();
    loadSystem();
    const sTimer = setInterval(() => { loadStats(); loadSystem(); }, 20000);
    const qTimer = setInterval(() => { loadQueue(); }, 10000);
    return () => { clearInterval(sTimer); clearInterval(qTimer); };
  }, []);
  useEffect(() => {
    const handler = () => { loadStats(); loadQueue(); };
    window.addEventListener('admin:refresh', handler);
    return () => window.removeEventListener('admin:refresh', handler);
  }, [])

  useEffect(() => {
    // Periodically check login state
    const check = () => setIsLoggedIn(botApi.hasAdminToken());
    const iv = setInterval(check, 3000);
    return () => clearInterval(iv);
  }, []);

  const loadSystem = async () => {
    try {
      const data = await botApi.getAdminSystem();
      setSystemDiag(data.diagnostics || null);
      setIsLoggedIn(true);
    } catch (e) {
      console.warn('Failed to fetch system diagnostics:', e);
      if (e.message && e.message.includes('Admin token not found')) setIsLoggedIn(false);
    }
  }

  const loadStats = async () => {
    try {
      const status = await botApi.getAdminStatus();
      // Compute total votes: support both direct mapping and nested week mapping
      let totalVotes = 0;
      try {
        if (status.voting_results) {
          if (Object.keys(status.voting_results).length === 0) {
            totalVotes = 0;
          } else {
            // Determine if voting_results is nested (weeks -> {team: votes})
            const firstValue = Object.values(status.voting_results)[0];
            if (typeof firstValue === 'object' && firstValue !== null) {
              // Attempt to find the latest week and sum its votes
              const weekKeys = Object.keys(status.voting_results);
              // Pick the last week (assumes keys are sortable by ISO week key or datetime)
              const latestWeek = weekKeys.sort().slice(-1)[0];
              const weekResults = status.voting_results[latestWeek] || {};
              totalVotes = Object.values(weekResults).reduce((a, b) => a + b, 0);
            } else {
              // Simple mapping team -> votes
              totalVotes = Object.values(status.voting_results).reduce((a, b) => a + b, 0);
            }
          }
        }
      } catch (e) {
        console.warn('Failed to compute total votes:', e);
        totalVotes = 0;
      }

      setStats({
        currentPhase: status.phase || "unknown",
        currentTheme: status.theme || "Unknown Theme",
        activeWeek: "Current",
        totalSubmissions: status.team_count || 0,
        totalVotes: totalVotes || 0,
        activeTeams: status.team_count || 0,
        totalArtists: 0,
        systemStatus: "operational",
      });
      if (status.error) {
        showError(`⚠️ Backend status warning: ${status.error}`);
      }
    } catch (err) {
      console.error("Failed to load stats:", err);
      if (err.message && err.message.includes('Admin token not found')) {
        showError('Please sign in with Discord to view admin stats.');
        setIsLoggedIn(false);
      }
    }
  };

  const loadQueue = async () => {
    try {
      const q = await botApi.getAdminQueue();
      setQueueInfo({
        queueLength: q.queueLength || 0,
        queue: q.queue || [],
        processed: q.processed || [],
      });
      const nextWeekQueued = (q.queue || []).find((a) => a && a.action === 'start_new_week');
      setPendingNextWeek(nextWeekQueued?.params?.theme || null);
      // Compute pending phases
      const pPhases = (q.queue || [])
        .filter((a) => a && a.action === "set_phase")
        .map((a) => (a.params ? a.params.phase : null))
        .filter(Boolean);
      setPendingPhases(Array.from(new Set(pPhases)));
    } catch (err) {
      console.error('Failed to load queue:', err);
      if (err.message && err.message.includes('Admin token not found')) {
        showError('Please sign in with Discord to view the action queue.');
        setIsLoggedIn(false);
      }
    }
  };

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

  const handleStartNewWeek = async () => {
    if (confirm("Are you sure you want to start a new week? This will create a new competition cycle.")) {
      setLoading(true);
      try {
        const themeToUse = stats.currentTheme && stats.currentTheme !== 'Unknown Theme' ? stats.currentTheme : prompt('Enter a theme for the new week:');
        if (!themeToUse) throw new Error('Theme required to start new week');
        const res = await botApi.startNextWeek(themeToUse);
        if (res && res.actionId) {
          setPendingNextWeek(themeToUse);
        }
        showSuccess("✅ New week started successfully!");
        await loadStats();
        window.dispatchEvent(new Event('admin:refresh'));
      } catch (err) {
        showError(`❌ Failed to start new week: ${err.message}`);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleSendAnnouncement = () => {
    showSuccess("📢 Opening announcement composer...");
  };

  const handleChangePhase = async () => {
    const phases = ["submission", "voting", "paused", "ended"];
    const currentIndex = phases.indexOf(stats.currentPhase);
    const nextPhase = phases[(currentIndex + 1) % phases.length];

    if (confirm(`Change phase from "${stats.currentPhase}" to "${nextPhase}"?`)) {
      setLoading(true);
      try {
        const res = await botApi.setPhase(nextPhase);
        if (res && res.actionId) {
          setPendingPhases((p) => Array.from(new Set([...p, nextPhase])));
        }
        showSuccess(`✅ Phase changed to: ${nextPhase}`);
        await loadStats();
        window.dispatchEvent(new Event('admin:refresh'));
      } catch (err) {
        showError(`❌ Failed to change phase: ${err.message}`);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleTestConnection = async () => {
    setLoading(true);
    try {
      const result = await botApi.testBotApiConnection();
      if (result.success) {
        showSuccess("✅ Bot API connection successful! Server is reachable.");
        await loadSystem();
      } else {
        showError(`❌ Bot API connection failed: ${result.error}`);
      }
    } catch (err) {
      showError(`❌ Connection test failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleAnnounceWinner = async () => {
    if (confirm("Are you sure you want to announce the winner? This will end the current voting period.")) {
      setLoading(true);
      try {
        await botApi.announceWinners();
        showSuccess("🏆 Calculating results and announcing winner...");
        await loadStats();
        window.dispatchEvent(new Event('admin:refresh'));
      } catch (err) {
        showError(`❌ Failed to announce winner: ${err.message}`);
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div className="admin-section">
      <div className="admin-section-header">
        <h2>📊 Dashboard Overview</h2>
        <p className="admin-section-subtitle">
          Monitor competition status and system health
        </p>
      </div>

      {!isLoggedIn && (
        <div className="admin-login-cta" style={{ marginBottom: '16px' }}>
          <p>🔒 Admin access requires signing in with Discord.</p>
          <a className="admin-btn btn-primary" href={`${botApi.getCurrentApiConfig().currentUrl}/auth/discord`} target="_blank" rel="noopener noreferrer">Sign in with Discord</a>
        </div>
      )}

      <div className="admin-stats-grid">
        <div className="admin-stat-card status-operational">
          <div className="admin-stat-icon">{systemDiag && systemDiag.redisConnected ? '🟢' : '⚠️'}</div>
          <div className="admin-stat-content">
            <div className="admin-stat-label">System Status</div>
            <div className="admin-stat-value">{systemDiag ? (systemDiag.redisConnected ? 'Operational (Redis)' : (systemDiag.backendMode ? 'Operational (Backend mode)' : 'Degraded')) : 'Unknown'}</div>
            {systemDiag && (
              <small className="admin-stat-sub">Redis: {systemDiag.redisConnected ? 'Connected' : 'Not connected'} | Last status: {systemDiag.lastStatusTimestamp || 'unknown'}. Queue: {systemDiag.queueLength} | InMemoryQueue: {systemDiag.inMemoryQueue}</small>
            )}
          </div>
        </div>

        <div className="admin-stat-card">
          <div className="admin-stat-icon">📅</div>
          <div className="admin-stat-content">
            <div className="admin-stat-label">Current Week</div>
            <div className="admin-stat-value">{stats.activeWeek}</div>
          </div>
        </div>

        <div className="admin-stat-card">
          <div className="admin-stat-icon">🎯</div>
          <div className="admin-stat-content">
            <div className="admin-stat-label">Phase</div>
            <div className="admin-stat-value">{stats.currentPhase}</div>
          </div>
        </div>

        <div className="admin-stat-card">
          <div className="admin-stat-icon">🎨</div>
          <div className="admin-stat-content">
            <div className="admin-stat-label">Theme</div>
            <div className="admin-stat-value">{stats.currentTheme}</div>
          </div>
        </div>

        <div className="admin-stat-card">
          <div className="admin-stat-icon">🎵</div>
          <div className="admin-stat-content">
            <div className="admin-stat-label">Submissions</div>
            <div className="admin-stat-value">{stats.totalSubmissions}</div>
          </div>
        </div>

        <div className="admin-stat-card">
          <div className="admin-stat-icon">🗳️</div>
          <div className="admin-stat-content">
            <div className="admin-stat-label">Total Votes</div>
            <div className="admin-stat-value">{stats.totalVotes}</div>
          </div>
        </div>

        <div className="admin-stat-card">
          <div className="admin-stat-icon">👥</div>
          <div className="admin-stat-content">
            <div className="admin-stat-label">Active Teams</div>
            <div className="admin-stat-value">{stats.activeTeams}</div>
          </div>
        </div>

        <div className="admin-stat-card">
          <div className="admin-stat-icon">🎤</div>
          <div className="admin-stat-content">
            <div className="admin-stat-label">Artists</div>
            <div className="admin-stat-value">{stats.totalArtists}</div>
          </div>
        </div>
      </div>

      <div className="admin-quick-actions">
        <h3>⚡ Quick Actions</h3>
        <div className="admin-action-grid">
          {(() => {
            const themeToUse = stats.currentTheme || null;
            const isPending = pendingNextWeek && pendingNextWeek === themeToUse;
            return (
              <button className={`admin-action-btn action-primary ${isPending ? 'btn-pending' : ''}`} onClick={handleStartNewWeek}>
                <span className="action-icon">🎵</span>
                <span>{isPending ? '⏳ Starting...' : 'Start New Week'}</span>
              </button>
            );
          })()}
          <button className="admin-action-btn action-success" onClick={handleSendAnnouncement}>
            <span className="action-icon">📢</span>
            <span>Send Announcement</span>
          </button>
          {(() => {
            const phases = ["submission", "voting", "paused", "ended"];
            const currentIndex = phases.indexOf(stats.currentPhase);
            const nextPhase = phases[(currentIndex + 1) % phases.length];
            const isPending = pendingPhases.includes(nextPhase);
            return (
              <button className={`admin-action-btn action-warning ${isPending ? 'btn-pending' : ''}`} onClick={handleChangePhase}>
                <span className="action-icon">🔄</span>
                <span>{isPending ? '⏳ Changing...' : 'Change Phase'}</span>
              </button>
            );
          })()}

          <button className="admin-action-btn action-info" onClick={handleAnnounceWinner}>
            <span className="action-icon">🏆</span>
            <span>Announce Winner</span>
          </button>
          <button className="admin-action-btn action-secondary" onClick={handleTestConnection}>
            <span className="action-icon">🔌</span>
            <span>Test Connection</span>
          </button>
          <button className="admin-action-btn action-danger" onClick={async () => {
            if (!confirm('Clear all submissions for this week?')) return;
            setLoading(true);
            try {
              await botApi.clearSubmissions();
              showSuccess('✅ Submissions cleared');
              window.dispatchEvent(new Event('admin:refresh'));
            } catch (e) { showError(`❌ Failed: ${e.message}`); } finally { setLoading(false); }
          }}>
            <span className="action-icon">🧹</span>
            <span>Clear Submissions</span>
          </button>
          <button className="admin-action-btn action-warning" onClick={async () => {
            if (!confirm('Reset the current week state? This rolls back submissions/votes to zero.')) return;
            setLoading(true);
            try { await botApi.resetWeek(); showSuccess('✅ Week reset'); window.dispatchEvent(new Event('admin:refresh')); } catch (e) { showError(`❌ Failed: ${e.message}`); } finally { setLoading(false); }
          }}>
            <span className="action-icon">🔁</span>
            <span>Reset Week</span>
          </button>
          <button className="admin-action-btn action-purple" onClick={async () => {
            if (!confirm('Force the competition into voting phase now?')) return;
            setLoading(true);
            try { await botApi.forceVoting(); showSuccess('✅ Forced into voting'); window.dispatchEvent(new Event('admin:refresh')); } catch (e) { showError(`❌ Failed: ${e.message}`); } finally { setLoading(false); }
          }}>
            <span className="action-icon">⚡</span>
            <span>Force Voting</span>
          </button>
        </div>
      </div>

      <div className="admin-system-diagnostics admin-card">
        <h3>🖥️ System Diagnostics</h3>
        {systemDiag ? (
          <div className="admin-card-content">
            <div className="diag-row">Redis: <strong>{systemDiag.redisConnected ? 'Connected' : 'Disconnected'}</strong></div>
            <div className="diag-row">Redis URL: <small>{systemDiag.redisUrl || 'Not configured'}</small></div>
            <div className="diag-row">Queue length: <strong>{systemDiag.queueLength}</strong> | InMemoryQueue: <strong>{systemDiag.inMemoryQueue}</strong></div>
            <div className="diag-row">Last Status: <small>{systemDiag.lastStatusTimestamp || 'never'}</small></div>
            <div className="diag-row">Backend mode: <strong>{systemDiag.backendMode ? 'Yes' : 'No'}</strong></div>
            <div className="diag-row">COLLABWARZ token configured: <strong>{systemDiag.collabwarzTokenConfigured ? 'Yes' : 'No'}</strong></div>
            <div className="diag-actions">
              <button className="admin-btn btn-primary" onClick={() => loadSystem()}>🔄 Refresh Diagnostics</button>
              <button className="admin-btn btn-secondary" onClick={() => setShowLogs((s) => !s)} style={{ marginLeft: '8px' }}>📋 Toggle Logs</button>
            </div>
          </div>
        ) : (
          <div className="admin-card-content">No system diagnostics available.</div>
        )}
      </div>
      {showLogs && (
        <div className="admin-card">
          <h4>Recent Status Posts</h4>
          <div className="admin-card-content">
            {statusLogs.length > 0 ? (
              <div className="status-log-list">
                {statusLogs.slice().reverse().slice(0, 20).map((l, idx) => (
                  <div key={idx} className="status-log-item">
                    <div><strong>{l.ts}</strong> — {l.result} ({l.storedIn || '-'})</div>
                    <div>Phase: {l.phase || 'n/a'} | Theme: {l.theme || 'n/a'} | Guild: {l.guild_id || 'n/a'}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div>No recent status posts recorded</div>
            )}
          </div>
        </div>
      )}

      <div className="admin-recent-activity">
        <h3>📋 Recent Activity</h3>
        <div className="admin-activity-list">
          <div className="admin-activity-item">
            <div className="activity-icon">🎵</div>
            <div className="activity-content">
              <div className="activity-title">New submission received</div>
              <div className="activity-meta">Team Alpha • 5 minutes ago</div>
            </div>
          </div>
          <div className="admin-activity-item">
            <div className="activity-icon">🗳️</div>
            <div className="activity-content">
              <div className="activity-title">Vote cast</div>
              <div className="activity-meta">User123 voted • 12 minutes ago</div>
            </div>
          </div>
          <div className="admin-activity-item">
            <div className="activity-icon">📢</div>
            <div className="activity-content">
              <div className="activity-title">Announcement posted</div>
              <div className="activity-meta">Voting phase started • 2 hours ago</div>
            </div>
          </div>
          <div className="admin-activity-item">
            <div className="activity-icon">🔄</div>
            <div className="activity-content">
              <div className="activity-title">Phase changed</div>
              <div className="activity-meta">Submission → Voting • 2 hours ago</div>
            </div>
          </div>
        </div>
      </div>

      <div className="admin-queue">
        <h3>🔁 Action Queue</h3>
        <div className="admin-queue-summary">Queued: {queueInfo.queueLength} | Processed: {queueInfo.processed.length}</div>
        <div className="admin-queue-list">
          {queueInfo.queue && queueInfo.queue.length > 0 ? (
            queueInfo.queue.slice(0, 20).map((a) => (
              <div className="admin-queue-item" key={a.id}>
                <div className="queue-item-title">{a.action}</div>
                <div className="queue-item-meta">id: {a.id} • {new Date(a.timestamp).toLocaleString()}</div>
                <div className="queue-item-params">{JSON.stringify(a.params || {})}</div>
              </div>
            ))
          ) : (
            <div className="admin-queue-empty">No actions queued</div>
          )}
        </div>
      </div>
    </div>
  );
}
