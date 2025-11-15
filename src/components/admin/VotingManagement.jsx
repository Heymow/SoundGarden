import React, { useState } from "react";

export default function VotingManagement() {
  const [votingStats, setVotingStats] = useState({
    totalVotes: 142,
    uniqueVoters: 45,
    averageVotesPerSubmission: 28.4,
  });
  const [selectedWeek, setSelectedWeek] = useState("2024-W03");

  const handleLoadAudit = () => {
    alert(`🔍 Loading detailed vote audit for ${selectedWeek}...`);
    // TODO: Call API to load vote audit
  };

  const handleResetVotes = () => {
    if (confirm("⚠️ Are you sure you want to reset ALL votes? This action CANNOT be undone!")) {
      if (confirm("⚠️ FINAL WARNING: This will permanently delete all votes for the current week. Continue?")) {
        alert("🔄 Resetting all votes...");
        setVotingStats({
          totalVotes: 0,
          uniqueVoters: 0,
          averageVotesPerSubmission: 0,
        });
        // TODO: Call API to reset votes
      }
    }
  };

  const handleRemoveInvalidVotes = () => {
    if (confirm("Are you sure you want to remove invalid votes? This will check for duplicate votes and votes from non-members.")) {
      alert("🗑️ Checking for and removing invalid votes...");
      // TODO: Call API to remove invalid votes
      setTimeout(() => {
        alert("✅ Removed 3 invalid votes");
      }, 1000);
    }
  };

  const handleExportResults = () => {
    alert("📊 Exporting voting results to CSV...");
    // TODO: Call API to export results
    setTimeout(() => {
      alert("✅ Results exported successfully!");
    }, 1000);
  };

  return (
    <div className="admin-section">
      <div className="admin-section-header">
        <h2>🗳️ Voting Management</h2>
        <p className="admin-section-subtitle">
          Monitor voting activity and manage results
        </p>
      </div>

      {/* Voting Stats */}
      <div className="admin-stats-grid">
        <div className="admin-stat-card">
          <div className="admin-stat-icon">🗳️</div>
          <div className="admin-stat-content">
            <div className="admin-stat-label">Total Votes</div>
            <div className="admin-stat-value">{votingStats.totalVotes}</div>
          </div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-icon">👥</div>
          <div className="admin-stat-content">
            <div className="admin-stat-label">Unique Voters</div>
            <div className="admin-stat-value">{votingStats.uniqueVoters}</div>
          </div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-icon">📊</div>
          <div className="admin-stat-content">
            <div className="admin-stat-label">Avg per Submission</div>
            <div className="admin-stat-value">{votingStats.averageVotesPerSubmission}</div>
          </div>
        </div>
      </div>

      {/* Current Results */}
      <div className="admin-card">
        <h3 className="admin-card-title">📊 Current Voting Results</h3>
        <div className="admin-card-content">
          <div className="voting-results-list">
            <div className="result-item winner">
              <div className="result-rank">🥇</div>
              <div className="result-info">
                <div className="result-team">Team Alpha - "Cosmic Journey"</div>
                <div className="result-bar">
                  <div className="result-bar-fill" style={{ width: "85%" }}></div>
                </div>
              </div>
              <div className="result-votes">42 votes</div>
            </div>
            <div className="result-item">
              <div className="result-rank">🥈</div>
              <div className="result-info">
                <div className="result-team">Team Beta - "Stellar Dreams"</div>
                <div className="result-bar">
                  <div className="result-bar-fill" style={{ width: "68%" }}></div>
                </div>
              </div>
              <div className="result-votes">34 votes</div>
            </div>
            <div className="result-item">
              <div className="result-rank">🥉</div>
              <div className="result-info">
                <div className="result-team">Team Gamma - "Nebula Sound"</div>
                <div className="result-bar">
                  <div className="result-bar-fill" style={{ width: "56%" }}></div>
                </div>
              </div>
              <div className="result-votes">28 votes</div>
            </div>
          </div>
        </div>
      </div>

      {/* Vote Audit */}
      <div className="admin-card">
        <h3 className="admin-card-title">🔍 Vote Audit</h3>
        <div className="admin-card-content">
          <div className="admin-form-group">
            <label>Select Week:</label>
            <select 
              className="admin-input"
              value={selectedWeek}
              onChange={(e) => setSelectedWeek(e.target.value)}
            >
              <option>2024-W03 (Current)</option>
              <option>2024-W02</option>
              <option>2024-W01</option>
            </select>
          </div>
          <button className="admin-btn btn-primary" onClick={handleLoadAudit}>Load Detailed Audit</button>
          
          <div className="admin-help-text">
            💡 View detailed voting information including individual votes and timestamps
          </div>
        </div>
      </div>

      {/* Voting Controls */}
      <div className="admin-card">
        <h3 className="admin-card-title">⚙️ Voting Controls</h3>
        <div className="admin-card-content">
          <div className="voting-controls">
            <button className="admin-btn btn-warning" onClick={handleResetVotes}>🔄 Reset All Votes</button>
            <button className="admin-btn btn-danger" onClick={handleRemoveInvalidVotes}>🗑️ Remove Invalid Votes</button>
            <button className="admin-btn btn-success" onClick={handleExportResults}>📊 Export Results</button>
          </div>
          <div className="admin-warning">
            ⚠️ These actions cannot be undone. Use with caution.
          </div>
        </div>
      </div>
    </div>
  );
}
