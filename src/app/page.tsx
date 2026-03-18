import {
  Code2,
} from "lucide-react";
import AnimatedAIChat from "@/components/animated-ai-chat";

export default function LandingPage() {
  return (
    <div className="min-h-dvh flex flex-col bg-background text-foreground selection:bg-primary/20">

      {/* ========== Hero ========== */}
      <section className="relative flex-1 flex flex-col items-center justify-start overflow-hidden px-6 pt-16 md:pt-24 pb-16 md:pb-24">
        {/* Background glow effects */}
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/10 via-background to-background">
          <div className="absolute left-1/2 top-0 h-[800px] w-[1000px] -translate-x-1/2 rounded-full bg-primary/20 blur-[130px] opacity-60 mix-blend-screen" />
          <div className="absolute right-10 top-40 h-[600px] w-[600px] rounded-full bg-secondary/15 blur-[120px] opacity-50 mix-blend-screen" />
          <div className="absolute left-10 bottom-0 h-[600px] w-[500px] rounded-full bg-primary/10 blur-[120px] opacity-40 mix-blend-screen" />
        </div>

        <div className="mx-auto w-full max-w-5xl text-center z-10 animate-fade-in slide-in-from-bottom-8 duration-1000 relative">
          <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-5 py-2 text-sm font-medium text-primary shadow-sm backdrop-blur-md transition-transform hover:scale-105">
            <Code2 className="h-4 w-4" />
            Recruiting-Challenge – RAG-System
          </div>

          <h1 className="text-5xl font-extrabold leading-[1.1] tracking-tight text-foreground sm:text-7xl md:text-[5.5rem] lg:text-[6rem]">
            RAG Challenge <br /> für <span className="bg-gradient-to-br from-primary via-primary/80 to-primary/40 bg-clip-text text-transparent filter drop-shadow-sm border-b-[6px] border-primary/20">Everlast</span>
          </h1>

          <p className="mx-auto mt-8 max-w-2xl text-lg sm:text-lg leading-relaxed text-muted-foreground font-medium">
            Ein fokussiertes RAG-System. Probieren Sie die intelligente Suche im Chat unten aus.
          </p>
        </div>

        {/* AI Chat Box Integration */}
        <div id="chat" className="w-full mt-10 max-w-4xl z-20 animate-fade-in slide-in-from-bottom-12 duration-1000 delay-200 scroll-mt-32">
          <AnimatedAIChat />
        </div>
      </section>

      {/* ========== Footer ========== */}
      <footer className="border-t border-border/40 bg-background px-6 py-6 relative z-10">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 sm:flex-row">
          <p className="text-sm font-medium text-muted-foreground">
            Recruiting Challenge – RAG Help Center v1.0.0
          </p>
          <div className="flex items-center gap-4 text-sm font-semibold text-muted-foreground">
            <span className="hover:text-foreground transition-colors cursor-pointer">Next.js 16</span>
            <span className="h-1.5 w-1.5 rounded-full bg-border" />
            <span className="hover:text-foreground transition-colors cursor-pointer">TypeScript</span>
            <span className="h-1.5 w-1.5 rounded-full bg-border" />
            <span className="hover:text-foreground transition-colors cursor-pointer">Supabase</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
