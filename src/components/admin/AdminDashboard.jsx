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
          <button className="admin-action-btn action-primary">
            <span className="action-icon">🎵</span>
            <span>Start New Week</span>
          </button>
          <button className="admin-action-btn action-success">
            <span className="action-icon">📢</span>
            <span>Send Announcement</span>
          </button>
          <button className="admin-action-btn action-warning">
            <span className="action-icon">🔄</span>
            <span>Change Phase</span>
          </button>
          <button className="admin-action-btn action-info">
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
