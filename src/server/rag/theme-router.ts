import { ThemeKey } from "@/server/contracts/schemas";

export interface ThemeConfig {
  key: ThemeKey;
  label: string;
  tableName: string;
  matchRpc: string;
  description: string;
  emptyState: {
    title: string;
    description: string;
    suggestions: string[];
  };
  promptHint: string;
}

export const themeRegistry: Record<ThemeKey, ThemeConfig> = {
  saas_docs: {
    key: "saas_docs",
    label: "SaaS Help Center",
    tableName: "rag_saas_chunks",
    matchRpc: "match_rag_saas_chunks",
    description: "Hilfe-Artikel zu SaaS-Themen (Auth, Billing, etc.)",
    emptyState: {
      title: "Willkommen im SaaS Help Center",
      description: "Stelle eine Frage zu Accounts, SSO, Webhooks oder Berechtigungen.",
      suggestions: [
        "Wie richte ich SSO ein?",
        "Was sind Webhooks?",
        "Team-Berechtigungen erklären",
      ],
    },
    promptHint: "Beantworte die Frage des Nutzers als technischer Support-Mitarbeiter eines SaaS-Unternehmens.",
  },
  food: {
    key: "food",
    label: "Nutrition & Food",
    tableName: "rag_food_chunks",
    matchRpc: "match_rag_food_chunks",
    description: "Datenbank für Lebensmittel und Nährwerte",
    emptyState: {
      title: "Nutrition Explorer",
      description: "Suche nach Lebensmitteln, um Nährwerte (Kalorien, Makros) zu vergleichen.",
      suggestions: [
        "Wie viel Protein hat Hähnchenbrust?",
        "Kalorien von einem Apfel?",
        "Vergleiche Reis und Nudeln",
      ],
    },
    promptHint: "Beantworte die Frage als Ernährungsberater, basierend auf den Makro- und Mikronährstoffen im Kontext.",
  },
  exercises: {
    key: "exercises",
    label: "Workout & Exercises",
    tableName: "rag_exercise_chunks",
    matchRpc: "match_rag_exercise_chunks",
    description: "Übungen, Muskelgruppen und Fitness-Routinen",
    emptyState: {
      title: "Workout Guide",
      description: "Finde die besten Übungen für spezifische Muskeln oder Equipment.",
      suggestions: [
        "Brustübungen mit Kurzhanteln",
        "Was sind Alternativen zu Kniebeugen?",
        "Erkläre den perfekten Klimmzug",
      ],
    },
    promptHint: "Beantworte die Frage als Fitness-Coach, fokussiert auf korrekte Ausführung und Muskelgruppen.",
  },
};

/**
 * Holt die Konfiguration für ein bestimmtes Theme.
 */
export function getThemeConfig(theme: ThemeKey): ThemeConfig {
  return themeRegistry[theme];
}
