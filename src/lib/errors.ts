/**
 * Domänenspezifische Fehlerklassen.
 * Jede Fehlerklasse trägt strukturierte Metadaten für konsistente API-Antworten.
 */

export class AppError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly details?: Record<string, unknown>;

  constructor(
    message: string,
    code: string,
    statusCode: number,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

export class NotImplementedServiceError extends AppError {
  constructor(service: string, method: string) {
    super(
      `Service '${service}.${method}()' ist als Skeleton vorbereitet, aber noch nicht implementiert.`,
      "NOT_IMPLEMENTED",
      501,
      {
        service,
        method,
        phase: "skeleton-v1",
        hint: "Diese Verbindung ist architektonisch angelegt. Aktivierung erfolgt im nächsten Sprint.",
      }
    );
    this.name = "NotImplementedServiceError";
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, "VALIDATION_ERROR", 400, details);
    this.name = "ValidationError";
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, identifier: string) {
    super(
      `${resource} '${identifier}' wurde nicht gefunden.`,
      "NOT_FOUND",
      404,
      { resource, identifier }
    );
    this.name = "NotFoundError";
  }
}

export class DatabaseError extends AppError {
  constructor(operation: string, details?: Record<string, unknown>) {
    super(
      `Datenbankoperation '${operation}' fehlgeschlagen.`,
      "DATABASE_ERROR",
      500,
      details
    );
    this.name = "DatabaseError";
  }
}
