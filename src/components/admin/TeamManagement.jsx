import React, { useState, useEffect } from "react";
import * as botApi from "../../services/botApi";

export default function TeamManagement() {
  const [teams, setTeams] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  useEffect(() => {
    loadSubmissions();
    const poll = setInterval(loadSubmissions, 15000);
    const handler = () => loadSubmissions();
    window.addEventListener('admin:refresh', handler);
    return () => {
      clearInterval(poll);
      window.removeEventListener('admin:refresh', handler);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadSubmissions = async () => {
    setLoading(true);
    try {
      const data = await botApi.getAdminSubmissions();
      setSubmissions(data.submissions || []);
    } catch (err) {
      console.error("Failed to load submissions:", err);
    } finally {
      setLoading(false);
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

  const handleSearch = () => {
    if (searchTerm.trim()) {
      showSuccess(`🔍 Searching for teams: "${searchTerm}"`);
    }
  };

  const handleViewTeam = (team) => {
    const members = team.members?.map(m => m.display_name || m.username).join(", ") || "Unknown";
    alert(`👁️ Viewing details for ${team.team_name}\nMembers: ${members}\nSubmitted: ${team.submitted_at}`);
  };

  const handleEditTeam = (team) => {
    alert(`✏️ Opening edit dialog for ${team.team_name}`);
  };

  const handleApproveSubmission = async (team) => {
    showSuccess(`✅ Approved submission from ${team.team_name}`);
  };

  const handleRejectSubmission = async (team) => {
    if (confirm(`Are you sure you want to reject submission from ${team.team_name}?`)) {
      setLoading(true);
      try {
        await botApi.removeSubmission(team.team_name);
        showSuccess(`❌ Rejected submission from ${team.team_name}`);
        await loadSubmissions();
      } catch (err) {
        showError(`❌ Failed to reject submission: ${err.message}`);
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div className="admin-section">
      <div className="admin-section-header">
        <h2>👥 Team Management</h2>
        <p className="admin-section-subtitle">
          View and manage competition teams
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

      {/* Search and Filters */}
      <div className="admin-card">
        <div className="admin-card-content">
          <div className="admin-search-bar">
            <input
              type="text"
              placeholder="Search teams..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              className="admin-input"
            />
            <button className="admin-btn btn-primary" onClick={handleSearch}>🔍 Search</button>
          </div>
        </div>
      </div>

      {/* Current Week Submissions */}
      <div className="admin-card">
        <h3 className="admin-card-title">🎵 Current Week Submissions</h3>
        <div className="admin-card-content">
          {loading ? (
            <p>Loading submissions...</p>
          ) : submissions.length > 0 ? (
            <div className="submission-list">
              {submissions.map((submission, idx) => (
                <div key={idx} className="submission-item">
                  <div className="submission-info">
                    <strong>{submission.team_name}</strong>
                    <div className="submission-meta">
                      Members: {submission.members?.map(m => m.display_name || m.username).join(", ") || "Unknown"}
                    </div>
                    <div className="submission-meta">
                      URL: <a href={submission.track_url} target="_blank" rel="noopener noreferrer">{submission.track_url}</a>
                    </div>
                    <div className="submission-meta">Submitted: {submission.submitted_at}</div>
                  </div>
                  <div className="submission-actions">
                    <button
                      className="admin-btn-sm btn-success"
                      onClick={() => handleApproveSubmission(submission)}
                      disabled={loading}
                    >
                      ✓ Approve
                    </button>
                    <button
                      className="admin-btn-sm btn-danger"
                      onClick={() => handleRejectSubmission(submission)}
                      disabled={loading}
                    >
                      ✗ Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p>No submissions for the current week.</p>
          )}
        </div>
      </div>
    </div>
  );
}
