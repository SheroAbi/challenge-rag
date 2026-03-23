"use client";

import { useCallback, useRef } from "react";
import type { ThemeKey } from "@/server/contracts/schemas";
import type { AssistantMessage, UserMessage } from "@/lib/types/chat";

export type StreamPhase =
  | "idle"
  | "connecting"
  | "retrieving"
  | "generating"
  | "streaming"
  | "complete"
  | "error";

interface UseStreamChatOptions {
  addMessage: (msg: UserMessage | AssistantMessage) => void;
  patchMessage: (id: string, patch: Partial<AssistantMessage>) => void;
  setSessionId: (id: string) => void;
  onPhaseChange?: (phase: StreamPhase) => void;
}

/**
 * useStreamChat – SSE-Client-Hook für Token-Streaming.
 * Bei Handshake-Fehler: automatischer Fallback auf /api/chat/query.
 * Bei Mid-Stream-Abbruch: Nachricht als "interrupted" markieren.
 */
export function useStreamChat(options: UseStreamChatOptions) {
  const { addMessage, patchMessage, setSessionId, onPhaseChange } = options;
  const abortRef = useRef<AbortController | null>(null);
  const phaseRef = useRef<StreamPhase>("idle");

  const setPhase = useCallback(
    (phase: StreamPhase) => {
      phaseRef.current = phase;
      onPhaseChange?.(phase);
    },
    [onPhaseChange]
  );

  const sendMessage = useCallback(
    async (
      question: string,
      theme: ThemeKey,
      topK: number,
      sessionId?: string
    ) => {
      // Cancel any running stream
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      const userMsgId = `user_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const assistantMsgId = `asst_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

      // 1. Add user message
      const userMsg: UserMessage = {
        id: userMsgId,
        role: "user",
        content: question,
        theme,
        topK,
        createdAt: new Date().toISOString(),
      };
      addMessage(userMsg);

      // 2. Add placeholder assistant message
      const assistantMsg: AssistantMessage = {
        id: assistantMsgId,
        role: "assistant",
        content: "",
        status: "streaming",
        createdAt: new Date().toISOString(),
        requestSnapshot: { question, theme, topK },
      };
      addMessage(assistantMsg);

      setPhase("connecting");
      let receivedFirstToken = false;

      try {
        const res = await fetch("/api/chat/stream", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question, topK, theme, sessionId }),
          signal: controller.signal,
        });

        if (!res.ok || !res.body) {
          throw new Error(`HTTP ${res.status}`);
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let accumulatedContent = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          let currentEventType = "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) {
              currentEventType = "";
              continue;
            }

            if (trimmed.startsWith("event: ")) {
              currentEventType = trimmed.slice(7);
              continue;
            }

            if (trimmed.startsWith("data: ")) {
              const jsonStr = trimmed.slice(6);
              try {
                const data = JSON.parse(jsonStr);

                switch (currentEventType) {
                  case "status":
                    if (data.phase === "retrieving") setPhase("retrieving");
                    else if (data.phase === "generating") setPhase("generating");
                    break;

                  case "meta":
                    patchMessage(assistantMsgId, {
                      model: data.model,
                      citations: data.citations,
                      resultTable: data.resultTable,
                    });
                    if (data.sessionId) setSessionId(data.sessionId);
                    break;

                  case "token":
                    if (!receivedFirstToken) {
                      receivedFirstToken = true;
                      setPhase("streaming");
                    }
                    accumulatedContent += data.text;
                    patchMessage(assistantMsgId, {
                      content: accumulatedContent,
                    });
                    break;

                  case "done":
                    patchMessage(assistantMsgId, {
                      content: data.answer || accumulatedContent,
                      status: "complete",
                      latencyMs: data.latencyMs,
                    });
                    setPhase("complete");
                    break;

                  case "error":
                    patchMessage(assistantMsgId, {
                      status: "error",
                      errorInfo: {
                        code: data.code,
                        message: data.message,
                        hint: data.hint,
                      },
                      rawErrorDetails: JSON.stringify(data, null, 2),
                    });
                    setPhase("error");
                    break;
                }
              } catch {
                // Skip malformed JSON
              }
            }
          }
        }

        // If stream ended without "done" event
        if (phaseRef.current === "streaming" || phaseRef.current === "generating") {
          patchMessage(assistantMsgId, {
            content: accumulatedContent,
            status: accumulatedContent ? "interrupted" : "error",
            errorInfo: accumulatedContent
              ? undefined
              : {
                  code: "STREAM_ENDED",
                  message: "Der Stream wurde unerwartet beendet.",
                  hint: "Versuche es erneut.",
                },
          });
          setPhase(accumulatedContent ? "complete" : "error");
        }
      } catch (err) {
        if (controller.signal.aborted) return; // Intentional abort

        // Fallback to JSON endpoint if no tokens received yet
        if (!receivedFirstToken) {
          setPhase("connecting");
          try {
            const fallbackRes = await fetch("/api/chat/query", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ question, topK, theme, sessionId }),
            });

            const data = await fallbackRes.json();

            if (data.success) {
              patchMessage(assistantMsgId, {
                content: data.answer || "",
                status: "complete",
                model: data.model,
                latencyMs: data.latencyMs,
                citations: data.citations,
                resultTable: data.resultTable,
              });
              if (data.sessionId) setSessionId(data.sessionId);
              setPhase("complete");
            } else {
              patchMessage(assistantMsgId, {
                status: "error",
                errorInfo: data.error,
                rawErrorDetails: JSON.stringify(data, null, 2),
              });
              setPhase("error");
            }
          } catch (fallbackErr) {
            const errMsg = fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr);
            patchMessage(assistantMsgId, {
              status: "error",
              errorInfo: {
                code: "NETWORK_ERROR",
                message: "Verbindung zum Server fehlgeschlagen.",
                hint: "Der Server ist nicht erreichbar.",
              },
              rawErrorDetails: `Fetch Error: ${errMsg}`,
            });
            setPhase("error");
          }
        } else {
          // Mid-stream error — mark as interrupted
          patchMessage(assistantMsgId, { status: "interrupted" });
          setPhase("error");
        }
      }
    },
    [addMessage, patchMessage, setSessionId, setPhase]
  );

  const cancelStream = useCallback(() => {
    abortRef.current?.abort();
    setPhase("idle");
  }, [setPhase]);

  return {
    sendMessage,
    cancelStream,
    phase: phaseRef.current,
  };
}
