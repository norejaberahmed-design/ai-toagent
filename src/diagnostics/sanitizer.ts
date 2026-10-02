/**
 * M4.5 — Diagnostic Sanitizer & Redactor
 * Ensures zero leakage of credentials, passwords, tokens, API keys, or raw connection strings.
 */

const SECRET_PATTERNS = [
  /(?:password|passwd|pwd)\s*[=:]\s*['"]?([^'",\s]+)/gi,
  /(?:bearer\s+)([a-zA-Z0-9_\-\.]{15,})/gi,
  /(?:api[_-]?key\s*[=:]\s*['"]?)([a-zA-Z0-9_\-\.]{10,})/gi,
  /(?:token\s*[=:]\s*['"]?)([a-zA-Z0-9_\-\.]{10,})/gi,
  /(?:postgres(?:ql)?|mysql):\/\/[^:]+:([^@]+)@/gi,
];

const SENSITIVE_KEY_NAMES = new Set([
  'password',
  'passwd',
  'pwd',
  'secret',
  'token',
  'apikey',
  'api_key',
  'access_token',
  'refresh_token',
  'authorization',
  'credential',
  'credentials',
  'connectionstring',
  'connection_string',
  'privatekey',
  'private_key',
]);

export function sanitizeMessage(message: string): string {
  if (!message) return '';
  let clean = message;
  for (const pattern of SECRET_PATTERNS) {
    clean = clean.replace(pattern, (match, p1) => {
      if (p1) {
        return match.replace(p1, '[REDACTED_SECRET]');
      }
      return '[REDACTED_SECRET]';
    });
  }
  return clean;
}

export function sanitizeMetadata(metadata?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!metadata) return undefined;
  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(metadata)) {
    const lowerKey = key.toLowerCase().replace(/[-_]/g, '');
    if (SENSITIVE_KEY_NAMES.has(lowerKey)) {
      sanitized[key] = '[REDACTED_SECRET]';
      continue;
    }

    if (typeof value === 'string') {
      sanitized[key] = sanitizeMessage(value);
    } else if (Array.isArray(value)) {
      sanitized[key] = value.map((item) =>
        typeof item === 'object' && item !== null
          ? sanitizeMetadata(item as Record<string, unknown>)
          : typeof item === 'string'
          ? sanitizeMessage(item)
          : item
      );
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeMetadata(value as Record<string, unknown>);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}
