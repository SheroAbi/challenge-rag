import {
  Code2,
} from "lucide-react";
import AnimatedAIChat from "@/components/animated-ai-chat";
import { ErrorBoundary } from "@/components/error-boundary";
import { WarmupTrigger } from "@/components/warmup-trigger";

export default function LandingPage() {
  return (
    <div className="absolute inset-0 flex flex-col overflow-hidden bg-background text-foreground selection:bg-primary/20">

      {/* Silent warmup on landing */}
      <WarmupTrigger />

      {/* Background glow effects */}
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/10 via-background to-background pointer-events-none">
        <div className="absolute left-1/2 top-0 h-[800px] w-[1000px] -translate-x-1/2 rounded-full bg-primary/20 blur-[130px] opacity-60 mix-blend-screen" />
        <div className="absolute right-10 top-40 h-[600px] w-[600px] rounded-full bg-secondary/15 blur-[120px] opacity-50 mix-blend-screen" />
        <div className="absolute left-10 bottom-0 h-[600px] w-[500px] rounded-full bg-primary/10 blur-[120px] opacity-40 mix-blend-screen" />
      </div>

      <ErrorBoundary fallbackTitle="Chat-Fehler">
        <AnimatedAIChat
          hero={
            <div className="flex flex-col items-center justify-center w-full min-h-[50vh]">
              <div className="mx-auto w-full max-w-5xl text-center px-6 pt-8 md:pt-16 pb-8 flex-1 flex flex-col justify-center items-center">
                <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-5 py-2 text-sm font-medium text-primary shadow-sm backdrop-blur-md transition-transform hover:scale-105">
                  <Code2 className="h-4 w-4" />
                  Recruiting-Challenge – RAG-System
                </div>

                <h1 className="text-4xl font-extrabold leading-[1.1] tracking-tight text-foreground sm:text-5xl md:text-7xl lg:text-[6rem]">
                  RAG Challenge <br className="hidden sm:block" />für <span className="bg-gradient-to-br from-primary via-primary/80 to-primary/40 bg-clip-text text-transparent filter drop-shadow-sm border-b-[4px] sm:border-b-[6px] border-primary/20">Everlast</span>
                </h1>

                <p className="mx-auto mt-8 max-w-2xl text-lg sm:text-lg leading-relaxed text-muted-foreground font-medium">
                  Ein fokussiertes RAG-System. Probieren Sie die intelligente Suche im Chat aus.
                </p>
              </div>

              <footer className="w-full text-center py-6 mt-8 flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6 text-sm font-medium text-muted-foreground shrink-0">
                <p>Recruiting Challenge v1.0</p>
                <div className="hidden sm:block h-1.5 w-1.5 rounded-full bg-border" />
                <div className="flex items-center gap-3">
                  <span className="hover:text-foreground transition-colors cursor-pointer">Next.js 16</span>
                  <span className="h-1.5 w-1.5 rounded-full bg-border" />
                  <span className="hover:text-foreground transition-colors cursor-pointer">TypeScript</span>
                </div>
              </footer>
            </div>
          }
        />
      </ErrorBoundary>
    </div>
  );
}
