"use client";

import { useEffect, useRef, useCallback } from "react";

/**
 * useWarmup – Session-basierter + Idle-Refresh-Warmup.
 * Feuert einmal pro Browser-Session beim ersten Mount.
 * Bei >5min Inaktivität (Tab wechsel / hidden) wird beim Zurückkehren erneut gewärmt.
 */
export function useWarmup() {
  const lastWarmupRef = useRef(0);
  const IDLE_THRESHOLD_MS = 5 * 60 * 1000; // 5 Minuten

  const doWarmup = useCallback(async () => {
    try {
      lastWarmupRef.current = Date.now();
      await fetch("/api/warmup", {
        method: "POST",
        signal: AbortSignal.timeout(20000),
      });
    } catch {
      // Fire-and-forget: Fehler nie blockierend
    }
  }, []);

  useEffect(() => {
    // Session-Warmup: einmal pro Browser-Session
    const flag = sessionStorage.getItem("everlast-warmup");
    if (flag !== "done") {
      sessionStorage.setItem("everlast-warmup", "pending");
      doWarmup().then(() => {
        sessionStorage.setItem("everlast-warmup", "done");
      }).catch(() => {
        sessionStorage.removeItem("everlast-warmup");
      });
    }

    // Idle-Refresh: bei Rückkehr nach Inaktivität
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        const elapsed = Date.now() - lastWarmupRef.current;
        if (elapsed > IDLE_THRESHOLD_MS) {
          doWarmup();
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [doWarmup, IDLE_THRESHOLD_MS]);
}
