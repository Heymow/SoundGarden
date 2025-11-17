import React, { createContext, useState, useContext, useMemo, useCallback } from 'react';

const AdminOverlayContext = createContext(null);

export function AdminOverlayProvider({ children }) {
    const [loadingCount, setLoadingCount] = useState(0);
    const [alert, setAlert] = useState(null); // { type: 'success'|'error', message }

    const showLoading = useCallback(() => setLoadingCount((c) => c + 1), []);
    const hideLoading = useCallback(() => setLoadingCount((c) => Math.max(0, c - 1)), []);
    const clearLoading = useCallback(() => setLoadingCount(0), []);

    const showAlert = useCallback((type, message, { autoHide = 5000 } = {}) => {
        setAlert({ type, message });
        if (autoHide > 0) setTimeout(() => setAlert(null), autoHide);
    }, []);
    const hideAlert = useCallback(() => setAlert(null), []);

    const value = useMemo(() => ({
        loading: loadingCount > 0,
        loadingCount,
        showLoading,
        hideLoading,
        clearLoading,
        alert,
        showAlert,
        hideAlert
    }), [loadingCount, showLoading, hideLoading, clearLoading, alert, showAlert, hideAlert]);

    return (
        <AdminOverlayContext.Provider value={value}>
            {children}
            {/* Overlay markup */}
            {value.loading && (
                <div className="admin-overlay" role="status" aria-live="polite">
                    <div style={{ textAlign: 'center' }}>
                        <div className="admin-spinner" />
                        <div className="admin-overlay-text">Processing…</div>
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
