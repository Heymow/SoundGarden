import React, { useState } from "react";
import * as botApi from "../../services/botApi";

export default function AnnouncementSystem() {
  const [announcementType, setAnnouncementType] = useState("custom");
  const [customMessage, setCustomMessage] = useState("");
  const [useAI, setUseAI] = useState(true);
  const [includeEveryone, setIncludeEveryone] = useState(false);
  const [autoAnnouncements, setAutoAnnouncements] = useState(true);
  const [autoSubmissionStart, setAutoSubmissionStart] = useState(true);
  const [autoVotingStart, setAutoVotingStart] = useState(true);
  const [autoReminders, setAutoReminders] = useState(true);
  const [requireConfirmation, setRequireConfirmation] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

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

  const handleSendAnnouncement = async () => {
    if (announcementType === "custom" && !customMessage.trim()) {
      showError("❌ Please enter a message");
      return;
    }
    
    setLoading(true);
    try {
      const message = announcementType === "custom" ? customMessage : announcementType;
      await botApi.sendAnnouncement(announcementType, message);
      showSuccess(`✅ Sending ${announcementType} announcement...`);
      if (announcementType === "custom") {
        setCustomMessage("");
      }
    } catch (err) {
      showError(`❌ Failed to send announcement: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSendTestMessage = async () => {
    if (announcementType === "custom" && !customMessage.trim()) {
      showError("❌ Please enter a message");
      return;
    }
    setLoading(true);
    try {
      await botApi.sendAnnouncement("test", customMessage);
      showSuccess("🧪 Test message sent to test channel");
    } catch (err) {
      showError(`❌ Failed to send test message: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleViewAnnouncement = (announcement) => {
    showSuccess(`📄 Viewing announcement: ${announcement}`);
  };

  const handleSaveAutoSettings = async () => {
    setLoading(true);
    try {
      const updates = {
        auto_announce: autoAnnouncements,
        require_confirmation: requireConfirmation,
      };
      await botApi.updateAdminConfig(updates);
      showSuccess("✅ Auto-announcement settings saved successfully!");
    } catch (err) {
      showError(`❌ Failed to save settings: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const announcementTypes = [
    { id: "custom", label: "Custom Message", icon: "✏️" },
    { id: "submission_start", label: "Submission Phase Start", icon: "🎵" },
    { id: "voting_start", label: "Voting Phase Start", icon: "🗳️" },
    { id: "reminder", label: "Deadline Reminder", icon: "⏰" },
    { id: "winner", label: "Winner Announcement", icon: "🏆" },
    { id: "theme", label: "New Theme Reveal", icon: "🎨" },
    { id: "pause", label: "Competition Pause", icon: "⏸️" },
  ];

  return (
    <div className="admin-section">
      <div className="admin-section-header">
        <h2>📢 Announcement System</h2>
        <p className="admin-section-subtitle">
          Create and send announcements to the Discord channel
        </p>
      </div>

      {/* Announcement Type Selector */}
      <div className="admin-card">
        <h3 className="admin-card-title">📝 Select Announcement Type</h3>
        <div className="admin-card-content">
          <div className="announcement-type-grid">
            {announcementTypes.map((type) => (
              <button
                key={type.id}
                className={`announcement-type-btn ${
                  announcementType === type.id ? "active" : ""
                }`}
                onClick={() => setAnnouncementType(type.id)}
              >
                <span className="announcement-icon">{type.icon}</span>
                <span className="announcement-label">{type.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Message Composer */}
      <div className="admin-card">
        <h3 className="admin-card-title">✍️ Compose Message</h3>
        <div className="admin-card-content">
          {announcementType === "custom" ? (
            <div className="admin-form-group">
              <label>Custom Message:</label>
              <textarea
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
                placeholder="Enter your announcement message..."
                className="admin-textarea"
                rows="6"
              />
            </div>
          ) : (
            <div className="announcement-preview">
              <div className="preview-label">Preview:</div>
              <div className="preview-content">
                {announcementType === "submission_start" && (
                  <div>
                    <strong>🎵 Submission Phase has Started!</strong>
                    <p>This week's theme: <em>Cosmic Dreams</em></p>
                    <p>Submit your collaborations before the deadline!</p>
                  </div>
                )}
                {announcementType === "voting_start" && (
                  <div>
                    <strong>🗳️ Voting Phase is Now Open!</strong>
                    <p>Check out all the amazing submissions and cast your vote!</p>
                    <p>Voting closes soon - don't miss your chance!</p>
                  </div>
                )}
                {announcementType === "reminder" && (
                  <div>
                    <strong>⏰ Deadline Reminder!</strong>
                    <p>Only 24 hours left to submit/vote!</p>
                    <p>Make sure you don't miss out!</p>
                  </div>
                )}
                {announcementType === "winner" && (
                  <div>
                    <strong>🏆 And the Winner is...</strong>
                    <p>Congratulations to [Team Name] for winning this week!</p>
                    <p>Amazing work everyone!</p>
                  </div>
                )}
                {announcementType === "theme" && (
                  <div>
                    <strong>🎨 New Theme Revealed!</strong>
                    <p>Next week's theme is: <em>[Theme Name]</em></p>
                    <p>Get creative and start collaborating!</p>
                  </div>
                )}
                {announcementType === "pause" && (
                  <div>
                    <strong>⏸️ Competition Paused</strong>
                    <p>The competition is temporarily paused.</p>
                    <p>We'll be back soon with more challenges!</p>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="announcement-options">
            <label className="admin-checkbox-label">
              <input
                type="checkbox"
                checked={useAI}
                onChange={(e) => setUseAI(e.target.checked)}
                disabled={announcementType === "custom"}
              />
              <span>Use AI to generate message</span>
            </label>
            <label className="admin-checkbox-label">
              <input
                type="checkbox"
                checked={includeEveryone}
                onChange={(e) => setIncludeEveryone(e.target.checked)}
              />
              <span>Include @everyone ping</span>
            </label>
          </div>

          {useAI && announcementType !== "custom" && (
            <div className="admin-help-text">
              🤖 This announcement will be enhanced with AI-generated content for better engagement
            </div>
          )}
        </div>
      </div>

      {/* Send Options */}
      <div className="admin-card">
        <h3 className="admin-card-title">🚀 Send Announcement</h3>
        <div className="admin-card-content">
          <div className="send-options">
            <button onClick={handleSendAnnouncement} className="admin-btn btn-primary btn-large">
              📢 Send to Main Channel
            </button>
            <button onClick={handleSendTestMessage} className="admin-btn btn-secondary btn-large">
              🧪 Send Test Message
            </button>
          </div>
          
          <div className="admin-warning">
            ⚠️ This will post the announcement to the configured Discord channel
          </div>
        </div>
      </div>

      {/* Recent Announcements */}
      <div className="admin-card">
        <h3 className="admin-card-title">📋 Recent Announcements</h3>
        <div className="admin-card-content">
          <div className="announcement-history">
            <div className="announcement-history-item">
              <div className="history-icon">🗳️</div>
              <div className="history-content">
                <div className="history-title">Voting Phase Started</div>
                <div className="history-meta">Sent 2 hours ago • AI Generated</div>
              </div>
              <button className="history-action" onClick={() => handleViewAnnouncement("Voting Phase Started")}>View</button>
            </div>
            <div className="announcement-history-item">
              <div className="history-icon">⏰</div>
              <div className="history-content">
                <div className="history-title">Deadline Reminder</div>
                <div className="history-meta">Sent yesterday • Manual</div>
              </div>
              <button className="history-action" onClick={() => handleViewAnnouncement("Deadline Reminder")}>View</button>
            </div>
            <div className="announcement-history-item">
              <div className="history-icon">🎵</div>
              <div className="history-content">
                <div className="history-title">Submission Phase Started</div>
                <div className="history-meta">Sent 3 days ago • AI Generated</div>
              </div>
              <button className="history-action" onClick={() => handleViewAnnouncement("Submission Phase Started")}>View</button>
            </div>
          </div>
        </div>
      </div>

      {/* Auto-Announcement Settings */}
      <div className="admin-card">
        <h3 className="admin-card-title">⚙️ Auto-Announcement Settings</h3>
        <div className="admin-card-content">
          <div className="auto-announcement-settings">
            <label className="admin-checkbox-label">
              <input 
                type="checkbox" 
                checked={autoAnnouncements}
                onChange={(e) => setAutoAnnouncements(e.target.checked)}
              />
              <span>Enable automatic announcements</span>
            </label>
            <label className="admin-checkbox-label">
              <input 
                type="checkbox" 
                checked={autoSubmissionStart}
                onChange={(e) => setAutoSubmissionStart(e.target.checked)}
              />
              <span>Auto-announce submission phase start</span>
            </label>
            <label className="admin-checkbox-label">
              <input 
                type="checkbox" 
                checked={autoVotingStart}
                onChange={(e) => setAutoVotingStart(e.target.checked)}
              />
              <span>Auto-announce voting phase start</span>
            </label>
            <label className="admin-checkbox-label">
              <input 
                type="checkbox" 
                checked={autoReminders}
                onChange={(e) => setAutoReminders(e.target.checked)}
              />
              <span>Send deadline reminders (24h before)</span>
            </label>
            <label className="admin-checkbox-label">
              <input 
                type="checkbox" 
                checked={requireConfirmation}
                onChange={(e) => setRequireConfirmation(e.target.checked)}
              />
              <span>Require admin confirmation before posting</span>
            </label>
          </div>
          <button className="admin-btn btn-primary" onClick={handleSaveAutoSettings}>Save Settings</button>
        </div>
      </div>
    </div>
  );
}
