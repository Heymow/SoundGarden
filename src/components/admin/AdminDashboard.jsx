import React, { useState, useEffect } from "react";

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    currentPhase: "voting",
    currentTheme: "Cosmic Dreams",
    activeWeek: "2024-W03",
    totalSubmissions: 5,
    totalVotes: 142,
    activeTeams: 8,
    totalArtists: 24,
    systemStatus: "operational",
  });

  const handleStartNewWeek = () => {
    if (confirm("Are you sure you want to start a new week? This will create a new competition cycle.")) {
      // TODO: Call API to start new week
      alert("✅ New week started successfully!");
      // Update stats
      setStats(prev => ({
        ...prev,
        activeWeek: `2024-W${parseInt(prev.activeWeek.split('-W')[1]) + 1}`,
        currentPhase: "submission",
        totalSubmissions: 0,
        totalVotes: 0,
      }));
    }
  };

  const handleSendAnnouncement = () => {
    // TODO: Navigate to announcements section or show quick announcement modal
    alert("📢 Opening announcement composer...");
  };

  const handleChangePhase = () => {
    const phases = ["submission", "voting", "paused", "ended"];
    const currentIndex = phases.indexOf(stats.currentPhase);
    const nextPhase = phases[(currentIndex + 1) % phases.length];
    
    if (confirm(`Change phase from "${stats.currentPhase}" to "${nextPhase}"?`)) {
      setStats(prev => ({ ...prev, currentPhase: nextPhase }));
      alert(`✅ Phase changed to: ${nextPhase}`);
    }
  };

  const handleAnnounceWinner = () => {
    if (confirm("Are you sure you want to announce the winner? This will end the current voting period.")) {
      // TODO: Call API to calculate and announce winner
      alert("🏆 Calculating results and announcing winner...");
      setStats(prev => ({ ...prev, currentPhase: "ended" }));
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
