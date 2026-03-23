"use client";

import { useWarmup } from "@/lib/hooks/use-warmup";

/**
 * Stiller Warmup-Trigger.
 * Wird in der Landingpage eingebunden und feuert einmal pro Session.
 * Rendert nichts sichtbares.
 */
export function WarmupTrigger() {
  useWarmup();
  return null;
}
