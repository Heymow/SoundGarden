import { useEffect, useRef } from "react";

// Simple hook to subscribe to admin:refresh events and optional polling
// Usage: useAdminRefresh({ onRefresh: (detail) => { /* ... */ }, pollInterval: 10000, eventFilter: (detail) => boolean, immediate: true })
export default function useAdminRefresh({
  onRefresh,
  pollInterval = null,
  eventFilter = null,
  immediate = false,
}) {
  const callbackRef = useRef(onRefresh);
  useEffect(() => {
    callbackRef.current = onRefresh;
  }, [onRefresh]);

  useEffect(() => {
    const handler = (e) => {
      // CustomEvent detail may be undefined for legacy events
      const detail = (e && e.detail) || {};
      if (typeof eventFilter === "function" && !eventFilter(detail)) return;
      if (typeof callbackRef.current === "function")
        callbackRef.current(detail);
    };

    window.addEventListener("admin:refresh", handler);

    let iv = null;
    if (pollInterval && typeof pollInterval === "number" && pollInterval > 0) {
      iv = setInterval(() => {
        if (typeof callbackRef.current === "function")
          callbackRef.current({ type: "poll" });
      }, pollInterval);
    }

    if (immediate && typeof callbackRef.current === "function")
      callbackRef.current({ type: "mount" });

    return () => {
      window.removeEventListener("admin:refresh", handler);
      if (iv) clearInterval(iv);
    };
  }, [eventFilter, pollInterval, immediate]);
}
