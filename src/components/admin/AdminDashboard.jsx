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

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const status = await botApi.getAdminStatus();
      setStats({
        currentPhase: status.phase || "unknown",
        currentTheme: status.theme || "Unknown Theme",
        activeWeek: "Current",
        totalSubmissions: status.team_count || 0,
        totalVotes: status.voting_results ? Object.values(status.voting_results).reduce((a, b) => a + b, 0) : 0,
        activeTeams: status.team_count || 0,
        totalArtists: 0,
        systemStatus: "operational",
      });
    } catch (err) {
      console.error("Failed to load stats:", err);
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
        await botApi.startNextWeek();
        showSuccess("✅ New week started successfully!");
        await loadStats();
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
        await botApi.setPhase(nextPhase);
        showSuccess(`✅ Phase changed to: ${nextPhase}`);
        await loadStats();
      } catch (err) {
        showError(`❌ Failed to change phase: ${err.message}`);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleAnnounceWinner = async () => {
    if (confirm("Are you sure you want to announce the winner? This will end the current voting period.")) {
      setLoading(true);
      try {
        await botApi.endWeek();
        showSuccess("🏆 Calculating results and announcing winner...");
        await loadStats();
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

      <div className="admin-stats-grid">
        <div className="admin-stat-card status-operational">
          <div className="admin-stat-icon">🟢</div>
          <div className="admin-stat-content">
            <div className="admin-stat-label">System Status</div>
            <div className="admin-stat-value">Operational</div>
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
          <button className="admin-action-btn action-primary" onClick={handleStartNewWeek}>
            <span className="action-icon">🎵</span>
            <span>Start New Week</span>
          </button>
          <button className="admin-action-btn action-success" onClick={handleSendAnnouncement}>
            <span className="action-icon">📢</span>
            <span>Send Announcement</span>
          </button>
          <button className="admin-action-btn action-warning" onClick={handleChangePhase}>
            <span className="action-icon">🔄</span>
            <span>Change Phase</span>
          </button>
          <button className="admin-action-btn action-info" onClick={handleAnnounceWinner}>
            <span className="action-icon">🏆</span>
            <span>Announce Winner</span>
          </button>
        </div>
      </div>

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
    </div>
  );
}
