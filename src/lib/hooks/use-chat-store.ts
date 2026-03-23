"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type {
  ChatMessage,
  AssistantMessage,
  PersistedConversation,
} from "@/lib/types/chat";
import { STORAGE_KEY, MAX_MESSAGES } from "@/lib/types/chat";
import type { ThemeKey } from "@/server/contracts/schemas";

/**
 * useChatStore – verwaltet den Chat-Nachrichtenverlauf mit localStorage-Persistenz.
 * Hydration nur clientseitig nach Mount (kein SSR-Mismatch).
 */
export function useChatStore(theme: ThemeKey, topK: number) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sessionId, setSessionId] = useState<string | undefined>();
  const [hydrated, setHydrated] = useState(false);
  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  // Hydrate from localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed: PersistedConversation = JSON.parse(raw);
        if (parsed.version === 1 && Array.isArray(parsed.messages)) {
          // Mark any "streaming" messages as "interrupted"
          const restored = parsed.messages.map((msg) => {
            if (msg.role === "assistant" && msg.status === "streaming") {
              return { ...msg, status: "interrupted" as const };
            }
            return msg;
          });
          setMessages(restored);
          setSessionId(parsed.sessionId);
        }
      }
    } catch {
      // Corrupt data — start fresh
    }
    setHydrated(true);
  }, []);

  // Persist to localStorage after changes (only after hydration)
  useEffect(() => {
    if (!hydrated) return;

    const conversation: PersistedConversation = {
      version: 1,
      sessionId,
      theme,
      topK,
      messages: messagesRef.current.slice(-MAX_MESSAGES),
      updatedAt: new Date().toISOString(),
    };

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(conversation));
    } catch {
      // Quota exceeded — trim older messages
      try {
        conversation.messages = conversation.messages.slice(-20);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(conversation));
      } catch {
        // Give up silently
      }
    }
  }, [messages, sessionId, theme, topK, hydrated]);

  const addMessage = useCallback((msg: ChatMessage) => {
    setMessages((prev) => [...prev.slice(-(MAX_MESSAGES - 1)), msg]);
  }, []);

  const patchMessage = useCallback(
    (id: string, patch: Partial<AssistantMessage>) => {
      setMessages((prev) =>
        prev.map((msg) => {
          if (msg.id === id && msg.role === "assistant") {
            return { ...msg, ...patch } as AssistantMessage;
          }
          return msg;
        })
      );
    },
    []
  );

  const clearHistory = useCallback(() => {
    setMessages([]);
    setSessionId(undefined);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }, []);

  return {
    messages,
    sessionId,
    setSessionId,
    hydrated,
    addMessage,
    patchMessage,
    clearHistory,
  };
}
