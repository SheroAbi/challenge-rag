import { Zap, Shield, CheckCircle2, MessageSquare, Database, Layers, GitBranch } from "lucide-react";

const TECH_STACK = [
  { name: "Next.js 16", detail: "App Router, RSC, Route Handlers" },
  { name: "TypeScript", detail: "Strict Mode, Zod Validation" },
  { name: "Tailwind CSS 4", detail: "Design Tokens, @theme" },
  { name: "Supabase", detail: "Postgres + pgvector" },
  { name: "Clean Architecture", detail: "Ports & Adapters Pattern" },
  { name: "Provider-agnostisch", detail: "Austauschbare AI-Adapter" },
];

const STATUS_ITEMS = [
  { label: "API-Routen verdrahtet", done: true },
  { label: "Zod-Contracts definiert", done: true },
  { label: "Supabase-Schema bereit", done: true },
  { label: "UI-Shell aufgebaut", done: true },
  { label: "Provider-Interfaces angelegt", done: true },
  { label: "RAG-Kernlogik implementiert", done: true },
  { label: "Embeddings aktiviert (lokal)", done: true },
  { label: "LLM-Generierung aktiv (Gemini)", done: true },
];

const ARCHITECTURE_LAYERS = [
  {
    icon: MessageSquare,
    title: "Chat-Orchestrierung",
    description: "Frage → RAG-Pipeline → KI-Antwort mit Quellenangabe",
    status: "active",
    route: "/api/chat/query",
  },
  {
    icon: Database,
    title: "Vektor-Retrieval",
    description: "Lokales Embedding → pgvector Similarity Search → Top-K relevante Chunks",
    status: "active",
    route: "/api/rag/retrieve",
  },
  {
    icon: Layers,
    title: "Knowledge Management",
    description: "Datei-Upload → Universal-Parsing → Embedding → Indexierung via SSE",
    status: "active",
    route: "/api/knowledge/upload",
  },
  {
    icon: GitBranch,
    title: "Provider-Integration",
    description: "Lokale Xenova-Embeddings + Gemini für LLM-Generierung",
    status: "active",
    route: "/api/health",
  },
];

export default function AboutPage() {
  return (
    <div className="min-h-dvh flex flex-col bg-background text-foreground">
      {/* ========== Main Content ========== */}
      <div className="flex-1 px-6 pt-16 md:pt-24 pb-16 md:pb-24 relative overflow-hidden">
        {/* Background blobs */}
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/5 via-background to-background pointer-events-none">
          <div className="absolute top-0 right-0 h-[600px] w-[600px] rounded-full bg-primary/10 blur-[130px] opacity-60 mix-blend-screen" />
          <div className="absolute top-40 left-0 h-[500px] w-[500px] rounded-full bg-secondary/10 blur-[120px] opacity-50 mix-blend-screen" />
        </div>

        <div className="mx-auto max-w-4xl text-center mb-20">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary shadow-sm">
            <Shield className="h-4 w-4" />
            Architektur & Tech Stack
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight text-foreground sm:text-6xl lg:text-7xl mb-6">
            Über das <span className="bg-gradient-to-br from-primary via-primary/80 to-primary/40 bg-clip-text text-transparent filter drop-shadow-sm">Projekt</span>
          </h1>
          <p className="text-lg sm:text-xl text-muted-foreground leading-relaxed max-w-2xl mx-auto">
            Hier findest du alle Details zur technischen Umsetzung und dem verwendeten Technologie-Stack des RAG-basierten Help Centers.
          </p>
        </div>

        <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-2 mb-20">
          {/* Tech Stack */}
          <div className="group relative bg-card/40 backdrop-blur-2xl border border-border/50 rounded-[2rem] p-10 shadow-2xl transition-all duration-500 hover:border-primary/40 hover:shadow-[0_20px_40px_-15px_rgba(0,0,0,0.1)] hover:-translate-y-2">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100 rounded-[2rem]" />
            <div className="relative z-10">
              <div className="mb-10 flex items-center gap-5">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 text-primary ring-1 ring-primary/20 shadow-inner group-hover:scale-110 group-hover:from-primary group-hover:text-primary-foreground transition-all duration-500">
                  <Zap className="h-8 w-8" />
                </div>
                <h3 className="text-3xl font-bold text-foreground tracking-tight">
                  Technologie-Stack
                </h3>
              </div>
              <div className="space-y-4">
                {TECH_STACK.map((tech) => (
                  <div
                    key={tech.name}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-border/40 bg-background/60 px-6 py-5 shadow-sm transition-all duration-300 hover:bg-muted hover:scale-[1.02] hover:shadow-md"
                  >
                    <span className="text-lg font-bold text-foreground">
                      {tech.name}
                    </span>
                    <span className="text-sm font-medium text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-lg border border-border/50">{tech.detail}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Project Status */}
          <div className="group relative bg-card/40 backdrop-blur-2xl border border-border/50 rounded-[2rem] p-10 shadow-2xl transition-all duration-500 hover:border-primary/40 hover:shadow-[0_20px_40px_-15px_rgba(0,0,0,0.1)] hover:-translate-y-2">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100 rounded-[2rem]" />
            <div className="relative z-10">
              <div className="mb-10 flex items-center gap-5">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 text-primary ring-1 ring-primary/20 shadow-inner group-hover:scale-110 group-hover:from-primary group-hover:text-primary-foreground transition-all duration-500">
                  <CheckCircle2 className="h-8 w-8" />
                </div>
                <h3 className="text-3xl font-bold text-foreground tracking-tight">
                  Umsetzungsstatus
                </h3>
              </div>
              <div className="space-y-4">
                {STATUS_ITEMS.map((item) => (
                  <div
                    key={item.label}
                    className="flex items-center gap-4 rounded-2xl border border-border/40 bg-background/60 px-6 py-5 shadow-sm transition-all duration-300 hover:bg-muted hover:scale-[1.02] hover:shadow-md"
                  >
                    <CheckCircle2
                      className={`h-6 w-6 shrink-0 transition-all duration-300 ${
                        item.done
                          ? "text-primary scale-110 drop-shadow-[0_0_8px_rgba(var(--color-primary),0.4)]"
                          : "text-muted-foreground/30"
                      }`}
                    />
                    <span
                      className={`text-base font-semibold ${
                        item.done ? "text-foreground" : "text-muted-foreground"
                      }`}
                    >
                      {item.label}
                    </span>
                    {!item.done && (
                      <span className="ml-auto text-[11px] font-bold uppercase tracking-wider text-destructive bg-destructive/10 px-3 py-1.5 rounded-xl ring-1 ring-destructive/20 shadow-sm">
                        TODO
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ========== Architecture Overview ========== */}
        <div className="mx-auto max-w-7xl relative z-10 mt-32">
          <div className="mb-16 sm:mb-20 text-center">
            <h2 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-5xl md:text-6xl">
              Architektur-Transparenz
            </h2>
            <p className="mt-6 text-lg text-muted-foreground max-w-3xl mx-auto leading-relaxed font-medium">
              Jede Schicht ist fertig implementiert. Lokale Embeddings, Gemini-Generierung, Multi-Theme-Retrieval und eine SSE-Import-Pipeline bilden das Fundament dieses produktionsreifen RAG-Systems.
            </p>
          </div>

          <div className="grid gap-6 sm:gap-8 md:grid-cols-2 lg:gap-10">
            {ARCHITECTURE_LAYERS.map((layer) => (
              <div
                key={layer.title}
                className="group relative overflow-hidden rounded-[2.5rem] border border-border/50 bg-card/40 backdrop-blur-2xl p-10 transition-all duration-500 hover:-translate-y-2 hover:shadow-[0_30px_60px_-15px_rgba(0,0,0,0.1)] hover:border-primary/40"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100 rounded-[2.5rem]" />
                
                <div className="relative z-10 flex flex-col items-start gap-6 sm:flex-row">
                  <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-[1.5rem] bg-gradient-to-br from-primary/10 to-primary/5 text-primary ring-1 ring-primary/20 transition-all duration-500 group-hover:scale-110 group-hover:from-primary group-hover:text-primary-foreground group-hover:ring-primary/50 group-hover:shadow-[0_10px_30px_-10px_rgba(var(--color-primary),0.5)] shadow-inner">
                    <layer.icon className="h-10 w-10" />
                  </div>
                  <div className="flex-1 min-w-0 pt-1">
                    <div className="flex items-center gap-3 mb-3">
                      <h3 className="text-2xl font-bold text-foreground tracking-tight">
                        {layer.title}
                      </h3>
                      <span className="inline-flex items-center rounded-xl bg-primary/10 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-primary ring-1 ring-primary/20 shadow-sm">
                        Aktiv
                      </span>
                    </div>
                    <p className="mt-1 text-base leading-relaxed text-muted-foreground">
                      {layer.description}
                    </p>
                    <div className="mt-6 inline-block rounded-xl bg-background/60 px-4 py-2.5 backdrop-blur-md border border-border/60 shadow-sm transition-colors group-hover:bg-background/80 group-hover:border-primary/20">
                      <code className="text-sm font-semibold text-muted-foreground font-mono">
                        {layer.route}
                      </code>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* ========== Footer ========== */}
      <footer className="border-t border-border/40 bg-background px-6 py-10 mt-auto relative z-10">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 sm:flex-row">
          <p className="text-sm font-medium text-muted-foreground">
            Recruiting Challenge – RAG Help Center v1.0.0
          </p>
          <div className="flex items-center gap-4 text-sm font-medium text-muted-foreground">
            <span className="hover:text-foreground transition-colors cursor-pointer">Next.js 16</span>
            <span className="h-1 w-1 rounded-full bg-border" />
            <span className="hover:text-foreground transition-colors cursor-pointer">TypeScript</span>
            <span className="h-1 w-1 rounded-full bg-border" />
            <span className="hover:text-foreground transition-colors cursor-pointer">Supabase</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
