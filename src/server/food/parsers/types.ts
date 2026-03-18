/**
 * Food-Parser Types.
 * Gemeinsame Interfaces für alle Food-Datenformat-Parser.
 */

export interface RawFoodRecord {
  /** Originalname aus der Quelle */
  name: string;
  /** Marke (wenn vorhanden) */
  brand?: string;
  /** Portionsangabe */
  serving?: string;
  /** Numerische Nährwerte */
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  fiber?: number;
  sugar?: number;
  sodium?: number;
  /** Originaldaten für Debugging */
  rawSource?: Record<string, unknown>;
}

export interface ParseResult {
  records: RawFoodRecord[];
  skipped: SkippedRecord[];
  parserType: ParserType;
  totalLines: number;
}

export interface SkippedRecord {
  lineOrIndex: number;
  reason: string;
  rawPreview: string;
}

export type ParserType = "mfp_tsv" | "flat_tabular_food" | "json_records";

export interface FoodDatasetParser {
  readonly type: ParserType;
  canParse(sample: string, fileName: string): boolean;
  parse(content: string): ParseResult;
}
