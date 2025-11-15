import React, { useState } from "react";

export default function CompetitionManagement() {
  const [currentPhase, setCurrentPhase] = useState("voting");
  const [currentTheme, setCurrentTheme] = useState("Cosmic Dreams");
  const [nextTheme, setNextTheme] = useState("");
  const [biweeklyMode, setBiweeklyMode] = useState(false);
  const [minTeams, setMinTeams] = useState(2);
  const [reputationPoints, setReputationPoints] = useState(2);
  const [autoAnnounce, setAutoAnnounce] = useState(true);
  const [validateFormat, setValidateFormat] = useState(true);

  const handlePhaseChange = (newPhase) => {
    setCurrentPhase(newPhase);
    // TODO: Call Discord bot API to change phase
    alert(`✅ Phase changed to: ${newPhase}`);
  };

  const handleThemeUpdate = () => {
    if (!currentTheme.trim()) {
      alert("❌ Please enter a theme");
      return;
    }
    // TODO: Call Discord bot API to update theme
    alert(`✅ Theme updated to: ${currentTheme}`);
  };

  const handleGenerateTheme = () => {
    // TODO: Call Discord bot API to generate AI theme
    alert("🤖 Generating AI theme...");
    // Simulate AI generation
    setTimeout(() => {
      const themes = ["Neon Dreams", "Ocean Waves", "Desert Sunset", "Arctic Winds", "Jungle Rhythm"];
      const randomTheme = themes[Math.floor(Math.random() * themes.length)];
      setNextTheme(randomTheme);
      alert(`✅ AI generated theme: "${randomTheme}"`);
    }, 1000);
  };

  const handleNextWeek = () => {
    if (confirm("Are you sure you want to start the next week? This will begin a new competition cycle.")) {
      // TODO: Call Discord bot API to start next week
      alert("✅ Starting next week...");
    }
  };

  const handleCancelWeek = () => {
    if (confirm("Are you sure you want to cancel this week's competition? This action cannot be undone.")) {
      // TODO: Call Discord bot API to cancel week
      alert("✅ Week cancelled");
    }
  };

  const handleEndWeek = () => {
    if (confirm("Are you sure you want to end this week and announce results?")) {
      // TODO: Call Discord bot API to end week
      alert("✅ Week ended - announcing results");
    }
  };

  const handleSaveSettings = () => {
    // TODO: Call API to save competition settings
    const settings = {
      minTeams,
      reputationPoints,
      autoAnnounce,
      validateFormat,
    };
    console.log("Saving settings:", settings);
    alert("✅ Competition settings saved successfully!");
  };

  return (
    <div className="admin-section">
      <div className="admin-section-header">
        <h2>🎵 Competition Management</h2>
        <p className="admin-section-subtitle">
          Manage competition phases, themes, and schedules
        </p>
      </div>

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
                className={`phase-btn ${currentPhase === "submission" ? "active" : ""}`}
                onClick={() => handlePhaseChange("submission")}
              >
                🎵 Submission
              </button>
              <button
                className={`phase-btn ${currentPhase === "voting" ? "active" : ""}`}
                onClick={() => handlePhaseChange("voting")}
              >
                🗳️ Voting
              </button>
              <button
                className={`phase-btn ${currentPhase === "paused" ? "active" : ""}`}
                onClick={() => handlePhaseChange("paused")}
              >
                ⏸️ Paused
              </button>
              <button
                className={`phase-btn ${currentPhase === "ended" ? "active" : ""}`}
                onClick={() => handlePhaseChange("ended")}
              >
                🏁 Ended
              </button>
              <button
                className={`phase-btn ${currentPhase === "cancelled" ? "active" : ""}`}
                onClick={() => handlePhaseChange("cancelled")}
              >
                ❌ Cancelled
              </button>
              <button
                className={`phase-btn ${currentPhase === "inactive" ? "active" : ""}`}
                onClick={() => handlePhaseChange("inactive")}
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
              <button onClick={handleThemeUpdate} className="admin-btn btn-primary">
                Update Theme
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
              <button onClick={handleGenerateTheme} className="admin-btn btn-secondary">
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
              <button onClick={handleNextWeek} className="admin-btn btn-success">
                ▶️ Start Next Week
              </button>
              <button onClick={handleEndWeek} className="admin-btn btn-info">
                🏆 End Week & Announce Winner
              </button>
              <button onClick={handleCancelWeek} className="admin-btn btn-danger">
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
          <button className="admin-btn btn-primary" onClick={handleSaveSettings}>Save Settings</button>
        </div>
      </div>
    </div>
  );
}
