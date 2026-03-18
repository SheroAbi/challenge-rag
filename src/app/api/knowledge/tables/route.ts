import { NextResponse } from "next/server";
import { getSupabaseClient } from "@/integrations/supabase/client";
import { themeRegistry } from "@/server/rag/theme-router";
import type { ThemeKey } from "@/server/contracts/schemas";

/**
 * GET /api/knowledge/tables
 * Dynamische Erkennung aller rag_*_chunks-Tabellen aus Supabase.
 * Liest live aus information_schema und fügt Theme-Metadaten hinzu.
 */

export interface RagTableInfo {
  tableName: string;
  themeKey: string;
  label: string;
  description: string;
  icon: string;
  color: string;
  rowCount: number;
  hasMatchRpc: boolean;
}

// Mapping von Table-Name zu Theme-Key
function tableToThemeKey(tableName: string): string | null {
  for (const [key, config] of Object.entries(themeRegistry)) {
    if (config.tableName === tableName) return key;
  }
  return null;
}

// Standard-Icons und Farben für bekannte und unbekannte Themes
const THEME_VISUALS: Record<string, { icon: string; color: string }> = {
  food: { icon: "🥗", color: "from-emerald-500 to-teal-600" },
  saas_docs: { icon: "📘", color: "from-blue-500 to-indigo-600" },
  exercises: { icon: "💪", color: "from-orange-500 to-red-600" },
  _default: { icon: "📦", color: "from-purple-500 to-violet-600" },
};

export async function GET() {
  try {
    const supabase = getSupabaseClient();

    // 1. Alle rag_*_chunks Tabellen aus information_schema lesen
    const { data: tablesData, error: tablesError } = await supabase.rpc(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      "get_rag_tables" as any
    );

    let tables: RagTableInfo[];

    if (tablesError || !tablesData) {
      // Fallback: nutze die bekannten Tabellen aus dem Theme-Registry
      tables = await getFallbackTables(supabase);
    } else {
      tables = (tablesData as { table_name: string; row_count: number }[]).map(
        (t) => {
          const themeKey = tableToThemeKey(t.table_name);
          const config = themeKey
            ? themeRegistry[themeKey as ThemeKey]
            : null;
          const visuals =
            THEME_VISUALS[themeKey || ""] || THEME_VISUALS._default;

          return {
            tableName: t.table_name,
            themeKey: themeKey || t.table_name.replace("rag_", "").replace("_chunks", ""),
            label: config?.label || formatTableLabel(t.table_name),
            description: config?.description || `RAG-Datenbank: ${t.table_name}`,
            icon: visuals.icon,
            color: visuals.color,
            rowCount: t.row_count || 0,
            hasMatchRpc: !!config,
          };
        }
      );
    }

    return NextResponse.json({ tables });
  } catch {
    // Ultimate Fallback
    return NextResponse.json({ tables: getHardcodedTables() });
  }
}

/**
 * Fallback: Zähle direkt aus den bekannten Tabellen.
 */
async function getFallbackTables(supabase: ReturnType<typeof getSupabaseClient>): Promise<RagTableInfo[]> {
  const results: RagTableInfo[] = [];

  for (const [key, config] of Object.entries(themeRegistry)) {
    const visuals = THEME_VISUALS[key] || THEME_VISUALS._default;

    let rowCount = 0;
    try {
      const { count } = await supabase
        .from(config.tableName)
        .select("*", { count: "exact", head: true });
      rowCount = count ?? 0;
    } catch {
      // Tabelle existiert möglicherweise nicht
    }

    results.push({
      tableName: config.tableName,
      themeKey: key,
      label: config.label,
      description: config.description,
      icon: visuals.icon,
      color: visuals.color,
      rowCount,
      hasMatchRpc: true,
    });
  }

  return results;
}

/**
 * Hardcoded Fallback wenn gar nichts funktioniert.
 */
function getHardcodedTables(): RagTableInfo[] {
  return Object.entries(themeRegistry).map(([key, config]) => {
    const visuals = THEME_VISUALS[key] || THEME_VISUALS._default;
    return {
      tableName: config.tableName,
      themeKey: key,
      label: config.label,
      description: config.description,
      icon: visuals.icon,
      color: visuals.color,
      rowCount: 0,
      hasMatchRpc: true,
    };
  });
}

/**
 * Formatiert einen Tabellennamen zu einem lesbaren Label.
 * z.B. "rag_custom_chunks" → "Custom"
 */
function formatTableLabel(tableName: string): string {
  return tableName
    .replace("rag_", "")
    .replace("_chunks", "")
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
