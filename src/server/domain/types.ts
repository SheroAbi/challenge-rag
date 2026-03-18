/**
 * Zentrale Domänentypen für das RAG Help Center.
 * Nur Typen die tatsächlich importiert werden.
 */

/** Ein einzelner Retrieval-Treffer aus der Vektorsuche. */
export interface RetrievalHit {
  chunkId: string;
  documentId: string;
  documentTitle: string;
  content: string;
  score: number;
  position: number;
  metadata?: Record<string, unknown>;
  sourceId?: string;
}

/** Quellenangabe in einer generierten Antwort. */
export interface Citation {
  documentId: string;
  documentTitle: string;
  chunkId: string;
  content: string;
  relevanceScore: number;
  metadata?: Record<string, unknown>;
}
