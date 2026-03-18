/**
 * Einheitliches API-Response-Envelope für alle Route Handler.
 * Garantiert konsistente Struktur über das gesamte Projekt.
 */

export interface ApiSuccess<T> {
  success: true;
  data: T;
  meta?: {
    timestamp: string;
    requestId?: string;
  };
}

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
    hint?: string;
  };
  meta?: {
    timestamp: string;
    requestId?: string;
  };
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

// ---------- Helper-Funktionen für konsistente Antworten ----------

export function apiSuccess<T>(data: T, requestId?: string): ApiSuccess<T> {
  return {
    success: true,
    data,
    meta: {
      timestamp: new Date().toISOString(),
      requestId,
    },
  };
}

export function apiError(
  code: string,
  message: string,
  details?: Record<string, unknown>,
  hint?: string,
  requestId?: string
): ApiError {
  return {
    success: false,
    error: { code, message, details, hint },
    meta: {
      timestamp: new Date().toISOString(),
      requestId,
    },
  };
}

export function notImplementedResponse(
  feature: string,
  route: string,
  requestId?: string
): ApiError {
  return apiError(
    "NOT_IMPLEMENTED",
    `Feature '${feature}' ist als Skeleton vorbereitet, aber noch nicht implementiert.`,
    { route, status: "stub", phase: "skeleton-v1" },
    `Dieser Endpunkt ist architektonisch verdrahtet. Die Kernlogik wird in der Aktivierungsphase ergänzt.`,
    requestId
  );
}
