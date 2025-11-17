import React, { useState, useEffect } from "react";
import * as botApi from "../../services/botApi";

export default function CompetitionManagement() {
  const [currentPhase, setCurrentPhase] = useState("voting");
  const [currentTheme, setCurrentTheme] = useState("Cosmic Dreams");
  const [nextTheme, setNextTheme] = useState("");
  const [biweeklyMode, setBiweeklyMode] = useState(false);
  const [minTeams, setMinTeams] = useState(2);
  const [reputationPoints, setReputationPoints] = useState(2);
  const [autoAnnounce, setAutoAnnounce] = useState(true);
  const [validateFormat, setValidateFormat] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [queueInfo, setQueueInfo] = useState({ queue: [], processed: [] });
  const [pendingPhases, setPendingPhases] = useState([]);
  const [pendingTheme, setPendingTheme] = useState(null);
  const [pendingNextWeek, setPendingNextWeek] = useState(null);

  // Load current status on mount
  useEffect(() => {
    loadStatus();
    loadQueue();
    const qTimer = setInterval(loadQueue, 3000);
    return () => clearInterval(qTimer);
  }, []);

  const loadStatus = async () => {
    try {
      const status = await botApi.getAdminStatus();
      if (status.phase) setCurrentPhase(status.phase);
      if (status.theme) setCurrentTheme(status.theme);
    } catch (err) {
      console.error("Failed to load status:", err);
    }
  };

  const loadQueue = async () => {
    try {
      const q = await botApi.getAdminQueue();
      setQueueInfo({ queue: q.queue || [], processed: q.processed || [] });
      // Pending phases: any queued set_phase actions
      const pPhases = (q.queue || [])
        .filter((a) => a && a.action === "set_phase")
        .map((a) => (a.params ? a.params.phase : null))
        .filter(Boolean);
      setPendingPhases(Array.from(new Set(pPhases)));
      // Pending theme updates
      const themeQueued = (q.queue || []).find((a) => a && (a.action === 'set_theme' || a.action === 'update_theme'));
      setPendingTheme(themeQueued?.params?.theme || null);
      // Pending next-week actions
      const nextWeekQueued = (q.queue || []).find((a) => a && a.action === 'start_new_week');
      setPendingNextWeek(nextWeekQueued?.params?.theme || null);
    } catch (err) {
      console.error("Failed to load queue:", err);
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

  const handlePhaseChange = async (newPhase) => {
    setLoading(true);
    try {
      const res = await botApi.setPhase(newPhase);
      setCurrentPhase(newPhase);
      showSuccess(`✅ Phase changed to: ${newPhase}`);
      if (res && res.actionId) {
        setPendingPhases((p) => Array.from(new Set([...p, newPhase])));
      }
    } catch (err) {
      showError(`❌ Failed to change phase: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleThemeUpdate = async () => {
    if (!currentTheme.trim()) {
      showError("❌ Please enter a theme");
      return;
    }
    setLoading(true);
    try {
      const res = await botApi.setTheme(currentTheme);
      if (res && res.actionId) {
        setPendingTheme(currentTheme);
      }
      showSuccess(`✅ Theme updated to: ${currentTheme}`);
      await loadStatus();
      window.dispatchEvent(new Event('admin:refresh'));
    } catch (err) {
      showError(`❌ Failed to update theme: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateTheme = async () => {
    setLoading(true);
    try {
      const result = await botApi.generateAITheme();
      if (result.theme) {
        setNextTheme(result.theme);
        showSuccess(`✅ AI generated theme: "${result.theme}"`);
      } else {
        showError("❌ Failed to generate theme");
      }
    } catch (err) {
      showError(`❌ Failed to generate theme: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleNextWeek = async () => {
    if (confirm("Are you sure you want to start the next week? This will begin a new competition cycle.")) {
      setLoading(true);
      try {
        const themeToUse = nextTheme && nextTheme.trim() ? nextTheme.trim() : currentTheme;
        if (!themeToUse) throw new Error('Theme required to start new week');
        const res = await botApi.startNextWeek(themeToUse);
        if (res && res.actionId) {
          setPendingNextWeek(themeToUse);
        }
        showSuccess("✅ Starting next week...");
        await loadStatus();
        window.dispatchEvent(new Event('admin:refresh'));
      } catch (err) {
        showError(`❌ Failed to start next week: ${err.message}`);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleCancelWeek = async () => {
    if (confirm("Are you sure you want to cancel this week's competition? This action cannot be undone.")) {
      setLoading(true);
      try {
        await botApi.cancelWeek();
        showSuccess("✅ Week cancelled");
        await loadStatus();
        window.dispatchEvent(new Event('admin:refresh'));
      } catch (err) {
        showError(`❌ Failed to cancel week: ${err.message}`);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleEndWeek = async () => {
    if (confirm("Are you sure you want to end this week and announce results?")) {
      setLoading(true);
      try {
        await botApi.announceWinners();
        showSuccess("✅ Week ended - announcing results");
        await loadStatus();
        window.dispatchEvent(new Event('admin:refresh'));
      } catch (err) {
        showError(`❌ Failed to end week: ${err.message}`);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleSaveSettings = async () => {
    setLoading(true);
    try {
      const updates = {
        min_teams_required: minTeams,
        rep_reward_amount: reputationPoints,
        auto_announce: autoAnnounce,
        validate_discord_submissions: validateFormat,
        biweekly_mode: biweeklyMode,
      };
      await botApi.updateAdminConfig(updates);
      showSuccess("✅ Competition settings saved successfully!");
    } catch (err) {
      showError(`❌ Failed to save settings: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-section">
      <div className="admin-section-header">
        <h2>🎵 Competition Management</h2>
        <p className="admin-section-subtitle">
          Manage competition phases, themes, and schedules
        </p>
      </div>

      {/* Status Messages */}
      {success && (
        <div className="admin-alert alert-success">
          {success}
        </div>
      )}
      {error && (
        <div className="admin-alert alert-error">
          {error}
        </div>
      )}

      {/* Phase Control */}
      <div className="admin-card">
        <h3 className="admin-card-title">🔄 Phase Control</h3>
        <div className="admin-card-content">
          <div className="admin-phase-selector">
            <div className="current-phase-display">
              <label>Current Phase:</label>
              <span className={`phase-badge phase-${currentPhase}`}>
                {currentPhase.toUpperCase()}
              </span>
            </div>

            <div className="phase-buttons">
              <button
                className={`phase-btn ${currentPhase === "submission" ? "active" : ""} ${pendingPhases.includes('submission') ? 'btn-pending' : ''}`}
                onClick={() => handlePhaseChange("submission")}
                disabled={loading}
              >
                🎵 Submission
              </button>
              <button
                className={`phase-btn ${currentPhase === "voting" ? "active" : ""} ${pendingPhases.includes('voting') ? 'btn-pending' : ''}`}
                onClick={() => handlePhaseChange("voting")}
                disabled={loading}
              >
                🗳️ Voting
              </button>
              <button
                className={`phase-btn ${currentPhase === "paused" ? "active" : ""} ${pendingPhases.includes('paused') ? 'btn-pending' : ''}`}
                onClick={() => handlePhaseChange("paused")}
                disabled={loading}
              >
                ⏸️ Paused
              </button>
              <button
                className={`phase-btn ${currentPhase === "ended" ? "active" : ""} ${pendingPhases.includes('ended') ? 'btn-pending' : ''}`}
                onClick={() => handlePhaseChange("ended")}
                disabled={loading}
              >
                🏁 Ended
              </button>
              <button
                className={`phase-btn ${currentPhase === "cancelled" ? "active" : ""} ${pendingPhases.includes('cancelled') ? 'btn-pending' : ''}`}
                onClick={() => handlePhaseChange("cancelled")}
                disabled={loading}
              >
                ❌ Cancelled
              </button>
              <button
                className={`phase-btn ${currentPhase === "inactive" ? "active" : ""} ${pendingPhases.includes('inactive') ? 'btn-pending' : ''}`}
                onClick={() => handlePhaseChange("inactive")}
                disabled={loading}
              >
                ⏰ Inactive
              </button>
            </div>

            <div className="phase-description">
              <strong>Phase Info:</strong>
              {currentPhase === "submission" && " Users can submit their collaborations"}
              {currentPhase === "voting" && " Users can vote on submitted collaborations"}
              {currentPhase === "paused" && " Competition is temporarily paused"}
              {currentPhase === "ended" && " Current week has ended, results announced"}
              {currentPhase === "cancelled" && " Current week has been cancelled"}
              {currentPhase === "inactive" && " No active competition"}
            </div>
          </div>
        </div>
      </div>

      {/* Theme Management */}
      <div className="admin-card">
        <h3 className="admin-card-title">🎨 Theme Management</h3>
        <div className="admin-card-content">
          <div className="admin-form-group">
            <label>Current Theme:</label>
            <div className="admin-input-group">
              <input
                type="text"
                value={currentTheme}
                onChange={(e) => setCurrentTheme(e.target.value)}
                placeholder="Enter theme..."
                className="admin-input"
              />
              <button onClick={handleThemeUpdate} className={`admin-btn btn-primary ${pendingTheme === currentTheme ? 'btn-pending' : ''}`} disabled={loading}>
                {pendingTheme === currentTheme ? '⏳ Updating...' : 'Update Theme'}
              </button>
            </div>
          </div>

          <div className="admin-form-group">
            <label>Next Week's Theme:</label>
            <div className="admin-input-group">
              <input
                type="text"
                value={nextTheme}
                onChange={(e) => setNextTheme(e.target.value)}
                placeholder="Enter next week's theme..."
                className="admin-input"
              />
              <button onClick={handleGenerateTheme} className="admin-btn btn-secondary" disabled={loading}>
                🤖 Generate AI Theme
              </button>
            </div>
          </div>

          <div className="admin-help-text">
            💡 Use the AI generator to create creative, engaging themes automatically
          </div>
        </div>
      </div>

      {/* Schedule Control */}
      <div className="admin-card">
        <h3 className="admin-card-title">📅 Schedule Control</h3>
        <div className="admin-card-content">
          <div className="admin-schedule-grid">
            <div className="schedule-item">
              <label className="admin-checkbox-label">
                <input
                  type="checkbox"
                  checked={biweeklyMode}
                  onChange={(e) => setBiweeklyMode(e.target.checked)}
                />
                <span>Bi-weekly Mode (Every 2 weeks)</span>
              </label>
            </div>

            <div className="schedule-actions">
              {(() => {
                const themeToUse = nextTheme && nextTheme.trim() ? nextTheme.trim() : currentTheme;
                const isPending = pendingNextWeek && pendingNextWeek === themeToUse;
                return (
                  <button onClick={handleNextWeek} className={`admin-btn btn-success ${isPending ? 'btn-pending' : ''}`} disabled={loading}>
                    {isPending ? '⏳ Starting...' : '▶️ Start Next Week'}
                  </button>
                );
              })()}
              <button onClick={handleEndWeek} className="admin-btn btn-info" disabled={loading}>
                🏆 End Week & Announce Winner
              </button>
              <button onClick={handleCancelWeek} className="admin-btn btn-danger" disabled={loading}>
                ❌ Cancel This Week
              </button>
            </div>
          </div>

          <div className="admin-schedule-info">
            <div className="info-row">
              <span className="info-label">Current Week:</span>
              <span className="info-value">2024-W03</span>
            </div>
            <div className="info-row">
              <span className="info-label">Submission Deadline:</span>
              <span className="info-value">Sunday, 11:59 PM UTC</span>
            </div>
            <div className="info-row">
              <span className="info-label">Voting Deadline:</span>
              <span className="info-value">Next Sunday, 11:59 PM UTC</span>
            </div>
          </div>
        </div>
      </div>

      {/* Competition Settings */}
      <div className="admin-card">
        <h3 className="admin-card-title">⚙️ Competition Settings</h3>
        <div className="admin-card-content">
          <div className="admin-settings-grid">
            <div className="setting-item">
              <label>Minimum Teams Required:</label>
              <input
                type="number"
                value={minTeams}
                onChange={(e) => setMinTeams(parseInt(e.target.value))}
                className="admin-input-sm"
              />
            </div>
            <div className="setting-item">
              <label>Reputation Points for Winner:</label>
              <input
                type="number"
                value={reputationPoints}
                onChange={(e) => setReputationPoints(parseInt(e.target.value))}
                className="admin-input-sm"
              />
            </div>
            <div className="setting-item">
              <label className="admin-checkbox-label">
                <input
                  type="checkbox"
                  checked={autoAnnounce}
                  onChange={(e) => setAutoAnnounce(e.target.checked)}
                />
                <span>Auto-announce phase changes</span>
              </label>
            </div>
            <div className="setting-item">
              <label className="admin-checkbox-label">
                <input
                  type="checkbox"
                  checked={validateFormat}
                  onChange={(e) => setValidateFormat(e.target.checked)}
                />
                <span>Validate submissions format</span>
              </label>
            </div>
          </div>
          <button className="admin-btn btn-primary" onClick={handleSaveSettings} disabled={loading}>
            {loading ? "Saving..." : "Save Settings"}
          </button>
        </div>
      </div>
    </div>
  );
}

  // Ensure component closure

}

