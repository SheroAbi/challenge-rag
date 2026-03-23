'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  Paperclip,
  SendIcon,
  XIcon,
  ArrowUp,
  Loader2,
  Sparkles,
  Database,
  Layers,
  ChevronDown,
  BookOpen,
  AlertTriangle,
  Lightbulb,
  ChevronDownIcon,
  Dumbbell,
  Target,
  RefreshCw,
  X,
  ChevronRight,
  Trash2,
  User,
  Bot,
  Plus,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import * as React from 'react';
import { themeRegistry } from '@/server/rag/theme-router';
import type { ThemeKey } from '@/server/contracts/schemas';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useChatStore } from '@/lib/hooks/use-chat-store';
import { useStreamChat, type StreamPhase } from '@/lib/hooks/use-stream-chat';
import type { AssistantMessage } from '@/lib/types/chat';

/* ------------------------------------------------------------------ */
/*  Textarea Helpers                                                    */
/* ------------------------------------------------------------------ */

interface UseAutoResizeTextareaProps {
  minHeight: number;
  maxHeight?: number;
}

function useAutoResizeTextarea({
  minHeight,
  maxHeight,
}: UseAutoResizeTextareaProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const adjustHeight = useCallback(
    (reset?: boolean) => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      if (reset) {
        textarea.style.height = `${minHeight}px`;
        return;
      }

      textarea.style.height = `${minHeight}px`;
      const newHeight = Math.max(
        minHeight,
        Math.min(textarea.scrollHeight, maxHeight ?? Number.POSITIVE_INFINITY),
      );

      textarea.style.height = `${newHeight}px`;
    },
    [minHeight, maxHeight],
  );

  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = `${minHeight}px`;
    }
  }, [minHeight]);

  useEffect(() => {
    const handleResize = () => adjustHeight();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [adjustHeight]);

  return { textareaRef, adjustHeight };
}

interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  containerClassName?: string;
  showRing?: boolean;
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, containerClassName, showRing = true, ...props }, ref) => {
    return (
      <div className={cn('relative', containerClassName)}>
        <textarea
          className={cn(
            'flex min-h-[80px] w-full rounded-md px-3 py-2 text-sm bg-transparent',
            'transition-all duration-200 ease-in-out',
            'placeholder:text-muted-foreground',
            'disabled:cursor-not-allowed disabled:opacity-50',
            'border-none shadow-none ring-0 outline-none',
            'focus:border-transparent focus:ring-0 focus:outline-none focus:shadow-none',
            'focus-visible:border-transparent focus-visible:ring-0 focus-visible:outline-none focus-visible:shadow-none',
            '!border-none !ring-0 !shadow-none !outline-none',
            className,
          )}
          ref={ref}
          {...props}
        />
      </div>
    );
  },
);
Textarea.displayName = 'Textarea';

/* ------------------------------------------------------------------ */
/*  Main Chat Component                                                 */
/* ------------------------------------------------------------------ */

export default function AnimatedAIChat({ hero }: { hero?: React.ReactNode }) {
  const [value, setValue] = useState('');
  const [theme, setTheme] = useState<ThemeKey>('saas_docs');
  const [topK, setTopK] = useState<number>(10);
  const [isThemeDropdownOpen, setIsThemeDropdownOpen] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [lightboxAlt, setLightboxAlt] = useState<string>('');
  const [expandedExercise, setExpandedExercise] = useState<number | null>(null);
  const [showErrorDetails, setShowErrorDetails] = useState<Record<string, boolean>>({});
  const [streamPhase, setStreamPhase] = useState<StreamPhase>('idle');

  const dropdownRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isNearBottomRef = useRef(true);

  const { textareaRef, adjustHeight } = useAutoResizeTextarea({
    minHeight: 60,
    maxHeight: 200,
  });

  const store = useChatStore(theme, topK);
  const { sendMessage, cancelStream } = useStreamChat({
    addMessage: store.addMessage,
    patchMessage: store.patchMessage,
    setSessionId: store.setSessionId,
    onPhaseChange: setStreamPhase,
  });

  const isStreaming = streamPhase !== 'idle' && streamPhase !== 'complete' && streamPhase !== 'error';
  const isChatActive = store.hydrated && store.messages.length > 0;

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsThemeDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Auto-scroll (only if near bottom)
  useEffect(() => {
    if (isNearBottomRef.current && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [store.messages]);

  const handleScroll = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const threshold = 150;
    isNearBottomRef.current =
      container.scrollHeight - container.scrollTop - container.clientHeight < threshold;
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (value.trim()) {
        handleSend();
      }
    }
  };

  const handleSend = (retrySnapshot?: { question: string; theme: ThemeKey; topK: number }) => {
    const question = retrySnapshot?.question || value.trim();
    const sendTheme = retrySnapshot?.theme || theme;
    const sendTopK = retrySnapshot?.topK || topK;
    if (!question || isStreaming) return;

    sendMessage(question, sendTheme, sendTopK, store.sessionId);

    if (!retrySnapshot) {
      setValue('');
      adjustHeight(true);
    }
  };

  const currentTheme = themeRegistry[theme];

  const phaseLabel: Record<StreamPhase, string> = {
    idle: '',
    connecting: 'Verbinde…',
    retrieving: 'KI durchsucht Wissen…',
    generating: 'Antwort wird erzeugt…',
    streaming: 'Antwort wird geschrieben…',
    complete: '',
    error: '',
  };

  return (
    <div className="flex w-full h-full flex-col min-h-0 bg-transparent relative">

      {/* ===== Top Header Zone ===== */}
      <AnimatePresence>
        {isChatActive && (
          <motion.div
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -20, opacity: 0 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="absolute top-0 inset-x-0 z-40 flex flex-col items-center pointer-events-none"
          >
            {/* The fade effect stretching full width but starting from top */}
            <div className="absolute top-0 inset-x-0 h-32 bg-gradient-to-b from-background/95 via-background/60 to-transparent pointer-events-none -z-10" />

            {/* Floating Header Pill */}
            <div className="mt-5 flex items-center gap-3 bg-card/80 backdrop-blur-xl border border-border/60 shadow-sm rounded-full pl-4 pr-1.5 py-1.5 pointer-events-auto transition-all hover:shadow-md">
              <div className="flex items-center gap-2 mr-2">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary ring-1 ring-primary/20">
                  <Bot className="h-3.5 w-3.5" />
                </div>
                <span className="text-sm font-semibold text-foreground tracking-tight ml-0.5">
                  Everlast Chat
                </span>
              </div>

              <div className="h-4 w-px bg-border/60" />

              <button
                type="button"
                onClick={store.clearHistory}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-muted/40 hover:bg-primary hover:text-primary-foreground text-muted-foreground hover:shadow-primary/30 hover:shadow-md transition-all group"
                title="Neuer Chat"
              >
                <Plus className="h-4 w-4 transition-transform group-hover:rotate-90 duration-300" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ===== Scrollable Area (Hero + Messages) ===== */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className={cn(
          "flex-1 w-full overflow-x-hidden overflow-y-auto scroll-smooth",
          isChatActive ? "pt-20 lg:pt-24 pb-4" : "pt-4 lg:pt-8"
        )}
      >
        <AnimatePresence>
          {!isChatActive && hero && (
            <motion.div
              initial={{ opacity: 1, scale: 1, paddingBottom: "2rem", height: "auto" }}
              exit={{ opacity: 0, scale: 0.95, height: 0, overflow: "hidden", paddingBottom: 0, marginTop: 0 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className="w-full flex flex-col items-center justify-center min-h-[40vh]"
            >
              {hero}
            </motion.div>
          )}
        </AnimatePresence>

        {isChatActive && (
          <div className="w-full max-w-4xl mx-auto px-4 pb-6 space-y-4">
            {store.messages.map((msg) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                {msg.role === 'user' ? (
                  /* ---- User Message ---- */
                  <div className="flex items-start gap-3 justify-end mt-6 first:mt-2">
                    <div className="max-w-[80%] rounded-2xl rounded-tr-md bg-primary/10 border border-primary/20 px-4 py-3">
                      <p className="text-sm text-foreground whitespace-pre-wrap">{msg.content}</p>
                      <div className="mt-1.5 flex items-center gap-2 text-[10px] text-muted-foreground">
                        <span>{themeRegistry[msg.theme]?.label}</span>
                        <span>·</span>
                        <span>Top {msg.topK}</span>
                      </div>
                    </div>
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <User className="h-4 w-4" />
                    </div>
                  </div>
                ) : (
                  /* ---- Assistant Message ---- */
                  <div className="flex items-start gap-3 w-full">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/20 text-primary ring-2 ring-primary/10">
                      <Bot className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0 max-w-[calc(100%-2.75rem)] w-full">
                      <AssistantCard
                        msg={msg}
                        showErrorDetails={showErrorDetails}
                        setShowErrorDetails={setShowErrorDetails}
                        expandedExercise={expandedExercise}
                        setExpandedExercise={setExpandedExercise}
                        setLightboxImage={setLightboxImage}
                        setLightboxAlt={setLightboxAlt}
                        onRetry={() => {
                          if (msg.requestSnapshot) {
                            handleSend(msg.requestSnapshot);
                          }
                        }}
                      />
                    </div>
                  </div>
                )}
              </motion.div>
            ))}
            <div ref={messagesEndRef} className="h-4" />
          </div>
        )}
      </div>

      {/* ===== Fixed Composer Zone ===== */}
      <div className="shrink-0 w-full relative z-30">
        {/* Transparent blur layer beneath composer */}
        <div className="absolute inset-x-0 bottom-full h-16 bg-gradient-to-t from-background to-transparent pointer-events-none -z-10" />

        <div className="mx-auto w-full max-w-4xl px-4 pb-4 md:pb-8 pt-2 relative">
          
          {/* Status Pill (during streaming) */}
          <AnimatePresence>
            {isStreaming && phaseLabel[streamPhase] && (
              <motion.div
                className="absolute -top-14 left-1/2 -translate-x-1/2 flex items-center gap-3 rounded-full border border-border/40 bg-background/90 px-5 py-2.5 shadow-2xl backdrop-blur-3xl z-40"
                initial={{ opacity: 0, y: 10, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.9 }}
                transition={{ type: 'spring', bounce: 0.4 }}
              >
                <div className="bg-primary/20 flex h-8 w-8 items-center justify-center rounded-full ring-2 ring-primary/20">
                  <Sparkles className="text-primary h-4 w-4 animate-pulse" />
                </div>
                <div className="text-foreground/80 flex items-center gap-2 text-sm font-medium">
                  <span>{phaseLabel[streamPhase]}</span>
                  <TypingDots />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Composer Background */}
          <motion.div
            className="border-border/60 bg-card/80 backdrop-blur-xl relative rounded-3xl border shadow-xl transition-all duration-300 hover:shadow-2xl"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <div className="p-4 md:p-5">
              <Textarea
                ref={textareaRef}
                value={value}
                onChange={(e) => {
                  setValue(e.target.value);
                  adjustHeight();
                }}
                onKeyDown={handleKeyDown}
                placeholder={`Frag mich etwas über ${currentTheme.label}...`}
                containerClassName="w-full"
                className={cn(
                  'w-full px-4 py-2 text-base',
                  'resize-none',
                  'bg-transparent',
                  'border-none',
                  'text-foreground',
                  'focus:outline-none focus:ring-0',
                  'placeholder:text-muted-foreground/60',
                  'min-h-[80px]',
                )}
                style={{
                  overflow: 'hidden',
                }}
                showRing={false}
              />
            </div>

            <div className="border-border/50 bg-muted/20 backdrop-blur-sm flex flex-row items-center justify-between gap-2 sm:gap-4 border-t px-4 sm:px-6 py-3 sm:py-4 rounded-b-3xl">
              <div className="flex flex-wrap items-center gap-2 sm:gap-4 flex-1">
                {/* Theme Selector Dropdown */}
                <div className="relative" ref={dropdownRef}>
                  <div className="flex items-center gap-2">
                    <Database className="h-4 w-4 text-muted-foreground hidden sm:block" />
                    <button
                      type="button"
                      onClick={() => setIsThemeDropdownOpen(!isThemeDropdownOpen)}
                      className={cn(
                        "flex items-center justify-between gap-2 sm:gap-3 bg-background border border-border/80 rounded-xl px-2.5 sm:px-3 py-1.5 text-xs font-semibold text-foreground outline-none hover:bg-muted/50 focus:ring-2 focus:ring-primary/30 shadow-sm cursor-pointer transition-all min-w-[120px] sm:min-w-[150px]",
                        isThemeDropdownOpen && "ring-2 ring-primary/30 border-primary/50 bg-muted/30"
                      )}
                    >
                      <span className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-primary" />
                        {currentTheme.label}
                      </span>
                      <ChevronDown className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform duration-300", isThemeDropdownOpen && "rotate-180")} />
                    </button>
                  </div>

                  <AnimatePresence>
                    {isThemeDropdownOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: 15, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 15, scale: 0.95 }}
                        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                        className="absolute bottom-full left-0 mb-3 w-[240px] max-w-[calc(100vw-3rem)] bg-background/95 backdrop-blur-xl border border-border/80 rounded-2xl shadow-2xl overflow-hidden z-50 origin-bottom-left"
                        style={{ boxShadow: '0 10px 40px -10px rgba(0,0,0,0.1), 0 0 20px rgba(0,0,0,0.05)' }}
                      >
                        <div className="flex flex-col p-2 space-y-1">
                          <div className="px-3 py-2 text-[10px] font-bold tracking-wider text-muted-foreground uppercase flex items-center gap-1.5 mb-1">
                            <Database className="h-3 w-3" /> Datenbereich wählen
                          </div>
                          {Object.values(themeRegistry).map((t) => (
                            <button
                              key={t.key}
                              type="button"
                              onClick={() => {
                                setTheme(t.key as ThemeKey);
                                setIsThemeDropdownOpen(false);
                              }}
                              className={cn(
                                "group flex items-center gap-3 w-full px-3 py-2.5 text-sm text-left rounded-xl transition-all duration-200",
                                theme === t.key
                                  ? "bg-primary/10 text-primary font-semibold shadow-inner"
                                  : "text-foreground hover:bg-muted/80"
                              )}
                            >
                              <div className={cn(
                                "flex h-8 w-8 items-center justify-center rounded-lg border shadow-sm transition-colors",
                                theme === t.key
                                  ? "bg-background border-primary/30 text-primary"
                                  : "bg-background border-border/50 text-muted-foreground group-hover:text-foreground group-hover:border-border"
                              )}>
                                {t.key === 'saas_docs' && <BookOpen className="h-4 w-4" />}
                                {t.key === 'food' && <Database className="h-4 w-4" />}
                                {t.key === 'exercises' && <Layers className="h-4 w-4" />}
                              </div>
                              <div className="flex flex-col">
                                <span className="leading-tight">{t.label}</span>
                                <span className={cn("text-[10px] mt-0.5", theme === t.key ? "text-primary/70" : "text-muted-foreground")}>
                                  {t.key === 'food' && 'Hybrid DB Query'}
                                  {t.key === 'saas_docs' && 'Semantic Search'}
                                  {t.key === 'exercises' && 'Vector Matching'}
                                </span>
                              </div>
                            </button>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Chunk Selector */}
                <div className="flex items-center gap-2 hidden min-[400px]:flex">
                  <Layers className="h-4 w-4 text-muted-foreground hidden sm:block" />
                  <div className="flex items-center bg-background border border-border/80 rounded-lg p-0.5 shadow-sm">
                    {[5, 10, 15, 20].map((num) => (
                      <button
                        key={num}
                        onClick={() => setTopK(num)}
                        className={cn(
                          "px-2 py-1 text-xs font-medium rounded-md transition-colors",
                          topK === num
                            ? "bg-primary text-primary-foreground shadow-sm"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground"
                        )}
                      >
                        {num}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <motion.button
                type="button"
                onClick={() => handleSend()}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.96 }}
                disabled={isStreaming || !value.trim()}
                className={cn(
                  'rounded-full sm:rounded-xl p-3 sm:px-6 sm:py-2.5 text-sm font-bold transition-all duration-300 shrink-0',
                  'flex items-center justify-center gap-2 shadow-sm',
                  (value.trim() && !isStreaming)
                    ? 'bg-primary text-primary-foreground shadow-primary/25 shadow-lg hover:shadow-primary/40 hover:-translate-y-0.5'
                    : isStreaming
                      ? 'bg-primary/80 text-primary-foreground/90 cursor-wait'
                      : 'bg-muted text-muted-foreground/50 opacity-70 cursor-not-allowed',
                )}
              >
                {isStreaming ? (
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                  >
                    <Loader2 className="h-5 w-5 sm:h-4 sm:w-4" />
                  </motion.div>
                ) : (
                  <>
                    <ArrowUp className="h-5 w-5 sm:hidden" />
                    <SendIcon className="hidden sm:block h-4 w-4" />
                  </>
                )}
                <span className="hidden sm:inline">{isStreaming ? 'Senden...' : 'Senden'}</span>
              </motion.button>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Lightbox Modal */}
      <AnimatePresence>
        {lightboxImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md cursor-zoom-out"
            onClick={() => setLightboxImage(null)}
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="relative max-w-[90vw] max-h-[90vh]"
              onClick={(e) => e.stopPropagation()}
            >
              <img
                src={lightboxImage}
                alt={lightboxAlt}
                className="max-w-full max-h-[85vh] rounded-2xl shadow-2xl object-contain"
              />
              <div className="absolute -bottom-12 left-1/2 -translate-x-1/2 text-white/80 text-sm font-medium text-center whitespace-nowrap">
                {lightboxAlt}
              </div>
              <button
                onClick={() => setLightboxImage(null)}
                className="absolute -top-3 -right-3 flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 backdrop-blur-md border border-white/10 shadow-lg transition-all hover:scale-110"
              >
                <X className="h-4 w-4" />
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Assistant Message Card                                              */
/* ------------------------------------------------------------------ */

function AssistantCard({
  msg,
  showErrorDetails,
  setShowErrorDetails,
  expandedExercise,
  setExpandedExercise,
  setLightboxImage,
  setLightboxAlt,
  onRetry,
}: {
  msg: AssistantMessage;
  showErrorDetails: Record<string, boolean>;
  setShowErrorDetails: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  expandedExercise: number | null;
  setExpandedExercise: (i: number | null) => void;
  setLightboxImage: (url: string | null) => void;
  setLightboxAlt: (alt: string) => void;
  onRetry: () => void;
}) {
  // Error state
  if (msg.status === 'error' && msg.errorInfo) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-card text-card-foreground border border-border/60 rounded-2xl p-5 shadow-sm overflow-hidden relative"
      >
        <div className="flex flex-col items-center text-center gap-3 relative z-10">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/15 ring-4 ring-amber-500/10">
            <AlertTriangle className="h-6 w-6 text-amber-500" />
          </div>
          <h3 className="text-base font-bold text-foreground">
            {msg.errorInfo.code === 'RATE_LIMIT' && 'Einen Moment bitte…'}
            {msg.errorInfo.code === 'NETWORK_ERROR' && 'Keine Verbindung'}
            {msg.errorInfo.code === 'SERVER_ERROR' && 'Server-Fehler'}
            {msg.errorInfo.code === 'MODEL_UNAVAILABLE' && 'KI nicht erreichbar'}
            {msg.errorInfo.code === 'CONFIG_ERROR' && 'Konfigurationsproblem'}
            {msg.errorInfo.code === 'DATABASE_ERROR' && 'Datenbankproblem'}
            {msg.errorInfo.code === 'VALIDATION_ERROR' && 'Ungültige Eingabe'}
            {(!msg.errorInfo.code || !['RATE_LIMIT','NETWORK_ERROR','SERVER_ERROR','MODEL_UNAVAILABLE','CONFIG_ERROR','DATABASE_ERROR','VALIDATION_ERROR'].includes(msg.errorInfo.code)) && 'Etwas ist schiefgelaufen'}
          </h3>
          <p className="text-sm text-muted-foreground max-w-md">{msg.errorInfo.message}</p>
          {msg.errorInfo.hint && (
            <div className="flex items-center gap-2 rounded-xl bg-primary/5 border border-primary/10 px-3 py-2 text-sm text-foreground/80 max-w-md">
              <Lightbulb className="h-4 w-4 shrink-0 text-primary" />
              <span>{msg.errorInfo.hint}</span>
            </div>
          )}
          <motion.button
            type="button"
            onClick={onRetry}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.96 }}
            className="mt-1 flex items-center gap-2 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary font-semibold px-4 py-2 text-sm transition-all border border-primary/20"
          >
            <RefreshCw className="h-4 w-4" />
            Erneut versuchen
          </motion.button>

          {msg.rawErrorDetails && (
            <div className="w-full max-w-lg mt-2">
              <button
                type="button"
                onClick={() => setShowErrorDetails((prev) => ({ ...prev, [msg.id]: !prev[msg.id] }))}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mx-auto"
              >
                <ChevronDownIcon className={cn("h-3.5 w-3.5 transition-transform duration-200", showErrorDetails[msg.id] && "rotate-180")} />
                Technische Details {showErrorDetails[msg.id] ? 'ausblenden' : 'anzeigen'}
              </button>
              <AnimatePresence>
                {showErrorDetails[msg.id] && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <pre className="mt-2 rounded-xl bg-muted/60 border border-border/50 p-3 text-xs text-muted-foreground font-mono overflow-x-auto max-h-48 overflow-y-auto whitespace-pre-wrap break-all">
                      {msg.rawErrorDetails}
                    </pre>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
      </motion.div>
    );
  }

  // Interrupted state
  if (msg.status === 'interrupted') {
    return (
      <div className="space-y-3">
        {msg.content && (
          <div className="bg-card border border-border/60 rounded-2xl p-5">
            <MarkdownContent content={msg.content} />
            <div className="mt-3 flex items-center gap-2 text-xs text-amber-500 font-medium">
              <AlertTriangle className="h-3.5 w-3.5" />
              Antwort wurde unterbrochen
            </div>
          </div>
        )}
        <motion.button
          type="button"
          onClick={onRetry}
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.96 }}
          className="flex items-center gap-2 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary font-semibold px-4 py-2 text-sm transition-all border border-primary/20"
        >
          <RefreshCw className="h-4 w-4" />
          Erneut versuchen
        </motion.button>
      </div>
    );
  }

  // Streaming or complete state
  return (
    <div className="space-y-4">
      {/* Answer content */}
      {msg.content && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden bg-gradient-to-br from-card to-muted/20 text-card-foreground border border-primary/20 rounded-2xl p-5 shadow-sm"
        >
          {/* Decorative glows */}
          <div className="absolute top-0 right-0 -mt-6 -mr-6 h-28 w-28 rounded-full bg-primary/10 blur-[30px] pointer-events-none" />

          {/* Header with model/latency badges */}
          <div className="flex items-center gap-2 mb-4 border-b border-border/40 pb-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 text-primary">
              <Sparkles className="h-4 w-4" />
            </div>
            <span className="text-base font-bold text-foreground tracking-tight">Antwort</span>
            {msg.model && (
              <span className="ml-auto hidden sm:flex items-center gap-2 text-xs font-mono text-muted-foreground bg-background/80 px-2 py-1 rounded-lg border border-border/50">
                <span className="h-1.5 w-1.5 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
                {msg.model}
              </span>
            )}
            {msg.latencyMs && (
              <span className="hidden sm:block text-xs font-mono text-muted-foreground bg-background/80 px-2 py-1 rounded-lg border border-border/50">
                {msg.latencyMs}ms
              </span>
            )}
          </div>

          <MarkdownContent content={msg.content} />

          {/* Streaming cursor */}
          {msg.status === 'streaming' && (
            <span className="inline-block w-2 h-5 bg-primary/70 rounded-sm animate-pulse ml-0.5 align-text-bottom" />
          )}
        </motion.div>
      )}

      {/* Exercise Cards */}
      {msg.status === 'complete' && msg.citations && msg.citations.some((c: any) => c.metadata?.image_urls?.length > 0) && (
        <ExerciseCards
          citations={msg.citations}
          expandedExercise={expandedExercise}
          setExpandedExercise={setExpandedExercise}
          setLightboxImage={setLightboxImage}
          setLightboxAlt={setLightboxAlt}
        />
      )}

      {/* Result Table */}
      {msg.status === 'complete' && msg.resultTable && msg.resultTable.rows.length > 0 && !(msg.citations && msg.citations.some((c: any) => c.metadata?.image_urls?.length > 0)) && (
        <ResultTableCard resultTable={msg.resultTable} />
      )}

      {/* Citations */}
      {msg.status === 'complete' && msg.citations && msg.citations.length > 0 && (
        <CitationsCard citations={msg.citations} />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Sub-Components                                                      */
/* ------------------------------------------------------------------ */

function MarkdownContent({ content }: { content: string }) {
  return (
    <div className="text-foreground leading-relaxed break-words relative z-10 text-[15px]
      [&_p]:mb-4 [&_p:last-child]:mb-0 [&_p]:text-foreground/90 [&_p]:leading-[1.75]
      [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:mb-4 [&_h1]:mt-6 [&_h1]:tracking-tight
      [&_h2]:text-xl [&_h2]:font-bold [&_h2]:mb-3 [&_h2]:mt-6 [&_h2]:tracking-tight
      [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:mb-2 [&_h3]:mt-4
      [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:mb-4 [&_ul_li]:mb-1.5 [&_ul_li::marker]:text-primary/70
      [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:mb-4 [&_ol_li]:mb-1.5
      [&_strong]:font-semibold [&_strong]:text-foreground
      [&_a]:text-primary [&_a]:font-medium [&_a]:underline [&_a]:underline-offset-4
      [&_blockquote]:border-l-4 [&_blockquote]:border-primary/40 [&_blockquote]:bg-primary/5 [&_blockquote]:pl-4 [&_blockquote]:py-1 [&_blockquote]:pr-4 [&_blockquote]:rounded-r-lg [&_blockquote]:italic [&_blockquote]:mb-4
      [&_pre]:bg-muted/40 [&_pre]:p-3 [&_pre]:rounded-xl [&_pre]:overflow-x-auto [&_pre]:border [&_pre]:border-border/50 [&_pre]:mb-4
      [&_:not(pre)>code]:bg-primary/10 [&_:not(pre)>code]:text-primary [&_:not(pre)>code]:px-1.5 [&_:not(pre)>code]:py-0.5 [&_:not(pre)>code]:rounded-md [&_:not(pre)>code]:text-[0.9em] [&_:not(pre)>code]:font-mono
    ">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          table: ({ node, ...props }) => <div className="overflow-x-auto max-w-full my-4 rounded-xl border border-border/50 shadow-sm bg-background/50"><table className="w-full text-sm text-left border-collapse" {...props} /></div>,
          thead: ({ node, ...props }) => <thead className="bg-muted/40 text-muted-foreground text-xs uppercase tracking-wider" {...props} />,
          th: ({ node, ...props }) => <th className="px-4 py-3 font-semibold border-b border-border/80" {...props} />,
          td: ({ node, ...props }) => <td className="px-4 py-3 border-b border-border/40 text-foreground" {...props} />,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ExerciseCards({ citations, expandedExercise, setExpandedExercise, setLightboxImage, setLightboxAlt }: { citations: any[]; expandedExercise: number | null; setExpandedExercise: (i: number | null) => void; setLightboxImage: (url: string | null) => void; setLightboxAlt: (alt: string) => void; }) {
  const exercises = citations.filter((c: any) => c.metadata?.image_urls?.length > 0).slice(0, 6);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card text-card-foreground border border-border/60 rounded-2xl p-5 shadow-sm"
    >
      <div className="flex items-center gap-3 mb-4 border-b border-border/40 pb-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-muted-foreground">
          <Dumbbell className="h-4 w-4" />
        </div>
        <div>
          <h4 className="text-base font-bold text-foreground">Gefundene Übungen</h4>
          <p className="text-xs text-muted-foreground">{exercises.length} Ergebnisse</p>
        </div>
      </div>

      <div className="space-y-3">
        {exercises.map((cite: any, i: number) => {
          const isExpanded = expandedExercise === i;
          const contentLines = (cite.content || '').split('\n');
          const instructionLines = contentLines.filter((l: string) => /^\d+\./.test(l.trim()));
          const scorePercent = (cite.relevanceScore * 100).toFixed(1);

          return (
            <div
              key={i}
              className={cn("rounded-xl border bg-background overflow-hidden transition-all", isExpanded ? "border-border shadow-md" : "border-border/50 hover:border-border")}
            >
              <div className="flex flex-col md:flex-row">
                <div className="flex gap-1.5 p-2.5 md:w-[240px] md:min-w-[240px] bg-muted/20">
                  {(cite.metadata.image_urls as string[]).slice(0, 2).map((url: string, j: number) => (
                    <button
                      key={j}
                      onClick={() => { setLightboxImage(url); setLightboxAlt(`${cite.documentTitle} – ${j === 0 ? 'Start' : 'End'}`); }}
                      className="relative flex-1 aspect-[3/4] rounded-lg overflow-hidden bg-muted cursor-zoom-in group/img"
                    >
                      <img src={url} alt={`${cite.documentTitle} - ${j === 0 ? 'Start' : 'End'}`} className="w-full h-full object-cover transition-transform duration-500 group-hover/img:scale-105" loading="lazy" />
                      <div className="absolute bottom-1.5 left-1.5 px-2 py-0.5 text-[9px] font-bold tracking-wider rounded-md bg-black/50 text-white/90 backdrop-blur-sm">{j === 0 ? 'START' : 'END'}</div>
                    </button>
                  ))}
                </div>
                <div className="flex-1 p-4 flex flex-col min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h5 className="text-sm font-semibold text-foreground">{cite.documentTitle}</h5>
                    <span className="shrink-0 text-[10px] font-mono font-medium rounded-md bg-muted px-2 py-0.5 text-muted-foreground border border-border/50">{scorePercent}%</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {cite.metadata?.category && <span className="text-[10px] font-medium rounded-md bg-muted/80 text-muted-foreground border border-border/40 px-2 py-0.5">{String(cite.metadata.category)}</span>}
                    {cite.metadata?.level && <span className="text-[10px] font-medium rounded-md bg-muted/80 text-muted-foreground border border-border/40 px-2 py-0.5">{String(cite.metadata.level)}</span>}
                    {cite.metadata?.primaryMuscles && (cite.metadata.primaryMuscles as string[]).map((m: string) => (
                      <span key={m} className="inline-flex items-center gap-1 text-[10px] font-medium rounded-md bg-primary/5 text-primary/80 border border-primary/10 px-2 py-0.5"><Target className="h-2.5 w-2.5" />{m}</span>
                    ))}
                    {cite.metadata?.equipment && cite.metadata.equipment !== 'body only' && <span className="inline-flex items-center gap-1 text-[10px] font-medium rounded-md bg-muted/80 text-muted-foreground border border-border/40 px-2 py-0.5"><Dumbbell className="h-2.5 w-2.5" />{String(cite.metadata.equipment)}</span>}
                  </div>
                  {instructionLines.length > 0 && (
                    <button onClick={() => setExpandedExercise(isExpanded ? null : i)} className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors mt-auto pt-1">
                      <ChevronRight className={cn("h-3.5 w-3.5 transition-transform duration-300", isExpanded && "rotate-90")} />
                      {isExpanded ? 'Anleitung verbergen' : `${instructionLines.length} Schritte`}
                    </button>
                  )}
                </div>
              </div>
              <AnimatePresence>
                {isExpanded && instructionLines.length > 0 && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                    <div className="border-t border-border/40 px-4 py-3 bg-muted/5">
                      <ol className="space-y-2">
                        {instructionLines.map((step: string, si: number) => (
                          <li key={si} className="flex gap-2 text-[13px] leading-relaxed text-foreground/80">
                            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground text-[10px] font-semibold mt-0.5">{si + 1}</span>
                            <span>{step.replace(/^\d+\.\s*/, '')}</span>
                          </li>
                        ))}
                      </ol>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}

function ResultTableCard({ resultTable }: { resultTable: { title: string; columns: string[]; rows: string[][] } }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card text-card-foreground border border-border/60 rounded-2xl p-5 shadow-sm"
    >
      <div className="flex items-center gap-3 mb-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-muted-foreground">
          <Database className="h-4 w-4" />
        </div>
        <h4 className="text-base font-semibold text-foreground">{resultTable.title}</h4>
      </div>
      <div className="overflow-x-auto rounded-xl border border-border/50 shadow-sm">
        <table className="w-full text-sm text-left border-collapse">
          <thead className="text-xs text-muted-foreground uppercase tracking-wider bg-muted/40">
            <tr>{resultTable.columns.map((col, i) => <th key={i} className="px-4 py-3 font-semibold whitespace-nowrap border-b border-border/80">{col}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {resultTable.rows.map((row, i) => <tr key={i} className="hover:bg-muted/20 transition-colors">{row.map((cell, j) => <td key={j} className="px-4 py-3 whitespace-nowrap text-foreground">{cell}</td>)}</tr>)}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CitationsCard({ citations }: { citations: any[] }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card/40 text-card-foreground border border-border/40 rounded-2xl p-5 shadow-sm backdrop-blur-sm"
    >
      <div className="flex items-center gap-3 mb-4 border-b border-border/40 pb-3">
        <BookOpen className="h-4 w-4 text-muted-foreground" />
        <h4 className="text-base font-semibold text-foreground">
          Verwendete Quellen <span className="text-muted-foreground font-normal text-sm ml-1">({citations.length})</span>
        </h4>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left border-collapse">
          <thead className="text-xs text-muted-foreground uppercase tracking-wider">
            <tr>
              <th className="px-1 py-2 font-semibold w-16">Score</th>
              <th className="px-3 py-2 font-semibold w-48">Quelle</th>
              <th className="px-3 py-2 font-semibold">Extrakt</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/30">
            {citations.map((cite: any, i: number) => (
              <tr key={i} className="hover:bg-muted/10 transition-colors">
                <td className="px-1 py-3 align-top">
                  <span className="inline-flex px-2 py-0.5 text-[11px] font-mono font-medium rounded-md bg-primary/10 text-primary border border-primary/20">{(cite.relevanceScore * 100).toFixed(1)}%</span>
                </td>
                <td className="px-3 py-3 align-top">
                  <div className="font-semibold text-foreground line-clamp-2 leading-snug text-sm">{cite.documentTitle}</div>
                </td>
                <td className="px-3 py-3 align-top text-muted-foreground">
                  <div className="line-clamp-2 leading-relaxed hover:line-clamp-none transition-all break-words text-sm">{cite.content}</div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
}

function TypingDots() {
  return (
    <div className="ml-1 flex items-center">
      {[1, 2, 3].map((dot) => (
        <motion.div
          key={dot}
          className="bg-primary mx-0.5 h-1.5 w-1.5 rounded-full"
          initial={{ opacity: 0.3 }}
          animate={{
            opacity: [0.3, 1, 0.3],
            scale: [0.8, 1.2, 0.8],
          }}
          transition={{
            duration: 1.2,
            repeat: Infinity,
            delay: dot * 0.15,
            ease: 'easeInOut',
          }}
        />
      ))}
    </div>
  );
}
