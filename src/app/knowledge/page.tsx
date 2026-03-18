"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Upload,
  Clock,
  Layers,
  Plus,
  Search,
  ArrowRight,
  Database,
  RefreshCw,
  Sparkles,
  TrendingUp,
  ChevronRight,
} from "lucide-react";
import RagUploadModal from "@/components/rag-upload-modal";

/**
 * Knowledge Page – Wissensbasis verwalten.
 * Zeigt live-Stats aus Supabase, dynamische RAG-Tabellen, und den Upload-Modal-Trigger.
 */

interface LiveStats {
  foodItems: number;
  foodChunks: number;
  saasChunks: number;
  exerciseChunks: number;
  importRuns: number;
  lastImport: string | null;
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

export default function KnowledgePage() {
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [stats, setStats] = useState<LiveStats | null>(null);
  const [ragTables, setRagTables] = useState<RagTableInfo[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Paralleles Laden von Stats und Tabellen
      const [statsRes, tablesRes] = await Promise.all([
        fetch("/api/knowledge/stats"),
        fetch("/api/knowledge/tables"),
      ]);

      if (statsRes.ok) setStats(await statsRes.json());
      if (tablesRes.ok) {
        const data = await tablesRes.json();
        if (data.tables) setRagTables(data.tables);
      }
    } catch {
      // Stats optional – Seite funktioniert ohne
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Refresh bei Modal-Close (neue imports könnten dazugekommen sein)
  const handleModalClose = () => {
    setIsUploadOpen(false);
    fetchData();
  };

  const totalChunks = ragTables.reduce((sum, t) => sum + t.rowCount, 0);

  const statCards = [
    {
      label: "Food Items",
      value: stats?.foodItems ?? "—",
      icon: Database,
      gradient: "from-emerald-500/20 to-teal-500/20",
      iconColor: "text-emerald-500",
    },
    {
      label: "RAG Chunks",
      value: loading ? "—" : totalChunks,
      icon: Layers,
      gradient: "from-blue-500/20 to-indigo-500/20",
      iconColor: "text-blue-500",
    },
    {
      label: "Imports",
      value: stats?.importRuns ?? "—",
      icon: TrendingUp,
      gradient: "from-purple-500/20 to-pink-500/20",
      iconColor: "text-purple-500",
    },
    {
      label: "Letzter Import",
      value: stats?.lastImport
        ? new Date(stats.lastImport).toLocaleDateString("de-DE", {
            month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
          })
        : "—",
      icon: Clock,
      gradient: "from-orange-500/20 to-red-500/20",
      iconColor: "text-orange-500",
    },
  ];

  return (
    <>
      <div className="mx-auto max-w-5xl w-full px-4 sm:px-6 pt-16 md:pt-24 pb-16 md:pb-24 animate-fade-in">
        {/* Header */}
        <div className="mb-8 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <Sparkles className="h-6 w-6 text-primary" />
              Wissensbasis
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Verwalte RAG-Datenquellen – Dateien hochladen, parsen, embedden, indexieren.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchData}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-background px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:border-primary/50 transition-all"
              title="Live-Stats aktualisieren"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            </button>
            <button
              onClick={() => setIsUploadOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-primary to-primary/80 px-5 py-2.5 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/25 transition-all hover:shadow-xl hover:shadow-primary/30 hover:scale-[1.02] active:scale-[0.98]"
            >
              <Upload className="h-4 w-4" />
              Importieren
            </button>
          </div>
        </div>

        {/* Live Stats */}
        <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {statCards.map((stat) => (
            <div
              key={stat.label}
              className={`bg-gradient-to-br ${stat.gradient} border border-border/50 rounded-2xl p-4 shadow-sm backdrop-blur transition-all hover:shadow-md hover:scale-[1.02]`}
            >
              <div className="flex items-center gap-2 mb-2">
                <stat.icon className={`h-4 w-4 ${stat.iconColor}`} />
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  {stat.label}
                </span>
              </div>
              <p className="text-2xl font-bold text-foreground">
                {loading ? (
                  <span className="inline-block w-12 h-6 bg-muted rounded animate-pulse" />
                ) : (
                  stat.value
                )}
              </p>
            </div>
          ))}
        </div>

        {/* RAG Tables Overview – Dynamic from Supabase */}
        <div className="mb-6">
          <h2 className="text-sm font-bold text-foreground mb-3 uppercase tracking-wider flex items-center gap-2">
            <Database className="h-4 w-4 text-primary" />
            RAG-Datenbanken
            <span className="text-[10px] font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded-full ml-1">
              Live aus Supabase
            </span>
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {(ragTables.length > 0 ? ragTables : [
              { tableName: "rag_food_chunks", themeKey: "food", label: "Nutrition & Food", icon: "🥗", color: "from-emerald-500 to-teal-600", rowCount: 0, description: "", hasMatchRpc: true },
              { tableName: "rag_saas_chunks", themeKey: "saas_docs", label: "SaaS Help Center", icon: "📘", color: "from-blue-500 to-indigo-600", rowCount: 0, description: "", hasMatchRpc: true },
              { tableName: "rag_exercise_chunks", themeKey: "exercises", label: "Exercises", icon: "💪", color: "from-orange-500 to-red-600", rowCount: 0, description: "", hasMatchRpc: true },
            ]).map((db) => (
              <div
                key={db.tableName}
                className="bg-card border border-border rounded-2xl p-4 shadow-sm hover:shadow-md transition-all group cursor-pointer"
                onClick={() => setIsUploadOpen(true)}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{db.icon}</span>
                    <span className="text-sm font-bold text-foreground">{db.label}</span>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
                <div className="flex items-center gap-4">
                  <div>
                    <p className="text-2xl font-bold text-foreground">
                      {loading ? (
                        <span className="inline-block w-10 h-6 bg-muted rounded animate-pulse" />
                      ) : (
                        db.rowCount
                      )}
                    </p>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">Chunks</p>
                  </div>
                  {db.themeKey === "food" && stats?.foodItems != null && stats.foodItems > 0 && (
                    <div className="border-l border-border pl-4">
                      <p className="text-2xl font-bold text-foreground">{stats.foodItems}</p>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">Items</p>
                    </div>
                  )}
                </div>
                <div className={`mt-3 h-1 w-full rounded-full bg-${db.themeKey === "food" ? "emerald" : db.themeKey === "saas_docs" ? "blue" : "orange"}-500/10`}>
                  <div
                    className={`h-full rounded-full bg-gradient-to-r ${db.color} transition-all duration-1000`}
                    style={{ width: db.rowCount > 0 ? "100%" : "0%" }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Search Bar */}
        <div className="mb-4">
          <div className="bg-card border border-border flex items-center gap-3 rounded-xl px-4 py-2.5 shadow-sm">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Datensätze durchsuchen..."
              className="flex-1 bg-transparent text-sm text-foreground placeholder-muted-foreground outline-none"
              disabled
            />
          </div>
        </div>

        {/* Pipeline Info */}
        <div className="mt-6 bg-card border border-border rounded-2xl p-6 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">
                Universal Import-Pipeline (Aktiv)
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Die Pipeline ist für alle Themes aktiv – lade JSON, CSV, TSV oder JSONL in jede RAG-Tabelle.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {[
                  "Datei-Upload",
                  "Auto-Format-Erkennung",
                  "Universal-Parsing",
                  "Lokales Embedding",
                  "pgvector-Indexierung",
                ].map((step, i) => (
                  <div key={step} className="flex items-center gap-1">
                    <span className="inline-flex items-center rounded-lg bg-primary/10 border border-primary/20 px-2.5 py-1 text-xs font-medium text-primary">
                      {step}
                    </span>
                    {i < 4 && (
                      <ArrowRight className="h-3 w-3 text-primary/40" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Add Document CTA */}
        <div
          className="mt-4 rounded-2xl border-2 border-dashed border-primary/30 bg-primary/5 p-8 text-center cursor-pointer hover:border-primary/50 hover:bg-primary/10 transition-all group"
          onClick={() => setIsUploadOpen(true)}
        >
          <Plus className="mx-auto h-8 w-8 text-primary/60 group-hover:text-primary transition-colors" />
          <p className="mt-3 text-sm font-semibold text-foreground">
            Dataset hinzufügen
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            JSON, CSV, TSV oder JSONL direkt hochladen und in jede RAG-Datenbank einbetten
          </p>
        </div>
      </div>

      <RagUploadModal isOpen={isUploadOpen} onClose={handleModalClose} />
    </>
  );
}
