"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import {
  X,
  Upload,
  FileUp,
  Database,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Sparkles,
  ChevronDown,
  FileSpreadsheet,
  Zap,
  BarChart3,
  ArrowRight,
  RefreshCw,
  Terminal,
  ChevronUp,
} from "lucide-react";

type UploadStage = "idle" | "selected" | "uploading" | "processing" | "complete" | "error";

interface UploadStats {
  totalLines: number;
  parsedRecords: number;
  uniqueFoods: number;
  indexed: number;
  skipped: number;
  errors: number;
}

interface RagTableInfo {
  tableName: string;
  themeKey: string;
  label: string;
  description: string;
  icon: string;
  color: string;
  rowCount: number;
  hasMatchRpc: boolean;
}

const ACCEPTED_EXTENSIONS = ".tsv,.csv,.json,.jsonl,.ndjson";

// Fallback Tabellen falls API nicht erreichbar
const FALLBACK_TABLES: RagTableInfo[] = [
  {
    tableName: "rag_food_chunks",
    themeKey: "food",
    label: "Nutrition & Food",
    description: "Lebensmittel, Nährwerte, MFP-Imports",
    icon: "🥗",
    color: "from-emerald-500 to-teal-600",
    rowCount: 0,
    hasMatchRpc: true,
  },
  {
    tableName: "rag_saas_chunks",
    themeKey: "saas_docs",
    label: "SaaS Help Center",
    description: "Help-Artikel, API-Docs, FAQs",
    icon: "📘",
    color: "from-blue-500 to-indigo-600",
    rowCount: 0,
    hasMatchRpc: true,
  },
  {
    tableName: "rag_exercise_chunks",
    themeKey: "exercises",
    label: "Workout & Exercises",
    description: "Übungen, Muskelgruppen, Fitness",
    icon: "💪",
    color: "from-orange-500 to-red-600",
    rowCount: 0,
    hasMatchRpc: true,
  },
];

export default function RagUploadModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [stage, setStage] = useState<UploadStage>("idle");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [ragTables, setRagTables] = useState<RagTableInfo[]>(FALLBACK_TABLES);
  const [selectedTable, setSelectedTable] = useState<RagTableInfo>(FALLBACK_TABLES[0]);
  const [isDragging, setIsDragging] = useState(false);
  const [stats, setStats] = useState<UploadStats | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [progressText, setProgressText] = useState("");
  const [logs, setLogs] = useState<string[]>([]);
  const [logsOpen, setLogsOpen] = useState(false);
  const [tableDropdownOpen, setTableDropdownOpen] = useState(false);
  const [tablesLoading, setTablesLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const selectedTableRef = useRef(selectedTable.tableName);

  // Live-Tabellen aus Supabase laden
  const fetchTables = useCallback(async () => {
    setTablesLoading(true);
    try {
      const res = await fetch("/api/knowledge/tables");
      if (res.ok) {
        const data = await res.json();
        if (data.tables && data.tables.length > 0) {
          setRagTables(data.tables);
          // Behalte aktuelle Auswahl wenn möglich (lese aus Ref, nicht aus State!)
          const currentName = selectedTableRef.current;
          const current = data.tables.find(
            (t: RagTableInfo) => t.tableName === currentName
          );
          if (current) {
            setSelectedTable(current);
          } else {
            setSelectedTable(data.tables[0]);
            selectedTableRef.current = data.tables[0].tableName;
          }
        }
      }
    } catch {
      // Fallback wird beibehalten
    } finally {
      setTablesLoading(false);
    }
  }, []); // KEINE deps auf selectedTable! Ref wird stattdessen gelesen.

  // Tabellen laden wenn Modal öffnet
  useEffect(() => {
    if (isOpen) {
      fetchTables();
    }
  }, [isOpen, fetchTables]);

  // Reset-Funktion
  const reset = useCallback(() => {
    setStage("idle");
    setSelectedFile(null);
    setStats(null);
    setErrorMsg("");
    setProgressText("");
    setLogs([]);
    setLogsOpen(false);
    setTableDropdownOpen(false);
  }, []);

  // Schließen plus Reset
  const handleClose = useCallback(() => {
    reset();
    onClose();
  }, [reset, onClose]);

  // ESC Key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    if (isOpen) window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, handleClose]);

  // Drag & Drop Handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      setSelectedFile(files[0]);
      setStage("selected");
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      setSelectedFile(files[0]);
      setStage("selected");
    }
  };

  // Upload!
  const handleUpload = async () => {
    if (!selectedFile) return;
    setStage("uploading");
    setProgressText("Initiiere Upload...");
    setStats(null);
    setErrorMsg("");
    setLogs([]);
    setLogsOpen(true);

    const addLog = (msg: string) => {
      const timestamp = new Date().toLocaleTimeString('de-DE', { hour12: false });
      setLogs((prev) => [...prev, `[${timestamp}] ${msg}`]);
    };

    addLog(`Upload gestartet: ${selectedFile.name} (${formatFileSize(selectedFile.size)}) -> ${selectedTable.tableName}`);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("targetTable", selectedTable.tableName);

      const response = await fetch(`/api/knowledge/upload`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok || !response.body) {
        setStage("error");
        setErrorMsg("Upload fehlgeschlagen (Server Error)");
        return;
      }

      setStage("processing");
      
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        
        for (let i = 0; i < lines.length - 1; i++) {
          const line = lines[i];
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              
              if (data.log) {
                 addLog(data.log);
              }
              
              if (data.stage === "init") setProgressText(data.message);
              if (data.stage === "parsing") setProgressText(data.message);
              if (data.stage === "normalizing") setProgressText(data.message);
              if (data.stage === "embedding_start") {
                setProgressText(data.message);
              }
              if (data.stage === "embedding_progress") {
                setProgressText(data.message || `Eingebettet: ${data.indexed} von ${data.total} Items...`);
              }
              if (data.stage === "complete") {
                setStats(data.stats);
                setStage("complete");
                addLog(`✓ Import erfolgreich beendet mit ${data.stats?.indexed || 0} indexierten Einträgen.`);
              }
              if (data.stage === "error") {
                setStage("error");
                setErrorMsg(data.message);
                addLog(`❌ FEHLER: ${data.message}`);
              }
            } catch (e) {
              console.error("SSE Parse Error", e);
            }
          }
        }
        buffer = lines[lines.length - 1];
      }

    } catch (err) {
      setStage("error");
      setErrorMsg(err instanceof Error ? err.message : "Netzwerkfehler");
    }
  };

  // Auto-scroll logs
  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, logsOpen]);

  if (!isOpen) return null;

  const formatFileSize = (size: number) => {
    if (size > 1024 * 1024) return `${(size / 1024 / 1024).toFixed(1)} MB`;
    return `${(size / 1024).toFixed(0)} KB`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-xl mx-4 bg-card border border-border rounded-3xl shadow-2xl overflow-hidden animate-slide-up">
        {/* Gradient Header */}
        <div className={`relative bg-gradient-to-r ${selectedTable.color} px-6 py-5`}>
          <div className="absolute inset-0 bg-black/10" />
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 backdrop-blur text-lg">
                {selectedTable.icon}
              </div>
              <div>
                <h2 className="text-base font-bold text-white">RAG-Daten importieren</h2>
                <p className="text-xs text-white/70">Universal-Import in jede Vektordatenbank</p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 text-white/80 hover:bg-white/20 hover:text-white transition-all"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-5">
          {/* Target Table Selector */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Ziel-Datenbank
              </label>
              <button
                onClick={fetchTables}
                className="inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-primary transition-colors"
                title="Tabellen aktualisieren"
              >
                <RefreshCw className={`h-3 w-3 ${tablesLoading ? "animate-spin" : ""}`} />
                Live
              </button>
            </div>
            <div className="relative">
              <button
                onClick={() => setTableDropdownOpen(!tableDropdownOpen)}
                className="w-full flex items-center justify-between bg-background border border-border rounded-xl px-4 py-3 text-sm font-medium text-foreground hover:border-primary/50 transition-all"
              >
                <div className="flex items-center gap-3">
                  <span className="text-lg">{selectedTable.icon}</span>
                  <div className="text-left">
                    <div className="font-semibold">{selectedTable.label}</div>
                    <div className="text-xs text-muted-foreground font-mono flex items-center gap-2">
                      {selectedTable.tableName}
                      {selectedTable.rowCount > 0 && (
                        <span className="inline-flex items-center gap-1 bg-primary/10 text-primary rounded-full px-1.5 py-0.5 text-[10px] font-bold">
                          {selectedTable.rowCount} chunks
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${tableDropdownOpen ? "rotate-180" : ""}`} />
              </button>

              {tableDropdownOpen && (
                <div className="absolute top-full left-0 right-0 z-10 mt-1 border border-border bg-card rounded-xl shadow-lg overflow-hidden">
                  {ragTables.map((t) => (
                    <button
                      key={t.tableName}
                      onClick={() => {
                        setSelectedTable(t);
                        selectedTableRef.current = t.tableName;
                        setTableDropdownOpen(false);
                      }}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-all hover:bg-muted ${t.tableName === selectedTable.tableName ? "bg-primary/5 border-l-2 border-l-primary" : ""}`}
                    >
                      <span className="text-lg">{t.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-foreground">{t.label}</div>
                        <div className="text-xs text-muted-foreground">{t.description}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        {t.rowCount > 0 && (
                          <span className="text-[10px] font-bold text-muted-foreground bg-muted rounded-full px-2 py-0.5">
                            {t.rowCount}
                          </span>
                        )}
                        <Database className="h-3.5 w-3.5 text-muted-foreground" />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* File Drop Zone - IDLE */}
          {(stage === "idle" || stage === "selected") && (
            <div
              ref={dropZoneRef}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`relative group cursor-pointer rounded-2xl border-2 border-dashed transition-all duration-300 ${
                isDragging
                  ? "border-primary bg-primary/5 scale-[1.02]"
                  : selectedFile
                  ? "border-primary/50 bg-primary/5"
                  : "border-border hover:border-primary/40 hover:bg-muted/50"
              } p-8`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED_EXTENSIONS}
                onChange={handleFileSelect}
                className="hidden"
              />

              {selectedFile ? (
                <div className="flex items-center gap-4">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <FileSpreadsheet className="h-7 w-7" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-foreground truncate">{selectedFile.name}</p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <span>{formatFileSize(selectedFile.size)}</span>
                      <span>·</span>
                      <span className="font-mono">{selectedFile.name.split(".").pop()?.toUpperCase()}</span>
                      <span>·</span>
                      <span className="text-primary font-medium">→ {selectedTable.label}</span>
                    </div>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); reset(); }}
                    className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-destructive/10 hover:text-destructive transition-all text-muted-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <div className="text-center">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-muted group-hover:bg-primary/10 transition-colors">
                    <FileUp className="h-8 w-8 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                  <p className="mt-4 text-sm font-semibold text-foreground">
                    Datei hierher ziehen
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    oder <span className="text-primary font-medium">durchsuchen</span> · JSON, CSV, TSV, JSONL
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Progress / Processing State */}
          {(stage === "uploading" || stage === "processing") && (
            <div className="rounded-2xl border border-border bg-background p-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="relative">
                  <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Loader2 className="h-6 w-6 text-primary animate-spin" />
                  </div>
                  <div className="absolute -top-1 -right-1 h-4 w-4 bg-primary rounded-full flex items-center justify-center">
                    <Sparkles className="h-2.5 w-2.5 text-white" />
                  </div>
                </div>
                <div>
                  <p className="font-semibold text-foreground">
                    {stage === "uploading" ? "Upload läuft" : "Embedding & Indexierung"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">{progressText}</p>
                </div>
              </div>

              {/* Animated Pipeline Steps */}
              <div className="flex items-center justify-between gap-1 mt-4">
                {["Parsen", "Erkennung", "Embedding", "Indexierung"].map((step, i) => (
                  <div key={step} className="flex items-center gap-1 flex-1">
                    <div className={`h-1.5 rounded-full flex-1 transition-all duration-700 ${
                      (stage === "uploading" && i === 0) || (stage === "processing" && i <= 2)
                        ? "bg-primary animate-pulse"
                        : stage === "processing" && i === 3
                        ? "bg-primary/30"
                        : "bg-border"
                    }`} />
                    {i < 3 && <ArrowRight className="h-3 w-3 text-muted-foreground/40 shrink-0" />}
                  </div>
                ))}
              </div>
              <div className="flex justify-between text-[10px] text-muted-foreground mt-1 px-1">
                {["Parsen", "Erkennung", "Embedding", "Indexierung"].map((s) => (
                  <span key={s}>{s}</span>
                ))}
              </div>
            </div>
          )}

          {/* Success State */}
          {stage === "complete" && stats && (
            <div className="rounded-2xl border border-primary/20 bg-primary/5 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-12 w-12 rounded-xl bg-primary/20 flex items-center justify-center">
                  <CheckCircle2 className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="font-bold text-foreground">Import erfolgreich!</p>
                  <p className="text-xs text-muted-foreground">
                    {stats.indexed} Records in <code className="bg-muted px-1 rounded font-mono text-[10px]">{selectedTable.tableName}</code>
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 mt-4">
                {[
                  { label: "Verarbeitet", value: stats.parsedRecords, icon: Zap },
                  { label: "Indexiert", value: stats.indexed, icon: Database },
                  { label: "Übersprungen", value: stats.skipped, icon: BarChart3 },
                ].map((s) => (
                  <div key={s.label} className="bg-card border border-border rounded-xl p-3 text-center">
                    <s.icon className="h-4 w-4 text-primary mx-auto mb-1" />
                    <p className="text-lg font-bold text-foreground">{s.value}</p>
                    <p className="text-[10px] text-muted-foreground">{s.label}</p>
                  </div>
                ))}
              </div>

              {stats.errors > 0 && (
                <p className="text-xs text-muted-foreground mt-3">
                  ⚠️ {stats.errors} Fehler beim Import
                </p>
              )}
            </div>
          )}

          {/* Error State */}
          {stage === "error" && (
            <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-xl bg-destructive/10 flex items-center justify-center">
                  <AlertCircle className="h-6 w-6 text-destructive" />
                </div>
                <div>
                  <p className="font-semibold text-foreground">Import fehlgeschlagen</p>
                  <p className="text-xs text-destructive mt-0.5">{errorMsg}</p>
                </div>
              </div>
            </div>
          )}

          {/* Action Button */}
          <div className="flex items-center gap-3">
            {stage === "selected" && (
              <button
                onClick={handleUpload}
                className={`flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r ${selectedTable.color} px-6 py-3 text-sm font-bold text-white shadow-lg transition-all hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]`}
              >
                <Upload className="h-4 w-4" />
                Importieren & Einbetten
              </button>
            )}

            {(stage === "complete" || stage === "error") && (
              <>
                <button
                  onClick={reset}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-background px-6 py-3 text-sm font-semibold text-foreground hover:bg-muted transition-all"
                >
                  Weiteren Import
                </button>
                <button
                  onClick={handleClose}
                  className={`flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r ${selectedTable.color} px-6 py-3 text-sm font-bold text-white shadow-lg hover:shadow-xl transition-all`}
                >
                  Fertig
                </button>
              </>
            )}
          </div>

          {/* Collapsible Logs View */}
          {(stage === "uploading" || stage === "processing" || stage === "error" || stage === "complete" || logs.length > 0) && (
             <div className="mt-4 border border-border rounded-xl overflow-hidden bg-[#0d1117]">
               <button 
                 onClick={() => setLogsOpen(!logsOpen)}
                 className="w-full flex items-center justify-between px-4 py-2 bg-muted/20 hover:bg-muted/40 transition-colors border-b border-border/50"
               >
                 <div className="flex items-center gap-2">
                   <Terminal className="h-4 w-4 text-primary" />
                   <span className="text-xs font-mono font-medium text-muted-foreground uppercase tracking-widest">Live Logs</span>
                 </div>
                 <ChevronUp className={`h-4 w-4 text-muted-foreground transition-transform ${logsOpen ? "rotate-180" : ""}`} />
               </button>
               
               {logsOpen && (
                 <div className="p-3 max-h-[250px] overflow-y-auto font-mono text-[10px] leading-relaxed w-full">
                   {logs.length === 0 ? (
                     <div className="text-muted-foreground/50 text-center italic py-4">Warte auf Logs...</div>
                   ) : (
                     <div className="flex flex-col gap-1 w-full flex-1">
                       {logs.map((log, i) => (
                         <div key={i} className={`whitespace-pre-wrap break-all ${log.includes("FEHLER") || log.includes("Error") ? "text-destructive" : log.includes("WARN") ? "text-orange-400" : "text-muted-foreground/80"} ${log.includes("START") || log.includes("erfolgreich") ? "font-bold text-primary" : ""}`}>
                           {log}
                         </div>
                       ))}
                       <div ref={logsEndRef} />
                     </div>
                   )}
                 </div>
               )}
             </div>
          )}
        </div>
      </div>
    </div>
  );
}
