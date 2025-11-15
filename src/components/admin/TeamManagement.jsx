import React, { useState } from "react";

export default function TeamManagement() {
  const [teams, setTeams] = useState([
    { id: 1, name: "Team Alpha", members: ["Artist1", "Artist2"], submissions: 3, wins: 1 },
    { id: 2, name: "Team Beta", members: ["Artist3", "Artist4"], submissions: 5, wins: 2 },
    { id: 3, name: "Team Gamma", members: ["Artist5", "Artist6"], submissions: 2, wins: 0 },
  ]);

  const [searchTerm, setSearchTerm] = useState("");

  return (
    <div className="admin-section">
      <div className="admin-section-header">
        <h2>👥 Team Management</h2>
        <p className="admin-section-subtitle">
          View and manage competition teams
        </p>
      </div>

      {/* Search and Filters */}
      <div className="admin-card">
        <div className="admin-card-content">
          <div className="admin-search-bar">
            <input
              type="text"
              placeholder="Search teams..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="admin-input"
            />
            <button className="admin-btn btn-primary">🔍 Search</button>
          </div>
        </div>
      </div>

      {/* Teams List */}
      <div className="admin-card">
        <h3 className="admin-card-title">📋 All Teams</h3>
        <div className="admin-card-content">
          <div className="admin-table-container">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Team Name</th>
                  <th>Members</th>
                  <th>Submissions</th>
                  <th>Wins</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {teams.map((team) => (
                  <tr key={team.id}>
                    <td className="team-name-cell">{team.name}</td>
                    <td>{team.members.join(", ")}</td>
                    <td>{team.submissions}</td>
                    <td>{team.wins}</td>
                    <td>
                      <button className="admin-btn-sm btn-info">View</button>
                      <button className="admin-btn-sm btn-secondary">Edit</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Current Week Submissions */}
      <div className="admin-card">
        <h3 className="admin-card-title">🎵 Current Week Submissions</h3>
        <div className="admin-card-content">
          <div className="submission-list">
            <div className="submission-item">
              <div className="submission-info">
                <strong>Team Alpha</strong> - "Cosmic Journey"
                <div className="submission-meta">Submitted 2 hours ago</div>
              </div>
              <div className="submission-actions">
                <button className="admin-btn-sm btn-success">✓ Approve</button>
                <button className="admin-btn-sm btn-danger">✗ Reject</button>
              </div>
            </div>
            <div className="submission-item">
              <div className="submission-info">
                <strong>Team Beta</strong> - "Stellar Dreams"
                <div className="submission-meta">Submitted 5 hours ago</div>
              </div>
              <div className="submission-actions">
                <button className="admin-btn-sm btn-success">✓ Approve</button>
                <button className="admin-btn-sm btn-danger">✗ Reject</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
