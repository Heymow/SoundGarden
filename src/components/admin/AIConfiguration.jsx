import React, { useState } from "react";
import * as botApi from "../../services/botApi";
import { useAdminOverlay } from "../../context/AdminOverlayContext";

export default function AIConfiguration() {
  const [aiEnabled, setAiEnabled] = useState(true);
  const [apiUrl, setApiUrl] = useState("https://api.openai.com/v1/chat/completions");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("gpt-3.5-turbo");
  const [temperature, setTemperature] = useState(0.8);
  const [maxTokens, setMaxTokens] = useState(150);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const overlay = useAdminOverlay();

  const showSuccess = (message) => overlay.showAlert('success', message);
  const showError = (message) => overlay.showAlert('error', message);

  const handleTestAI = async () => {
    setLoading(true);
    overlay.showLoading();
    try {
      await botApi.testAI();
      showSuccess("✅ AI connection successful! Model is responding correctly.");
    } catch (err) {
      showError(`❌ AI connection failed: ${err.message}`);
    } finally {
      setLoading(false);
      overlay.hideLoading();
    }
  };

  const handleSaveConfig = async () => {
    if (!apiUrl.trim()) {
      showError("❌ Please enter an API URL");
      return;
    }

    setLoading(true);
    overlay.showLoading();
    try {
      const updates = {
        ai_api_url: apiUrl,
        ai_model: model,
        ai_temperature: temperature,
        ai_max_tokens: maxTokens,
      };
      await botApi.updateAdminConfig(updates);
      showSuccess("✅ AI configuration saved successfully!");
    } catch (err) {
      showError(`❌ Failed to save AI configuration: ${err.message}`);
    } finally {
      setLoading(false);
      overlay.hideLoading();
    }
  };

  const handleEditTemplate = (templateName) => {
    showSuccess(`✏️ Opening template editor for: ${templateName}`);
  };

  return (
    <div className="admin-section">
      <div className="admin-section-header">
        <h2>🤖 AI Configuration</h2>
        <p className="admin-section-subtitle">
          Configure AI settings for announcement generation
        </p>
      </div>

      {/* AI Status */}
      <div className="admin-card">
        <h3 className="admin-card-title">📊 AI Status</h3>
        <div className="admin-card-content">
          <div className="ai-status-grid">
            <div className={`status-indicator ${aiEnabled ? "active" : "inactive"}`}>
              <div className="status-dot"></div>
              <span>{aiEnabled ? "AI Enabled" : "AI Disabled"}</span>
            </div>
            <label className="admin-checkbox-label">
              <input
                type="checkbox"
                checked={aiEnabled}
                onChange={(e) => setAiEnabled(e.target.checked)}
              />
              <span>Enable AI-generated announcements</span>
            </label>
          </div>
        </div>
      </div>

      {/* API Configuration */}
      <div className="admin-card">
        <h3 className="admin-card-title">🔌 API Configuration</h3>
        <div className="admin-card-content">
          <div className="admin-form-group">
            <label>API URL:</label>
            <input
              type="text"
              value={apiUrl}
              onChange={(e) => setApiUrl(e.target.value)}
              placeholder="https://api.openai.com/v1/chat/completions"
              className="admin-input"
            />
            <div className="admin-help-text">
              Compatible with OpenAI API and free alternatives
            </div>
          </div>

          <div className="admin-form-group">
            <label>API Key:</label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Enter your API key..."
              className="admin-input"
            />
            <div className="admin-help-text">
              Your API key is stored securely and never shared
            </div>
          </div>

          <div className="admin-form-group">
            <label>Model:</label>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="admin-input"
            >
              <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
              <option value="gpt-4">GPT-4</option>
              <option value="claude-3-sonnet">Claude 3 Sonnet</option>
              <option value="mixtral-8x7b">Mixtral 8x7B</option>
            </select>
          </div>

          <button onClick={handleTestAI} className="admin-btn btn-secondary">
            🧪 Test Connection
          </button>
        </div>
      </div>

      {/* Generation Settings */}
      <div className="admin-card">
        <h3 className="admin-card-title">⚙️ Generation Settings</h3>
        <div className="admin-card-content">
          <div className="admin-form-group">
            <label>
              Temperature: {temperature}
              <span className="setting-hint">(Creativity level)</span>
            </label>
            <input
              type="range"
              min="0"
              max="2"
              step="0.1"
              value={temperature}
              onChange={(e) => setTemperature(parseFloat(e.target.value))}
              className="admin-slider"
            />
            <div className="slider-labels">
              <span>Conservative</span>
              <span>Balanced</span>
              <span>Creative</span>
            </div>
          </div>

          <div className="admin-form-group">
            <label>
              Max Tokens: {maxTokens}
              <span className="setting-hint">(Response length)</span>
            </label>
            <input
              type="range"
              min="50"
              max="500"
              step="10"
              value={maxTokens}
              onChange={(e) => setMaxTokens(parseInt(e.target.value))}
              className="admin-slider"
            />
            <div className="slider-labels">
              <span>Short</span>
              <span>Medium</span>
              <span>Long</span>
            </div>
          </div>

          <div className="admin-help-text">
            💡 Higher temperature = more creative but less predictable responses
          </div>
        </div>
      </div>

      {/* Prompt Templates */}
      <div className="admin-card">
        <h3 className="admin-card-title">📝 Prompt Templates</h3>
        <div className="admin-card-content">
          <div className="template-list">
            <div className="template-item">
              <div className="template-header">
                <strong>Submission Phase</strong>
                <button className="admin-btn-sm btn-secondary" onClick={() => handleEditTemplate("Submission Phase")}>Edit</button>
              </div>
              <div className="template-preview">
                "Generate an exciting announcement for starting the submission phase..."
              </div>
            </div>
            <div className="template-item">
              <div className="template-header">
                <strong>Voting Phase</strong>
                <button className="admin-btn-sm btn-secondary" onClick={() => handleEditTemplate("Voting Phase")}>Edit</button>
              </div>
              <div className="template-preview">
                "Generate an engaging announcement to encourage voting..."
              </div>
            </div>
            <div className="template-item">
              <div className="template-header">
                <strong>Theme Generation</strong>
                <button className="admin-btn-sm btn-secondary" onClick={() => handleEditTemplate("Theme Generation")}>Edit</button>
              </div>
              <div className="template-preview">
                "Generate a creative and inspiring music collaboration theme..."
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Save Configuration */}
      <div className="admin-card">
        <div className="admin-card-content">
          <button onClick={handleSaveConfig} className="admin-btn btn-primary btn-large">
            💾 Save AI Configuration
          </button>
        </div>
      </div>
    </div>
  );
}
