// Helper utilities for admin refresh events
export function dispatchAdminRefresh(detail = {}) {
  // Add a timestamp and lightweight trace info for uniqueness and debugging
  const payload = { ...detail, timestamp: Date.now() };
  try {
    window.dispatchEvent(new CustomEvent("admin:refresh", { detail: payload }));
  } catch (e) {
    // Fall back to a legacy Event if CustomEvent isn't supported (very old browsers)
    try {
      const evt = new Event("admin:refresh");
      // Note: older Event doesn't carry detail; so nothing to do there
      window.dispatchEvent(evt);
    } catch (ignore) {
      // no-op
    }
  }
}
