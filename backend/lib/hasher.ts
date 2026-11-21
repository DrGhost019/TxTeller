import { createHash } from 'node:crypto';

/**
 * Computes a deterministic SHA-256 hash of the normalized message body
 * for deduplication (Idempotency).
 */
export function hashMessage(text: string): string {
  return createHash('sha256').update(text.trim()).digest('hex');
}
