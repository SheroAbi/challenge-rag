import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Serverseitiger Supabase-Client mit Service Role Key.
 * Wird nur in Route Handlers und Server-Komponenten verwendet.
 * Kein Client-seitiger Zugriff – alle DB-Operationen laufen serverseitig.
 */

let supabaseInstance: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (supabaseInstance) return supabaseInstance;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    console.warn(
      "⚠️ Supabase-Konfiguration fehlt. Client wird mit Platzhaltern erstellt (Skeleton-Modus)."
    );
    // Im Skeleton-Modus erstellen wir trotzdem eine Instanz,
    // damit die App startet – Aufrufe werden aber fehlschlagen.
    supabaseInstance = createClient(
      url || "http://localhost:54321",
      key || "placeholder-key"
    );
    return supabaseInstance;
  }

  supabaseInstance = createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return supabaseInstance;
}

/**
 * Typ-Export für typisierte Supabase-Abfragen.
 * Nach Schema-Generierung kann hier das generierte DB-Schema eingesetzt werden.
 */
export type { SupabaseClient };
