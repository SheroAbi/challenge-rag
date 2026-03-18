'use client';

import { useEffect, useRef, useCallback, useTransition } from 'react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import {
  Paperclip,
  SendIcon,
  XIcon,
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
  Zap,
  RefreshCw,
  X,
  ChevronRight,
  Shield,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import * as React from 'react';
import { themeRegistry } from '@/server/rag/theme-router';
import type { ThemeKey } from '@/server/contracts/schemas';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

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
    const [isFocused, setIsFocused] = React.useState(false);

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
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          {...props}
        />
        {props.onChange && (
          <div
            className="bg-primary absolute right-2 bottom-2 h-2 w-2 rounded-full opacity-0"
            style={{
              animation: 'none',
            }}
            id="textarea-ripple"
          />
        )}
      </div>
    );
  },
);
Textarea.displayName = 'Textarea';

interface ApiResponse {
  success: boolean;
  error?: {
    code: string;
    message: string;
    hint?: string;
  };
  answer?: string;
  citations?: any[];
  model?: string;
  latencyMs?: number;
  resultTable?: {
    title: string;
    columns: string[];
    rows: string[][];
  };
}

export default function AnimatedAIChat() {
  const [value, setValue] = useState('');
  const [attachments, setAttachments] = useState<string[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [isPending, startTransition] = useTransition();
  const { textareaRef, adjustHeight } = useAutoResizeTextarea({
    minHeight: 60,
    maxHeight: 200,
  });
  const [inputFocused, setInputFocused] = useState(false);

  // New states for Startseite-Only Chat
  const [theme, setTheme] = useState<ThemeKey>('saas_docs');
  const [topK, setTopK] = useState<number>(10);
  const [response, setResponse] = useState<ApiResponse | null>(null);
  const [isThemeDropdownOpen, setIsThemeDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [lightboxAlt, setLightboxAlt] = useState<string>('');
  const [expandedExercise, setExpandedExercise] = useState<number | null>(null);
  const [lastQuestion, setLastQuestion] = useState<string>('');
  const [rawErrorDetails, setRawErrorDetails] = useState<string>('');
  const [showErrorDetails, setShowErrorDetails] = useState(false);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsThemeDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (value.trim()) {
        handleSendMessage();
      }
    }
  };

  const handleSendMessage = async (retryQuestion?: string) => {
    const question = retryQuestion || value.trim();
    if (!question || isTyping) return;

    setLastQuestion(question);

    startTransition(() => {
      setIsTyping(true);
      setResponse(null);
      setRawErrorDetails('');
      setShowErrorDetails(false);
    });

    try {
      const res = await fetch("/api/chat/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ "question": question, topK, theme }),
      });

      const rawText = await res.text();

      // Try to parse as JSON
      let data;
      try {
        data = JSON.parse(rawText);
      } catch {
        // Server returned non-JSON (e.g. 500 HTML page)
        setRawErrorDetails(`HTTP ${res.status} ${res.statusText}\n\n${rawText.substring(0, 2000)}`);
        setResponse({
          success: false,
          error: {
            code: "SERVER_ERROR",
            message: `Server antwortete mit HTTP ${res.status}.`,
            hint: "Die Server-Funktion ist abgestürzt. Details unten.",
          },
        });
        return;
      }

      if (!data.success && data.error) {
        setRawErrorDetails(JSON.stringify(data, null, 2));
      }
      setResponse(data);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      setRawErrorDetails(`Fetch Error: ${errMsg}\n\nURL: /api/chat/query\nTheme: ${theme}\nQuestion: ${question.substring(0, 100)}`);
      setResponse({
        success: false,
        error: {
          code: "NETWORK_ERROR",
          message: "Verbindung zum Server fehlgeschlagen.",
          hint: "Der Server ist nicht erreichbar oder hat einen internen Fehler.",
        },
      });
    } finally {
      setIsTyping(false);
      setValue('');
      adjustHeight(true);
    }
  };

  const handleAttachFile = () => {
    const mockFileName = `mock-file-${Math.floor(Math.random() * 1000)}.pdf`;
    setAttachments((prev) => [...prev, mockFileName]);
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const currentTheme = themeRegistry[theme];

  return (
    <div className="flex w-full flex-col items-center justify-center">

      {/* Input Area */}
      <div className="relative mx-auto w-full max-w-4xl px-4 py-8">
        <motion.div
          className="relative z-10 space-y-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        >
          <motion.div
            className="border-border bg-card relative rounded-3xl border shadow-xl transition-all duration-300 hover:shadow-2xl"
            initial={{ scale: 0.98 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.1 }}
          >
            <div className="p-5">
              <Textarea
                ref={textareaRef}
                value={value}
                onChange={(e) => {
                  setValue(e.target.value);
                  adjustHeight();
                }}
                onKeyDown={handleKeyDown}
                onFocus={() => setInputFocused(true)}
                onBlur={() => setInputFocused(false)}
                placeholder={`Frag mich etwas über ${currentTheme.label}...`}
                containerClassName="w-full"
                className={cn(
                  'w-full px-4 py-3 text-base',
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

            <AnimatePresence>
              {attachments.length > 0 && (
                <motion.div
                  className="flex flex-wrap gap-2 px-5 pb-4"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                >
                  {attachments.map((file, index) => (
                    <motion.div
                      key={index}
                      className="bg-primary/10 text-foreground/80 border border-primary/20 flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium shadow-sm backdrop-blur-sm"
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                    >
                      <span className="truncate max-w-[150px]">{file}</span>
                      <button
                        onClick={() => removeAttachment(index)}
                        className="bg-primary/10 hover:bg-destructive/10 text-muted-foreground hover:text-destructive flex h-5 w-5 items-center justify-center rounded-full transition-colors"
                      >
                        <XIcon className="h-3 w-3" />
                      </button>
                    </motion.div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>

            <div className="border-border/50 bg-muted/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-t px-6 py-4 rounded-b-3xl">
              <div className="flex flex-wrap items-center gap-4 w-full sm:w-auto">
                {/* File Attachment Mock */}
                <motion.button
                  type="button"
                  onClick={handleAttachFile}
                  whileTap={{ scale: 0.94 }}
                  className="group text-muted-foreground hover:text-foreground relative rounded-xl p-2.5 transition-colors hover:bg-primary/5 hidden sm:block"
                  title="Mock Upload"
                >
                  <Paperclip className="h-5 w-5" />
                </motion.button>
                
                <div className="h-6 w-px bg-border/40 hidden sm:block" />

                {/* Theme Selector Dropdown */}
                <div className="relative" ref={dropdownRef}>
                  <div className="flex items-center gap-2">
                    <Database className="h-4 w-4 text-muted-foreground hidden sm:block" />
                    <button
                      type="button"
                      onClick={() => setIsThemeDropdownOpen(!isThemeDropdownOpen)}
                      className={cn(
                        "flex items-center justify-between gap-3 bg-background border border-border/80 rounded-xl px-3 py-1.5 text-xs font-semibold text-foreground outline-none hover:bg-muted/50 focus:ring-2 focus:ring-primary/30 shadow-sm cursor-pointer transition-all min-w-[150px]",
                        isThemeDropdownOpen && "ring-2 ring-primary/30 border-primary/50 bg-muted/30"
                      )}
                    >
                      <span className="flex items-center gap-2">
                        {theme === 'food' && <span className="h-2 w-2 rounded-full bg-emerald-500" />}
                        {theme === 'saas_docs' && <span className="h-2 w-2 rounded-full bg-blue-500" />}
                        {theme === 'exercises' && <span className="h-2 w-2 rounded-full bg-orange-500" />}
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
                        className="absolute bottom-full left-0 mb-3 w-[240px] bg-background/95 backdrop-blur-xl border border-border/80 rounded-2xl shadow-2xl overflow-hidden z-50 origin-bottom-left"
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
                <div className="flex items-center gap-2">
                  <Layers className="h-4 w-4 text-muted-foreground" />
                  <div className="flex items-center bg-background border border-border/80 rounded-lg p-0.5 shadow-sm">
                    {[5, 10, 15, 20].map((num) => (
                      <button
                        key={num}
                        onClick={() => setTopK(num)}
                        className={cn(
                          "px-2.5 py-1 text-xs font-medium rounded-md transition-colors",
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
                onClick={() => handleSendMessage()}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.96 }}
                disabled={isTyping || !value.trim()}
                className={cn(
                  'rounded-xl px-6 py-2.5 text-sm font-bold transition-all duration-300 w-full sm:w-auto mt-2 sm:mt-0',
                  'flex items-center justify-center gap-2 shadow-sm',
                  (value.trim() && !isTyping)
                    ? 'bg-primary text-primary-foreground shadow-primary/25 shadow-lg hover:shadow-primary/40 hover:-translate-y-0.5'
                    : isTyping 
                      ? 'bg-primary/80 text-primary-foreground/90 cursor-wait'
                      : 'bg-muted text-muted-foreground/50 opacity-70 cursor-not-allowed',
                )}
              >
                {isTyping ? (
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                  >
                    <Loader2 className="h-4 w-4" />
                  </motion.div>
                ) : (
                  <SendIcon className="h-4 w-4" />
                )}
                <span>{isTyping ? 'Senden...' : 'Senden'}</span>
              </motion.button>
            </div>
          </motion.div>
        </motion.div>

        <AnimatePresence>
          {isTyping && (
            <motion.div
              className="border-border/40 bg-background/90 absolute -bottom-4 left-1/2 -translate-x-1/2 rounded-full border px-5 py-2.5 shadow-2xl backdrop-blur-3xl z-20"
              initial={{ opacity: 0, y: 10, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.9 }}
              transition={{ type: 'spring', bounce: 0.4 }}
            >
              <div className="flex items-center gap-3">
                <div className="bg-primary/20 flex h-8 w-8 items-center justify-center rounded-full ring-2 ring-primary/20">
                  <Sparkles className="text-primary h-4 w-4 animate-pulse" />
                </div>
                <div className="text-foreground/80 flex items-center gap-2 text-sm font-medium pr-1">
                  <span>KI sucht und denkt nach</span>
                  <TypingDots />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Response Area */}
      {response && (
        <div className="w-full max-w-4xl px-4 pb-12">
          <motion.div 
            className="space-y-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            {!response.success ? (
              <motion.div 
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                className="bg-card text-card-foreground border border-border/60 rounded-3xl p-7 shadow-sm overflow-hidden relative"
              >
                {/* Subtle decorative glow */}
                <div className="absolute top-0 right-0 -mt-10 -mr-10 h-32 w-32 rounded-full bg-amber-500/5 blur-[30px] pointer-events-none" />

                <div className="flex flex-col items-center text-center gap-4 relative z-10">
                  {/* Warning icon */}
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-500/15 ring-4 ring-amber-500/10">
                    <AlertTriangle className="h-7 w-7 text-amber-500" />
                  </div>

                  {/* User-friendly title */}
                  <h3 className="text-lg font-bold text-foreground">
                    {response.error?.code === 'RATE_LIMIT' && 'Einen Moment bitte…'}
                    {response.error?.code === 'NETWORK_ERROR' && 'Keine Verbindung'}
                    {response.error?.code === 'SERVER_ERROR' && 'Server-Fehler'}
                    {response.error?.code === 'MODEL_UNAVAILABLE' && 'KI nicht erreichbar'}
                    {response.error?.code === 'CONFIG_ERROR' && 'Konfigurationsproblem'}
                    {response.error?.code === 'DATABASE_ERROR' && 'Datenbankproblem'}
                    {response.error?.code === 'VALIDATION_ERROR' && 'Ungültige Eingabe'}
                    {(!response.error?.code || response.error?.code === 'INTERNAL_ERROR') && 'Etwas ist schiefgelaufen'}
                  </h3>

                  {/* Friendly message */}
                  <p className="text-sm leading-relaxed text-muted-foreground max-w-md">
                    {response.error?.message || 'Ein unerwarteter Fehler ist aufgetreten.'}
                  </p>

                  {/* Hint box */}
                  {response.error?.hint && (
                    <div className="flex items-center gap-2.5 rounded-xl bg-primary/5 border border-primary/10 px-4 py-3 text-sm text-foreground/80 max-w-md">
                      <Lightbulb className="h-4 w-4 shrink-0 text-primary" />
                      <span>{response.error.hint}</span>
                    </div>
                  )}

                  {/* Retry button */}
                  <motion.button
                    type="button"
                    onClick={() => handleSendMessage(lastQuestion)}
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.96 }}
                    className="mt-2 flex items-center gap-2 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary font-semibold px-5 py-2.5 text-sm transition-all duration-200 border border-primary/20"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Erneut versuchen
                  </motion.button>

                  {/* Collapsible Technical Details */}
                  {rawErrorDetails && (
                    <div className="w-full max-w-lg mt-3">
                      <button
                        type="button"
                        onClick={() => setShowErrorDetails(!showErrorDetails)}
                        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mx-auto"
                      >
                        <ChevronDownIcon className={cn("h-3.5 w-3.5 transition-transform duration-200", showErrorDetails && "rotate-180")} />
                        Technische Details {showErrorDetails ? 'ausblenden' : 'anzeigen'}
                      </button>
                      <AnimatePresence>
                        {showErrorDetails && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.25 }}
                            className="overflow-hidden"
                          >
                            <pre className="mt-2 rounded-xl bg-muted/60 border border-border/50 p-4 text-xs text-muted-foreground font-mono overflow-x-auto max-h-60 overflow-y-auto whitespace-pre-wrap break-all">
                              {rawErrorDetails}
                            </pre>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )}
                </div>
              </motion.div>
            ) : (
              <>
                {/* 1. AI Answer Card */}
                {response.answer && (
                  <motion.div 
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                    className="relative overflow-hidden bg-gradient-to-br from-card to-muted/20 text-card-foreground border border-primary/20 rounded-3xl p-6 md:p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.1)]"
                  >
                    {/* Decorative background glows */}
                    <div className="absolute top-0 right-0 -mt-8 -mr-8 h-40 w-40 rounded-full bg-primary/10 blur-[40px] pointer-events-none" />
                    <div className="absolute bottom-0 left-0 -mb-8 -ml-8 h-40 w-40 rounded-full bg-primary/5 blur-[40px] pointer-events-none" />

                    <div className="flex items-center gap-3 mb-6 border-b border-border/40 pb-5">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 text-primary shadow-inner">
                        <Sparkles className="h-5 w-5" />
                      </div>
                      <h3 className="text-xl font-bold text-foreground tracking-tight">Antwort</h3>
                      <div className="ml-auto flex items-center gap-3 text-xs font-mono text-muted-foreground hidden sm:flex">
                        <span className="bg-background/80 px-2.5 py-1.5 rounded-lg border border-border/50 shadow-sm flex items-center gap-2">
                          <span className="h-1.5 w-1.5 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
                          {response.model}
                        </span>
                        <span className="bg-background/80 px-2.5 py-1.5 rounded-lg border border-border/50 shadow-sm">
                          {response.latencyMs}ms
                        </span>
                      </div>
                    </div>
                    
                    <div className="text-foreground leading-relaxed break-words relative z-10 text-[15px] sm:text-[16px]
                      [&_p]:mb-5 [&_p:last-child]:mb-0 [&_p]:text-foreground/90 [&_p]:leading-[1.75]
                      [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:mb-4 [&_h1]:mt-8 [&_h1]:tracking-tight
                      [&_h2]:text-xl [&_h2]:font-bold [&_h2]:mb-4 [&_h2]:mt-8 [&_h2]:tracking-tight
                      [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:mb-3 [&_h3]:mt-6
                      [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:mb-5 [&_ul_li]:mb-2 [&_ul_li::marker]:text-primary/70
                      [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:mb-5 [&_ol_li]:mb-2
                      [&_strong]:font-semibold [&_strong]:text-foreground
                      [&_a]:text-primary [&_a]:font-medium [&_a]:underline [&_a]:underline-offset-4 hover:[&_a]:text-primary/80 transition-colors
                      [&_blockquote]:border-l-4 [&_blockquote]:border-primary/40 [&_blockquote]:bg-primary/5 [&_blockquote]:pl-4 [&_blockquote]:py-1 [&_blockquote]:pr-4 [&_blockquote]:rounded-r-lg [&_blockquote]:italic [&_blockquote]:text-muted-foreground/90 [&_blockquote]:mb-5
                      [&_pre]:bg-muted/40 [&_pre]:p-4 [&_pre]:rounded-xl [&_pre]:overflow-x-auto [&_pre]:border [&_pre]:border-border/50 [&_pre]:shadow-inner [&_pre]:mb-5
                      [&_:not(pre)>code]:bg-primary/10 [&_:not(pre)>code]:text-primary [&_:not(pre)>code]:px-1.5 [&_:not(pre)>code]:py-0.5 [&_:not(pre)>code]:rounded-md [&_:not(pre)>code]:text-[0.9em] [&_:not(pre)>code]:font-mono [&_:not(pre)>code]:shadow-sm
                    ">
                      <ReactMarkdown 
                        remarkPlugins={[remarkGfm]}
                        components={{
                          table: ({node, ...props}) => <div className="overflow-x-auto my-6 rounded-xl border border-border/50 shadow-sm bg-background/50 backdrop-blur-sm"><table className="w-full text-sm text-left border-collapse" {...props} /></div>,
                          thead: ({node, ...props}) => <thead className="bg-muted/40 text-muted-foreground text-xs uppercase tracking-wider" {...props} />,
                          th: ({node, ...props}) => <th className="px-4 py-3 font-semibold border-b border-border/80" {...props} />,
                          td: ({node, ...props}) => <td className="px-4 py-3 border-b border-border/40 text-foreground" {...props} />,
                        }}
                      >
                        {response.answer}
                      </ReactMarkdown>
                    </div>
                  </motion.div>
                )}

                {/* Premium Exercise Cards */}
                {response.citations && response.citations.some((c: any) => c.metadata?.image_urls?.length > 0) && (
                  <motion.div
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
                    className="bg-card text-card-foreground border border-border/60 rounded-3xl p-6 md:p-8 shadow-sm overflow-hidden"
                  >
                    <div className="flex items-center gap-3 mb-6 border-b border-border/40 pb-5">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                        <Dumbbell className="h-5 w-5" />
                      </div>
                      <div>
                        <h4 className="text-lg font-bold text-foreground tracking-tight">Gefundene Übungen</h4>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {response.citations.filter((c: any) => c.metadata?.image_urls?.length > 0).length} Ergebnisse · Bilder anklicken für Vollansicht
                        </p>
                      </div>
                    </div>

                    <div className="space-y-3">
                      {response.citations
                        .filter((c: any) => c.metadata?.image_urls?.length > 0)
                        .slice(0, 6)
                        .map((cite: any, i: number) => {
                          const isExpanded = expandedExercise === i;
                          const contentLines = (cite.content || '').split('\n');
                          const instructionLines = contentLines.filter((l: string) => /^\d+\./.test(l.trim()));
                          const scorePercent = (cite.relevanceScore * 100).toFixed(1);

                          return (
                            <motion.div
                              key={i}
                              initial={{ opacity: 0, y: 8 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ duration: 0.35, delay: i * 0.06, ease: [0.16, 1, 0.3, 1] }}
                              className={cn(
                                "rounded-2xl border bg-background overflow-hidden transition-all duration-200",
                                isExpanded ? "border-border shadow-md" : "border-border/50 hover:border-border hover:shadow-sm"
                              )}
                            >
                              {/* Card: Images + Info side by side */}
                              <div className="flex flex-col md:flex-row">
                                {/* Images */}
                                <div className="flex gap-1.5 p-2.5 md:w-[260px] md:min-w-[260px] bg-muted/20">
                                  {(cite.metadata.image_urls as string[]).slice(0, 2).map((url: string, j: number) => (
                                    <button
                                      key={j}
                                      onClick={() => { setLightboxImage(url); setLightboxAlt(`${cite.documentTitle} – ${j === 0 ? 'Startposition' : 'Endposition'}`); }}
                                      className="relative flex-1 aspect-[3/4] rounded-xl overflow-hidden bg-muted cursor-zoom-in group/img"
                                    >
                                      <img
                                        src={url}
                                        alt={`${cite.documentTitle} - ${j === 0 ? 'Start' : 'End'}`}
                                        className="w-full h-full object-cover transition-transform duration-500 group-hover/img:scale-105"
                                        loading="lazy"
                                      />
                                      <div className="absolute inset-0 bg-black/0 group-hover/img:bg-black/10 transition-colors duration-300" />
                                      <div className="absolute bottom-1.5 left-1.5 px-2 py-0.5 text-[9px] font-bold tracking-wider rounded-md bg-black/50 text-white/90 backdrop-blur-sm">
                                        {j === 0 ? 'START' : 'END'}
                                      </div>
                                    </button>
                                  ))}
                                </div>

                                {/* Info */}
                                <div className="flex-1 p-4 md:p-5 flex flex-col min-w-0">
                                  <div className="flex items-start justify-between gap-3 mb-2.5">
                                    <h5 className="text-[15px] font-semibold text-foreground leading-snug">{cite.documentTitle}</h5>
                                    <span className="shrink-0 inline-flex px-2 py-0.5 text-[10px] font-mono font-medium rounded-md bg-muted text-muted-foreground border border-border/50">
                                      {scorePercent}%
                                    </span>
                                  </div>

                                  {/* Tags — all muted, same style */}
                                  <div className="flex flex-wrap gap-1.5 mb-3">
                                    {cite.metadata?.category && (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded-md bg-muted/80 text-muted-foreground border border-border/40">
                                        {String(cite.metadata.category)}
                                      </span>
                                    )}
                                    {cite.metadata?.level && (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded-md bg-muted/80 text-muted-foreground border border-border/40">
                                        {String(cite.metadata.level)}
                                      </span>
                                    )}
                                    {cite.metadata?.primaryMuscles && (cite.metadata.primaryMuscles as string[]).map((m: string) => (
                                      <span key={m} className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded-md bg-primary/5 text-primary/80 border border-primary/10">
                                        <Target className="h-2.5 w-2.5" />
                                        {m}
                                      </span>
                                    ))}
                                    {cite.metadata?.equipment && cite.metadata.equipment !== 'body only' && (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded-md bg-muted/80 text-muted-foreground border border-border/40">
                                        <Dumbbell className="h-2.5 w-2.5" />
                                        {String(cite.metadata.equipment)}
                                      </span>
                                    )}
                                    {cite.metadata?.force && (
                                      <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-medium rounded-md bg-muted/80 text-muted-foreground border border-border/40">
                                        {String(cite.metadata.force)}
                                      </span>
                                    )}
                                  </div>

                                  {/* Secondary muscles */}
                                  {cite.metadata?.secondaryMuscles && (cite.metadata.secondaryMuscles as string[]).length > 0 && (
                                    <p className="text-[11px] text-muted-foreground/70 mb-2">
                                      Sekundär: {(cite.metadata.secondaryMuscles as string[]).join(', ')}
                                    </p>
                                  )}

                                  {/* Expand instructions */}
                                  {instructionLines.length > 0 && (
                                    <button
                                      onClick={() => setExpandedExercise(isExpanded ? null : i)}
                                      className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors mt-auto pt-1"
                                    >
                                      <ChevronRight className={cn("h-3.5 w-3.5 transition-transform duration-300", isExpanded && "rotate-90")} />
                                      {isExpanded ? 'Anleitung verbergen' : `Anleitung anzeigen (${instructionLines.length} Schritte)`}
                                    </button>
                                  )}
                                </div>
                              </div>

                              {/* Expandable instructions */}
                              <AnimatePresence>
                                {isExpanded && instructionLines.length > 0 && (
                                  <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                                    className="overflow-hidden"
                                  >
                                    <div className="border-t border-border/40 px-5 py-4 bg-muted/5">
                                      <ol className="space-y-2.5">
                                        {instructionLines.map((step: string, si: number) => (
                                          <li key={si} className="flex gap-3 text-[13px] leading-relaxed text-foreground/80">
                                            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground text-[10px] font-semibold mt-0.5">
                                              {si + 1}
                                            </span>
                                            <span>{step.replace(/^\d+\.\s*/, '')}</span>
                                          </li>
                                        ))}
                                      </ol>
                                    </div>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </motion.div>
                          );
                        })}
                    </div>
                  </motion.div>
                )}

                {/* 2. Structured Data Table (hidden for exercises since we have cards) */}
                {response.resultTable && response.resultTable.rows.length > 0 && !(response.citations && response.citations.some((c: any) => c.metadata?.image_urls?.length > 0)) && (
                  <motion.div 
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
                    className="bg-card text-card-foreground border border-border/60 rounded-3xl p-6 md:p-8 shadow-sm overflow-hidden relative"
                  >
                    <div className="flex items-center gap-3 mb-5">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                        <Database className="h-4 w-4" />
                      </div>
                      <h4 className="text-lg font-semibold text-foreground tracking-tight">
                        {response.resultTable.title}
                      </h4>
                    </div>
                    <div className="overflow-x-auto rounded-xl border border-border/50 shadow-sm">
                      <table className="w-full text-sm text-left border-collapse">
                        <thead className="text-xs text-muted-foreground uppercase tracking-wider bg-muted/40">
                          <tr>
                            {response.resultTable.columns.map((col, i) => (
                              <th key={i} className="px-4 py-3.5 font-semibold whitespace-nowrap border-b border-border/80">{col}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/40">
                          {response.resultTable.rows.map((row, i) => (
                            <tr key={i} className="hover:bg-muted/20 transition-colors">
                              {row.map((cell, j) => (
                                <td key={j} className="px-4 py-3 whitespace-nowrap text-foreground">{cell}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </motion.div>
                )}

                {/* 3. Citations / Sources Table */}
                {response.citations && response.citations.length > 0 && (
                  <motion.div 
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
                    className="bg-card/40 text-card-foreground border border-border/40 rounded-3xl p-6 md:p-8 shadow-sm backdrop-blur-sm"
                  >
                    <div className="flex items-center gap-3 mb-5 border-b border-border/40 pb-4">
                      <BookOpen className="h-5 w-5 text-muted-foreground" />
                      <h4 className="text-lg font-semibold text-foreground tracking-tight">
                        Verwendete Quellen <span className="text-muted-foreground font-normal text-sm ml-1">({response.citations.length})</span>
                      </h4>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm text-left border-collapse">
                        <thead className="text-xs text-muted-foreground uppercase tracking-wider">
                          <tr>
                            <th className="px-1 py-3 font-semibold w-20">Score</th>
                            <th className="px-4 py-3 font-semibold w-56">Quelle</th>
                            <th className="px-4 py-3 font-semibold">Extrakt</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/30">
                          {response.citations.map((cite, i) => (
                            <tr key={i} className="group hover:bg-muted/10 transition-colors">
                              <td className="px-1 py-4 align-top">
                                <span className="inline-flex px-2 py-1 text-[11px] font-mono font-medium rounded-md bg-primary/10 text-primary border border-primary/20 shadow-sm">
                                  {(cite.relevanceScore * 100).toFixed(1)}%
                                </span>
                              </td>
                              <td className="px-4 py-4 align-top">
                                <div className="font-semibold text-foreground line-clamp-2 leading-snug" title={cite.documentTitle}>
                                  {cite.documentTitle}
                                </div>
                              </td>
                              <td className="px-4 py-4 align-top text-muted-foreground">
                                <div className="line-clamp-2 leading-relaxed hover:line-clamp-none transition-all duration-300">
                                  {cite.content}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </motion.div>
                )}
              </>
            )}
          </motion.div>
        </div>
      )}

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
          style={{
            boxShadow: '0 0 8px var(--tw-shadow-color)',
            shadowColor: 'var(--color-primary)',
          } as React.CSSProperties}
        />
      ))}
    </div>
  );
}

