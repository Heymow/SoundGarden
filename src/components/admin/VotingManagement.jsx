import React, { useState, useEffect } from "react";
import * as botApi from "../../services/botApi";

export default function VotingManagement() {
  const [votingStats, setVotingStats] = useState({
    totalVotes: 0,
    uniqueVoters: 0,
    averageVotesPerSubmission: 0,
  });
  const [selectedWeek, setSelectedWeek] = useState("");
  const [auditData, setAuditData] = useState(null);
  const [votingResults, setVotingResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Load initial data
  useEffect(() => {
    loadStatus();
    const handler = () => loadStatus();
    window.addEventListener('admin:refresh', handler);
    const poll = setInterval(loadStatus, 15000);
    return () => {
      window.removeEventListener('admin:refresh', handler);
      clearInterval(poll);
    };
  }, []);

  const loadStatus = async () => {
    try {
      const status = await botApi.getAdminStatus();
      if (status.voting_results) {
        let map = status.voting_results;
        let latestWeekKey = '';

        // Detect nested week mapping
        const firstVal = Object.values(map)[0];
        if (firstVal && typeof firstVal === 'object' && !Array.isArray(firstVal)) {
          const weekKeys = Object.keys(map).sort();
          latestWeekKey = weekKeys.slice(-1)[0];
          map = map[latestWeekKey] || {};
        }

        const results = Object.entries(map).map(([team, votes]) => ({ team, votes }));
        results.sort((a, b) => b.votes - a.votes);
        setVotingResults(results);

        const totalVotes = results.reduce((sum, r) => sum + r.votes, 0);
        const uniqueVoters = totalVotes; // Simplified - each vote is unique in this context
        const avgVotes = results.length > 0 ? totalVotes / results.length : 0;

        setVotingStats({
          totalVotes,
          uniqueVoters,
          averageVotesPerSubmission: Math.round(avgVotes * 10) / 10,
        });
        // set selectedWeek to latest if present
        if (latestWeekKey) setSelectedWeek(latestWeekKey);
      }
    } catch (err) {
      console.error("Failed to load status:", err);
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

  const handleLoadAudit = async () => {
    if (!selectedWeek) {
      showError("❌ Please select a week");
      return;
    }

    setLoading(true);
    try {
      const data = await botApi.getVoteDetails(selectedWeek);
      setAuditData(data);
      showSuccess(`✅ Loaded detailed vote audit for ${selectedWeek}`);
    } catch (err) {
      showError(`❌ Failed to load vote audit: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleResetVotes = async () => {
    if (confirm("⚠️ Are you sure you want to reset ALL votes? This action CANNOT be undone!")) {
      if (confirm("⚠️ FINAL WARNING: This will permanently delete all votes for the current week. Continue?")) {
        setLoading(true);
        try {
          await botApi.resetVotes();
          showSuccess("🔄 All votes have been reset");
          await loadStatus();
          window.dispatchEvent(new Event('admin:refresh'));
        } catch (err) {
          showError(`❌ Failed to reset votes: ${err.message}`);
        } finally {
          setLoading(false);
        }
      }
    }
  };

  const handleRemoveInvalidVotes = async () => {
    if (confirm("Are you sure you want to remove invalid votes? This will check for duplicate votes and votes from non-members.")) {
      setLoading(true);
      try {
        const result = await botApi.removeInvalidVotes();
        showSuccess(`✅ ${result.message || "Invalid votes removed"}`);
        await loadStatus();
        window.dispatchEvent(new Event('admin:refresh'));
      } catch (err) {
        showError(`❌ Failed to remove invalid votes: ${err.message}`);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleExportResults = async () => {
    setLoading(true);
    try {
      const result = await botApi.exportVotingResults(selectedWeek);
      showSuccess("✅ Results exported successfully!");
      // If the API returns download data, trigger download
      if (result.csv_data) {
        const blob = new Blob([result.csv_data], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `voting-results-${selectedWeek || "current"}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      showError(`❌ Failed to export results: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveVote = async (userId, username) => {
    if (!selectedWeek || !auditData) {
      showError("❌ Please load an audit first");
      return;
    }

    if (confirm(`Remove vote from ${username}?`)) {
      setLoading(true);
      try {
        await botApi.removeVote(selectedWeek, userId);
        showSuccess(`✅ Vote from ${username} removed`);
        await handleLoadAudit(); // Reload audit data
        // Notify other admin components that voting status changed
        window.dispatchEvent(new Event('admin:refresh'));
      } catch (err) {
        showError(`❌ Failed to remove vote: ${err.message}`);
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div className="admin-section">
      <div className="admin-section-header">
        <h2>🗳️ Voting Management</h2>
        <p className="admin-section-subtitle">
          Monitor voting activity and manage results
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
          {votingResults.length > 0 ? (
            <div className="voting-results-list">
              {votingResults.map((result, index) => {
                const maxVotes = votingResults[0]?.votes || 1;
                const percentage = (result.votes / maxVotes) * 100;
                const rank = index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : `${index + 1}.`;

                return (
                  <div key={result.team} className={`result-item ${index === 0 ? "winner" : ""}`}>
                    <div className="result-rank">{rank}</div>
                    <div className="result-info">
                      <div className="result-team">{result.team}</div>
                      <div className="result-bar">
                        <div className="result-bar-fill" style={{ width: `${percentage}%` }}></div>
                      </div>
                    </div>
                    <div className="result-votes">{result.votes} votes</div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p>No voting results available yet.</p>
          )}
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
          <button className="admin-btn btn-primary" onClick={handleLoadAudit} disabled={loading || !selectedWeek}>
            {loading ? "Loading..." : "Load Detailed Audit"}
          </button>

          {/* Display audit data if available */}
          {auditData && (
            <div className="audit-results">
              <h4>Audit Results for {selectedWeek}</h4>
              <p><strong>Theme:</strong> {auditData.theme}</p>
              <p><strong>Total Votes:</strong> {auditData.total_votes || auditData.vote_details?.length || 0}</p>

              {auditData.vote_details && auditData.vote_details.length > 0 && (
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Voter</th>
                      <th>Voted For</th>
                      <th>Voted At</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditData.vote_details.map((vote, idx) => (
                      <tr key={idx}>
                        <td>{vote.username}</td>
                        <td>{vote.voted_for}</td>
                        <td>{vote.voted_at}</td>
                        <td>
                          <button
                            className="admin-btn-sm btn-danger"
                            onClick={() => handleRemoveVote(vote.user_id, vote.username)}
                            disabled={loading}
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

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
            <button className="admin-btn btn-warning" onClick={handleResetVotes} disabled={loading}>
              🔄 Reset All Votes
            </button>
            <button className="admin-btn btn-danger" onClick={handleRemoveInvalidVotes} disabled={loading}>
              🗑️ Remove Invalid Votes
            </button>
            <button className="admin-btn btn-success" onClick={handleExportResults} disabled={loading}>
              📊 Export Results
            </button>
          </div>
          <div className="admin-warning">
            ⚠️ These actions cannot be undone. Use with caution.
          </div>
        </div>
      </div>
    </div>
  );
}
