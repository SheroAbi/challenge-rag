/**
 * Food Normalizer.
 * Normalisiert RawFoodRecords zu kanonischen Food-Items:
 * - Brand/Name/Serving-Splitting aus MFP-Namensmuster
 * - Canonical-Key-Berechnung für Deduplizierung
 * - Alias-Sammlung und Occurrence-Tracking
 */

import type { RawFoodRecord } from "./parsers/types";

export interface NormalizedFood {
  canonicalKey: string;
  displayName: string;
  canonicalName: string;
  brand: string | null;
  servingText: string | null;
  aliases: string[];
  caloriesKcal: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  fiberG: number | null;
  sugarG: number | null;
  sodiumMg: number | null;
  occurrenceCount: number;
  searchText: string;
  metadata: Record<string, unknown>;
}

/**
 * Versucht aus MFP-Namen wie "Brand - Item, 60 g" die Bestandteile zu extrahieren.
 */
function splitMfpName(name: string): { brand: string | null; itemName: string; serving: string | null } {
  let brand: string | null = null;
  let itemName = name;
  let serving: string | null = null;

  // Pattern: "Brand - Item Name"
  const dashMatch = name.match(/^(.+?)\s*-\s+(.+)$/);
  if (dashMatch) {
    brand = dashMatch[1].trim();
    itemName = dashMatch[2].trim();
  }

  // Pattern: "Item, 60 g" oder "Item (60g)"
  const servingMatch = itemName.match(/^(.+?),\s*(\d+\s*(?:g|ml|oz|stk|portionen?|stück|scheiben?|tasse|cup).*?)$/i);
  if (servingMatch) {
    itemName = servingMatch[1].trim();
    serving = servingMatch[2].trim();
  } else {
    const parenMatch = itemName.match(/^(.+?)\s*\((\d+\s*(?:g|ml|oz).*?)\)\s*$/i);
    if (parenMatch) {
      itemName = parenMatch[1].trim();
      serving = parenMatch[2].trim();
    }
  }

  return { brand, itemName, serving };
}

/**
 * Erzeugt einen stabilen Canonical Key aus Name, Brand, Portion und Kern-Makros.
 */
function buildCanonicalKey(name: string, brand: string | null, serving: string | null, macros: { cal?: number; pro?: number; carb?: number; fat?: number }): string {
  const parts: string[] = [];
  parts.push(name.toLowerCase().replace(/[^a-z0-9äöüß]/g, ""));
  if (brand) parts.push(brand.toLowerCase().replace(/[^a-z0-9äöüß]/g, ""));
  if (serving) parts.push(serving.toLowerCase().replace(/[^a-z0-9]/g, ""));
  // Gerundete Makro-Signatur für Varianten-Erkennung
  if (macros.cal !== undefined) parts.push(`c${Math.round(macros.cal / 10) * 10}`);
  if (macros.pro !== undefined) parts.push(`p${Math.round(macros.pro)}`);
  return parts.join("|");
}

/**
 * Normalisiert ein einzelnes RawFoodRecord.
 */
export function normalizeRecord(record: RawFoodRecord): NormalizedFood {
  const { brand: parsedBrand, itemName, serving: parsedServing } = splitMfpName(record.name);

  const brand = record.brand || parsedBrand;
  const serving = record.serving || parsedServing;
  const displayName = record.name;
  const canonicalName = itemName;

  const canonicalKey = buildCanonicalKey(
    canonicalName,
    brand,
    serving,
    { cal: record.calories, pro: record.protein, carb: record.carbs, fat: record.fat }
  );

  // Suchtext: alles was findbar sein soll
  const searchParts = [displayName, canonicalName];
  if (brand) searchParts.push(brand);
  const searchText = searchParts.join(" ").toLowerCase();

  return {
    canonicalKey,
    displayName,
    canonicalName,
    brand: brand || null,
    servingText: serving || null,
    aliases: displayName !== canonicalName ? [displayName] : [],
    caloriesKcal: record.calories ?? null,
    proteinG: record.protein ?? null,
    carbsG: record.carbs ?? null,
    fatG: record.fat ?? null,
    fiberG: record.fiber ?? null,
    sugarG: record.sugar ?? null,
    sodiumMg: record.sodium ?? null,
    occurrenceCount: 1,
    searchText,
    metadata: {
      ...(record.rawSource ? { rawSource: record.rawSource } : {}),
    },
  };
}

/**
 * Dedupliziert eine Liste von normalisierten Foods.
 * Gleicher canonical_key → merge (Alias-Sammlung, Occurrence-Count erhöhen).
 * Gleicher Name aber deutlich andere Makros → getrennte Einträge.
 */
export function deduplicateFoods(foods: NormalizedFood[]): NormalizedFood[] {
  const map = new Map<string, NormalizedFood>();

  for (const food of foods) {
    const existing = map.get(food.canonicalKey);
    if (existing) {
      // Merge: Aliases sammeln, Occurrence hochzählen
      existing.occurrenceCount += 1;
      for (const alias of food.aliases) {
        if (!existing.aliases.includes(alias)) {
          existing.aliases.push(alias);
        }
      }
      if (!existing.aliases.includes(food.displayName) && food.displayName !== existing.displayName) {
        existing.aliases.push(food.displayName);
      }
    } else {
      map.set(food.canonicalKey, { ...food });
    }
  }

  return Array.from(map.values());
}
