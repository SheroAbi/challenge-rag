/**
 * MFP TSV Parser.
 * Spezialisiert auf die MFP-Diary-Exportstruktur:
 * Tab-separierte Zeilen mit verschachteltem JSON (meals/dishes).
 */

import type { FoodDatasetParser, ParseResult, RawFoodRecord, SkippedRecord } from "./types";

/** Pseudo-Foods, die nicht indexiert werden sollen */
const PSEUDO_FOOD_PATTERNS = [
  /^quick\s*added?\s*calories?$/i,
  /^custom\s*entry$/i,
  /^-$/,
];

function isPseudoFood(name: string): boolean {
  return PSEUDO_FOOD_PATTERNS.some((p) => p.test(name.trim()));
}

/**
 * Normalisiert Zahlenstrings: "1,105" → 1105, "32.5" → 32.5
 */
function parseNumber(value: unknown): number | undefined {
  if (value === null || value === undefined || value === "") return undefined;
  const str = String(value).replace(/,/g, "").trim();
  const num = parseFloat(str);
  return isNaN(num) ? undefined : num;
}

/**
 * Extrahiert Nährwerte aus dem `nutritions`-Array eines MFP-Dishes.
 */
function extractNutrition(nutritions: { name: string; value: unknown }[]): Partial<RawFoodRecord> {
  const result: Partial<RawFoodRecord> = {};
  for (const n of nutritions) {
    const val = parseNumber(n.value);
    const key = n.name?.toLowerCase().trim();
    if (key === "calories") result.calories = val;
    else if (key === "fat") result.fat = val;
    else if (key === "carbohydrates" || key === "carbs") result.carbs = val;
    else if (key === "protein") result.protein = val;
    else if (key === "fiber") result.fiber = val;
    else if (key === "sugar") result.sugar = val;
    else if (key === "sodium") result.sodium = val;
  }
  return result;
}

export class MfpTsvParser implements FoodDatasetParser {
  readonly type = "mfp_tsv" as const;

  canParse(sample: string, fileName: string): boolean {
    if (fileName.toLowerCase().endsWith(".tsv")) return true;
    const firstLine = sample.split("\n")[0];
    return firstLine.includes("\t") && (sample.includes('"meals"') || sample.includes('"dishes"'));
  }

  parseLine(line: string, index: number): { records: RawFoodRecord[], skipped?: SkippedRecord } {
    const records: RawFoodRecord[] = [];
    try {
      const fields = line.split("\t");
      
      let jsonField: string | undefined;
      for (const field of fields) {
        const trimmed = field.trim();
        if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
          jsonField = trimmed;
          break;
        }
      }

      if (!jsonField) {
        return { records, skipped: { lineOrIndex: index, reason: "no_json_field", rawPreview: line.substring(0, 120) } };
      }

      const data = JSON.parse(jsonField);
      const meals = data.meals || (Array.isArray(data) ? data : [data]);

      for (const meal of meals) {
        const dishes = meal.dishes || meal.foods || [meal];
        for (const dish of dishes) {
          if (!dish.name) continue;
          if (isPseudoFood(dish.name)) {
            return { records, skipped: { lineOrIndex: index, reason: "skipped_non_food", rawPreview: dish.name } };
          }

          const nutrition = dish.nutritions ? extractNutrition(dish.nutritions) : {};
          records.push({
            name: dish.name,
            brand: dish.brand,
            serving: dish.serving || dish.portion,
            ...nutrition,
            rawSource: dish,
          });
        }
      }
    } catch {
      return { records, skipped: { lineOrIndex: index, reason: "parse_error", rawPreview: line.substring(0, 120) } };
    }
    
    return { records };
  }

  parse(content: string): ParseResult {
    const records: RawFoodRecord[] = [];
    const skipped: SkippedRecord[] = [];
    const lines = content.split("\n").filter((l) => l.trim());
    const totalLines = lines.length;

    const firstLine = lines[0];
    let startIdx = 0;
    if (firstLine && !firstLine.includes("{")) {
      startIdx = 1; 
    }

    for (let i = startIdx; i < lines.length; i++) {
      const result = this.parseLine(lines[i], i);
      records.push(...result.records);
      if (result.skipped) skipped.push(result.skipped);
    }

    return { records, skipped, parserType: "mfp_tsv", totalLines };
  }
}
