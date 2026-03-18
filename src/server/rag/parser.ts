/**
 * Universal Dataset Parser.
 * Erkennt automatisch JSON, JSONL, CSV, TSV und parst zu generischen Records.
 * Kein domänen-spezifischer Code – funktioniert für jedes Schema.
 */

export interface ParsedDataset {
  records: Record<string, unknown>[];
  format: "json" | "jsonl" | "csv" | "tsv";
  totalLines: number;
  skipped: number;
  headers: string[];
}

/**
 * Erkennt das Format einer Datei anhand von Dateiendung und Inhalt.
 */
export function detectFormat(
  fileName: string,
  sample: string
): "json" | "jsonl" | "csv" | "tsv" | null {
  const ext = fileName.toLowerCase().split(".").pop();

  if (ext === "json") {
    const trimmed = sample.trim();
    // Prüfe ob es JSONL ist (ein JSON-Objekt pro Zeile, häufig bei HuggingFace)
    if (trimmed.startsWith("{") && !trimmed.startsWith("{\n")) {
      // Schau ob nach dem ersten } eine neue Zeile mit { kommt → JSONL
      const firstNewline = trimmed.indexOf("\n");
      if (firstNewline > 0) {
        const nextChar = trimmed.substring(firstNewline).trim()[0];
        if (nextChar === "{") return "jsonl";
      }
    }
    // JSON-Array oder einzelnes Objekt
    if (trimmed.startsWith("[") || trimmed.startsWith("{")) return "json";
  }

  if (ext === "jsonl" || ext === "ndjson") return "jsonl";
  if (ext === "csv") return "csv";
  if (ext === "tsv") return "tsv";

  // Content-Sniffing als Fallback
  const trimmed = sample.trim();
  if (trimmed.startsWith("[") && trimmed.includes("}")) return "json";
  if (trimmed.startsWith("{") && trimmed.includes("\n{")) return "jsonl";

  // Tab-separated check
  const firstLine = trimmed.split("\n")[0];
  if (firstLine.split("\t").length >= 3) return "tsv";
  if (firstLine.split(",").length >= 3) return "csv";

  return null;
}

/**
 * Parst einen kompletten Dateiinhalt zu generischen Records.
 */
export function parseDataset(
  content: string,
  fileName: string
): ParsedDataset {
  const format = detectFormat(fileName, content.substring(0, 5000));

  if (!format) {
    throw new Error(
      `Unbekanntes Dateiformat für "${fileName}". Unterstützt: JSON, JSONL, CSV, TSV`
    );
  }

  switch (format) {
    case "json":
      return parseJson(content, format);
    case "jsonl":
      return parseJsonl(content, format);
    case "csv":
      return parseDelimited(content, ",", format);
    case "tsv":
      return parseDelimited(content, "\t", format);
  }
}

function parseJson(
  content: string,
  format: "json"
): ParsedDataset {
  const trimmed = content.trim();
  let data: unknown;

  try {
    data = JSON.parse(trimmed);
  } catch {
    // JSON.parse fehlgeschlagen → vermutlich JSONL (ein Objekt pro Zeile)
    // Automatischer Fallback auf JSONL-Parser
    const firstLine = trimmed.split("\n")[0].trim();
    if (firstLine.startsWith("{") && firstLine.endsWith("}")) {
      return parseJsonl(content, "jsonl");
    }
    throw new Error(
      "Ungültiges JSON. Tipp: Falls die Datei ein JSON-Objekt pro Zeile hat, " +
      "benenne sie in .jsonl um oder prüfe das Format."
    );
  }

  // JSON-Array von Objekten
  if (Array.isArray(data)) {
    const records = data.filter(
      (item): item is Record<string, unknown> =>
        typeof item === "object" && item !== null && !Array.isArray(item)
    );
    const headers = records.length > 0 ? Object.keys(records[0]) : [];
    return {
      records,
      format,
      totalLines: data.length,
      skipped: data.length - records.length,
      headers,
    };
  }

  // Einzelnes JSON-Objekt
  if (typeof data === "object" && data !== null) {
    // Vielleicht hat es ein "data" oder "rows" oder "items" Feld
    const obj = data as Record<string, unknown>;
    for (const key of ["data", "rows", "items", "records", "entries", "results", "train"]) {
      if (Array.isArray(obj[key])) {
        return parseJson(JSON.stringify(obj[key]), format);
      }
    }
    // Einzelnes Objekt als einzigen Record behandeln
    const headers = Object.keys(obj);
    return { records: [obj], format, totalLines: 1, skipped: 0, headers };
  }

  throw new Error("JSON-Datei enthält kein Array und kein Objekt.");
}

function parseJsonl(
  content: string,
  format: "jsonl"
): ParsedDataset {
  const lines = content.split("\n").filter((l) => l.trim());
  const records: Record<string, unknown>[] = [];
  let skipped = 0;

  for (const line of lines) {
    try {
      const parsed = JSON.parse(line.trim());
      if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
        records.push(parsed as Record<string, unknown>);
      } else {
        skipped++;
      }
    } catch {
      skipped++;
    }
  }

  const headers = records.length > 0 ? Object.keys(records[0]) : [];
  return { records, format, totalLines: lines.length, skipped, headers };
}

function parseDelimited(
  content: string,
  delimiter: string,
  format: "csv" | "tsv"
): ParsedDataset {
  const lines = content.split("\n").filter((l) => l.trim());
  if (lines.length < 2) {
    throw new Error("Die Datei hat weniger als 2 Zeilen (Header + 1 Record benötigt).");
  }

  // Header-Zeile
  const headers = lines[0].split(delimiter).map((h) => h.trim().replace(/^"|"$/g, ""));
  const records: Record<string, unknown>[] = [];
  let skipped = 0;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) { skipped++; continue; }

    const values = splitDelimitedLine(line, delimiter);
    if (values.length < headers.length / 2) {
      // Zu wenige Felder → vermutlich kaputte Zeile
      skipped++;
      continue;
    }

    const record: Record<string, unknown> = {};
    for (let j = 0; j < headers.length; j++) {
      const raw = (values[j] || "").trim().replace(/^"|"$/g, "");
      // Automatische Typ-Erkennung
      record[headers[j]] = autoType(raw);
    }
    records.push(record);
  }

  return { records, format, totalLines: lines.length, skipped, headers };
}

/**
 * Splittet eine Zeile unter Berücksichtigung von Anführungszeichen.
 */
function splitDelimitedLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
        current += '"';
        i++; // Skip escaped quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

/**
 * Konvertiert einen String automatisch zu number/boolean wenn möglich.
 */
function autoType(value: string): unknown {
  if (value === "") return null;
  if (value.toLowerCase() === "true") return true;
  if (value.toLowerCase() === "false") return false;
  if (value.toLowerCase() === "null" || value.toLowerCase() === "n/a") return null;

  // Nummer
  const num = Number(value);
  if (!isNaN(num) && value.trim() !== "") return num;

  return value;
}
