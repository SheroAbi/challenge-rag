import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "@/integrations/supabase/client";
import { normalizeRecord, deduplicateFoods } from "@/server/food/normalizer";
import { indexFoods } from "@/server/rag/indexer";
import { parseDataset } from "@/server/rag/parser";
import { indexRecords } from "@/server/rag/indexer";
import * as crypto from "crypto";

export const dynamic = "force-dynamic";

/**
 * POST /api/knowledge/upload
 * Universeller SSE-Streaming-Upload für ALLE RAG-Tabellen.
 * 
 * - targetTable = "rag_food_chunks" → Food-Pipeline (MFP-TSV stream oder generisch)
 * - targetTable = "rag_saas_chunks" | "rag_exercise_chunks" | ... → Universal-Pipeline
 * 
 * Akzeptiert: JSON, JSONL, CSV, TSV
 * Emittiert Server-Sent Events mit Live-Fortschritt.
 */
export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const targetTable =
    (formData.get("targetTable") as string) || "rag_food_chunks";

  if (!file) {
    return NextResponse.json(
      { success: false, error: "Keine Datei empfangen" },
      { status: 400 }
    );
  }

  const fileName = file.name;
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = (data: Record<string, unknown>) => {
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(data)}\n\n`)
          );
        } catch (e) {
          console.error("Failed to enqueue SSE message", e);
        }
      };

      try {
        sendEvent({ stage: "init", message: "Initialisiere Upload..." });

        const supabase = getSupabaseClient();

        // ========================================================
        // ROUTE: Food-spezifische Pipeline (MFP-TSV Streaming)
        // ========================================================
        if (targetTable === "rag_food_chunks" && fileName.toLowerCase().endsWith(".tsv")) {
          await handleFoodTsvStream(file, fileName, supabase, sendEvent);
        }
        // ========================================================
        // ROUTE: Universelle Pipeline (JSON, JSONL, CSV, TSV)
        // ========================================================
        else {
          await handleUniversalImport(file, fileName, targetTable, supabase, sendEvent);
        }
      } catch (err) {
        console.error("Error during SSE streaming:", err);
        sendEvent({
          stage: "error",
          message:
            err instanceof Error ? err.message : "Upload fehlgeschlagen",
        });
      } finally {
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      }
    },
  });

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

// ================================================================
// Handler: Food-TSV Streaming (bestehendes Verhalten)
// ================================================================
async function handleFoodTsvStream(
  file: File,
  fileName: string,
  supabase: ReturnType<typeof getSupabaseClient>,
  sendEvent: (data: Record<string, unknown>) => void
) {
  const { MfpTsvParser } = await import("@/server/food/parsers/mfp-tsv-parser");
  const mfpParser = new MfpTsvParser();

  const fileStream = file.stream();
  const reader = fileStream.pipeThrough(new TextDecoderStream()).getReader();

  let lineCount = 0;
  let processedCount = 0;
  let skippedCount = 0;
  let globalErrors = 0;
  let globalIndexed = 0;
  let partialLine = "";
  let isFirstChunk = true;
  let runId = "";

  sendEvent({ stage: "parsing", message: "Starte MFP-TSV Streaming-Import..." });

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunkStr = partialLine + value;
    const lines = chunkStr.split("\n");
    partialLine = lines.pop() || "";

    if (isFirstChunk) {
      isFirstChunk = false;
      const fileHash = crypto.randomBytes(8).toString("hex");
      const { data: run } = await supabase
        .from("import_runs")
        .insert({
          file_name: fileName,
          file_hash: fileHash,
          parser_type: "mfp_tsv",
          dataset_type: "food",
          status: "processing",
          started_at: new Date().toISOString(),
        })
        .select("id")
        .single();
      runId = run?.id;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let batchRecords: any[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const batchSkipped: any[] = [];

    for (const rawLine of lines) {
      const line = rawLine.trim();
      lineCount++;
      if (!line) continue;
      if (lineCount === 1 && !line.includes("{")) continue;

      const res = mfpParser.parseLine(line, lineCount);
      if (res.records.length > 0) batchRecords.push(...res.records);
      if (res.skipped) batchSkipped.push(res.skipped);
    }

    skippedCount += batchSkipped.length;
    processedCount += batchRecords.length;

    if (batchRecords.length > 0) {
      const normalized = batchRecords.map(normalizeRecord);
      const deduplicated = deduplicateFoods(normalized);

      sendEvent({
        stage: "embedding_start",
        message: `Streame Chunk... (${lineCount} Zeilen, ${deduplicated.length} Foods)`,
      });

      const handleProgress = (indexed: number, _total: number, logMsg?: string) => {
        if (logMsg) {
          sendEvent({ log: logMsg });
        }
        sendEvent({
          stage: "embedding_progress",
          indexed: globalIndexed + indexed,
          total: "∞",
        });
      };

      batchRecords = [];

      const idxResult = await indexFoods(deduplicated, runId, handleProgress);
      globalIndexed += idxResult.indexed;
      globalErrors += idxResult.errors;

      if (batchSkipped.length > 0 && runId) {
        const errorRows = batchSkipped.slice(0, 100).map((s) => ({
          run_id: runId,
          record_ref: `line_${s.lineOrIndex}`,
          error_code: s.reason,
          raw_preview: s.rawPreview.substring(0, 500),
        }));
        try {
          await supabase.from("import_errors").insert(errorRows);
        } catch {
          /* ignore */
        }
      }
    }
  }

  // Letzte partielle Zeile verarbeiten
  if (partialLine.trim()) {
    lineCount++;
    const res = mfpParser.parseLine(partialLine, lineCount);
    if (res.records.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const norm = res.records.map((r: any) => normalizeRecord(r));
      const result = await indexFoods(deduplicateFoods(norm), runId);
      globalIndexed += result.indexed;
      globalErrors += result.errors;
      processedCount += res.records.length;
    }
  }

  // Import-Run finalisieren
  if (runId) {
    await supabase
      .from("import_runs")
      .update({
        status: "completed",
        total_records: lineCount,
        processed: processedCount,
        deduplicated: globalIndexed,
        skipped: skippedCount,
        errors: globalErrors,
        error_summary: null,
        finished_at: new Date().toISOString(),
      })
      .eq("id", runId);
  }

  sendEvent({
    stage: "complete",
    stats: {
      totalLines: lineCount,
      parsedRecords: processedCount,
      uniqueFoods: globalIndexed,
      indexed: globalIndexed,
      skipped: skippedCount,
      errors: globalErrors,
    },
  });
}

// ================================================================
// Handler: Universal Import (JSON, JSONL, CSV, TSV → any table)
// ================================================================
async function handleUniversalImport(
  file: File,
  fileName: string,
  targetTable: string,
  supabase: ReturnType<typeof getSupabaseClient>,
  sendEvent: (data: Record<string, unknown>) => void
) {
  sendEvent({ stage: "parsing", message: `Lese ${fileName}...` });

  const content = await file.text();

  sendEvent({
    stage: "parsing",
    message: `Datei gelesen (${(content.length / 1024).toFixed(0)} KB). Erkenne Format...`,
  });

  const parsed = parseDataset(content, fileName);

  sendEvent({
    stage: "normalizing",
    message: `${parsed.records.length} Records erkannt (Format: ${parsed.format.toUpperCase()}). Übersprungen: ${parsed.skipped}`,
  });

  if (parsed.records.length === 0) {
    sendEvent({
      stage: "error",
      message: "Keine gültigen Records in der Datei gefunden.",
    });
    return;
  }

  const fileHash = crypto.randomBytes(8).toString("hex");
  const datasetType = targetTable
    .replace("rag_", "")
    .replace("_chunks", "");

  const { data: run } = await supabase
    .from("import_runs")
    .insert({
      file_name: fileName,
      file_hash: fileHash,
      parser_type: parsed.format,
      dataset_type: datasetType,
      status: "processing",
      started_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  const runId = run?.id;

  sendEvent({
    stage: "embedding_start",
    message: `Starte Embedding von ${parsed.records.length} Records in ${targetTable}...`,
  });

  const result = await indexRecords(
    targetTable,
    parsed.records,
    undefined,
    runId,
    (indexed, total, logMsg) => {
      if (logMsg) {
        sendEvent({ log: logMsg });
      }
      sendEvent({
        stage: "embedding_progress",
        indexed,
        total,
        message: `Eingebettet: ${indexed} von ${total} Records...`,
      });
    }
  );

  if (runId) {
    await supabase
      .from("import_runs")
      .update({
        status: "completed",
        total_records: parsed.totalLines,
        processed: parsed.records.length,
        deduplicated: result.indexed,
        skipped: parsed.skipped,
        errors: result.errors,
        error_summary:
          result.errors > 0
            ? result.errorDetails
                .slice(0, 5)
                .map((e) => `${e.title}: ${e.error}`)
                .join("; ")
            : null,
        finished_at: new Date().toISOString(),
      })
      .eq("id", runId);
  }

  sendEvent({
    stage: "complete",
    stats: {
      totalLines: parsed.totalLines,
      parsedRecords: parsed.records.length,
      uniqueFoods: result.indexed,
      indexed: result.indexed,
      skipped: parsed.skipped,
      errors: result.errors,
    },
  });
}
