import type { ThemeKey } from "@/server/contracts/schemas";

/**
 * Chat-Nachrichtenmodell für den lokalen Verlauf.
 * Persistierbare Fachdaten; visuelle Zustände (Dropdown, Lightbox etc.) bleiben flüchtig.
 */

export type MessageStatus = "streaming" | "complete" | "error" | "interrupted";

export interface ChatMessageBase {
  id: string;
  createdAt: string; // ISO string
}

export interface UserMessage extends ChatMessageBase {
  role: "user";
  content: string;
  theme: ThemeKey;
  topK: number;
}

export interface AssistantMessage extends ChatMessageBase {
  role: "assistant";
  content: string;
  status: MessageStatus;
  model?: string | null;
  latencyMs?: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  citations?: any[];
  resultTable?: {
    title: string;
    columns: string[];
    rows: string[][];
  };
  rawErrorDetails?: string;
  /** Snapshot of the request so Retry uses same params */
  requestSnapshot?: {
    question: string;
    theme: ThemeKey;
    topK: number;
  };
  errorInfo?: {
    code: string;
    message: string;
    hint?: string;
  };
}

export type ChatMessage = UserMessage | AssistantMessage;

/**
 * Persistiertes Konversationsschema für localStorage.
 */
export interface PersistedConversation {
  version: 1;
  sessionId?: string;
  theme: ThemeKey;
  topK: number;
  messages: ChatMessage[];
  updatedAt: string;
}

export const STORAGE_KEY = "everlast-rag-chat-v1";
export const MAX_MESSAGES = 40;
