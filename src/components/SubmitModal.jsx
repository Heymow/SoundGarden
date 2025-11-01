import React, { useState } from 'react';

export default function SubmitModal({ isOpen, onClose, onSubmit }) {
  const [formData, setFormData] = useState({
    title: '',
    participant1: '',
    participant2: '',
    sunoAccount1: '',
    sunoAccount2: '',
    sunoUrl: ''
  });

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (formData.title && formData.participant1 && formData.participant2 && 
        formData.sunoAccount1 && formData.sunoAccount2 && formData.sunoUrl) {
      onSubmit(formData);
      setFormData({
        title: '',
        participant1: '',
        participant2: '',
        sunoAccount1: '',
        sunoAccount2: '',
        sunoUrl: ''
      });
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Submit Your Song</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        
        <form onSubmit={handleSubmit} className="submit-form">
          <div className="form-group">
            <label>Song Title *</label>
            <input
              type="text"
              name="title"
              value={formData.title}
              onChange={handleChange}
              placeholder="Enter song title"
              required
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Participant 1 *</label>
              <input
                type="text"
                name="participant1"
                value={formData.participant1}
                onChange={handleChange}
                placeholder="Discord username"
                required
              />
            </div>
            
            <div className="form-group">
              <label>Participant 2 *</label>
              <input
                type="text"
                name="participant2"
                value={formData.participant2}
                onChange={handleChange}
                placeholder="Discord username"
                required
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Suno Account 1 *</label>
              <input
                type="text"
                name="sunoAccount1"
                value={formData.sunoAccount1}
                onChange={handleChange}
                placeholder="@username"
                required
              />
            </div>
            
            <div className="form-group">
              <label>Suno Account 2 *</label>
              <input
                type="text"
                name="sunoAccount2"
                value={formData.sunoAccount2}
                onChange={handleChange}
                placeholder="@username"
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label>Suno Song URL *</label>
            <input
              type="url"
              name="sunoUrl"
              value={formData.sunoUrl}
              onChange={handleChange}
              placeholder="https://suno.com/song/..."
              required
            />
          </div>

          <div className="modal-actions">
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" className="btn-primary">
              Submit Song
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
