/**
 * Sanitize error messages to prevent leaking tokens or sensitive data.
 */

const SENSITIVE_PATTERNS = [
  /access_token=[^\s&]+/gi,
  /token=[^\s&]+/gi,
  /key=[^\s&]+/gi,
  /Bearer\s+[A-Za-z0-9\-._~+/]+=*/g,
];

export function sanitizeErrorMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : "Unknown error";

  let sanitized = raw;
  for (const pattern of SENSITIVE_PATTERNS) {
    sanitized = sanitized.replace(pattern, "[REDACTED]");
  }

  return sanitized;
}
