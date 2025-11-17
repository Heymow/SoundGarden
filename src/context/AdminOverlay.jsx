import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

const AdminOverlayContext = createContext(null);

export function AdminOverlayProvider({ children }) {
  const [loadingCount, setLoadingCount] = useState(0);
  const [alert, setAlert] = useState(null);
  const [blockingText, setBlockingText] = useState(null);
  const [activeActions, setActiveActions] = useState({});

  const showLoading = useCallback(() => setLoadingCount((c) => c + 1), []);
  const hideLoading = useCallback(() => setLoadingCount((c) => Math.max(0, c - 1)), []);
  const clearLoading = useCallback(() => setLoadingCount(0), []);

  const startAction = useCallback((name) => setActiveActions((prev) => ({ ...prev, [name]: (prev[name] || 0) + 1 })), []);
  const endAction = useCallback((name) => setActiveActions((prev) => {
    if (!prev[name]) return prev;
    const next = { ...prev, [name]: Math.max(0, prev[name] - 1) };
    if (next[name] === 0) delete next[name];
    return next;
  }), []);
  const hasAction = useCallback((name) => !!activeActions[name], [activeActions]);

  const showAlert = useCallback((type, message, { autoHide = 5000 } = {}) => {
    setAlert({ type, message });
    if (autoHide > 0) setTimeout(() => setAlert(null), autoHide);
  }, []);
  const hideAlert = useCallback(() => setAlert(null), []);

  const showBlockingText = useCallback((text) => setBlockingText(text), []);
  const hideBlockingText = useCallback(() => setBlockingText(null), []);

  const blockingRun = useCallback(async (text, fn) => {
    try {
      showBlockingText(text);
      await fn();
    } finally {
      hideBlockingText();
    }
  }, [showBlockingText, hideBlockingText]);

  const value = useMemo(() => ({
    loading: loadingCount > 0,
    loadingCount,
    blockingText,
    activeActions,
    startAction,
    endAction,
    hasAction,
    showLoading,
    hideLoading,
    clearLoading,
    showBlockingText,
    hideBlockingText,
    blockingRun,
    alert,
    showAlert,
    hideAlert,
  }), [loadingCount, blockingText, activeActions, startAction, endAction, hasAction, showLoading, hideLoading, clearLoading, showBlockingText, hideBlockingText, blockingRun, alert, showAlert, hideAlert]);

  return (
    <AdminOverlayContext.Provider value={value}>
      {children}
      {value.loading && (
        <div className="admin-overlay" role="status" aria-label="Loading admin action" aria-live="polite">
          <div style={{ textAlign: 'center' }}>
            <div className="admin-spinner" />
            <div className="admin-overlay-text">Processing…</div>
          </div>
        </div>
      )}
      {value.blockingText && (
        <div className="admin-overlay admin-overlay--blocking" role="status" aria-label="Blocking action" aria-live="polite">
          <div style={{ textAlign: 'center' }}>
            <div className="admin-overlay-text">{value.blockingText}</div>
          </div>
        </div>
      )}
      {value.alert && (
        <div className={`admin-alert-overlay ${value.alert.type}`} role="alert" aria-live="assertive">
          <div className="admin-alert-inner">
            <div className="admin-alert-message">{value.alert.message}</div>
            <button className="admin-alert-close" onClick={value.hideAlert}>✕</button>
          </div>
        </div>
      )}
    </AdminOverlayContext.Provider>
  );
}

export function useAdminOverlay() {
  const ctx = useContext(AdminOverlayContext);
  if (!ctx) throw new Error('useAdminOverlay must be used within AdminOverlayProvider');
  return ctx;
}

export default AdminOverlayContext;
