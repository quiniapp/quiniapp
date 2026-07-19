/**
 * Redacts sensitive values from objects before they reach the logs.
 *
 * ISO 27001 A.8.15 (Logging) / A.8.12 (Data leakage prevention): credentials and
 * tokens must never be written to logs. Used by the error middleware, which would
 * otherwise log the full request body (including plaintext passwords on failed logins).
 */

const SENSITIVE_KEY_FRAGMENTS = [
  'password',
  'token',
  'secret',
  'authorization',
  'cookie',
  'refresh',
  'access_token',
];

const REDACTED = '[REDACTED]';

const isSensitiveKey = (key: string): boolean => {
  const lower = key.toLowerCase();
  return SENSITIVE_KEY_FRAGMENTS.some((fragment) => lower.includes(fragment));
};

/**
 * Returns a deep copy of `value` with any sensitive field replaced by `[REDACTED]`.
 * Primitives, null and undefined pass through unchanged. Never mutates the input.
 */
export const sanitizeForLog = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeForLog(item));
  }

  if (value !== null && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      result[key] = isSensitiveKey(key) ? REDACTED : sanitizeForLog(val);
    }
    return result;
  }

  return value;
};
