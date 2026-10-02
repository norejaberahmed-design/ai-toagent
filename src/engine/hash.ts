/**
 * Deterministic Content Hasher
 * Pure function: Canonical JSON serialization + 64-bit FNV-1a Hash.
 * Strictly no Date.now(), no Math.random(), no UUID.
 * Produces identical hash for identical content regardless of key order.
 */

export function canonicalJsonStringify(val: unknown): string {
  if (val === null || val === undefined) {
    return 'null';
  }

  if (typeof val === 'number' || typeof val === 'boolean') {
    return JSON.stringify(val);
  }

  if (typeof val === 'string') {
    return JSON.stringify(val);
  }

  if (Array.isArray(val)) {
    return `[${val.map((item) => canonicalJsonStringify(item)).join(',')}]`;
  }

  if (typeof val === 'object') {
    const sortedKeys = Object.keys(val as Record<string, unknown>).sort();
    const pairs = sortedKeys.map((key) => {
      const v = (val as Record<string, unknown>)[key];
      return `${JSON.stringify(key)}:${canonicalJsonStringify(v)}`;
    });
    return `{${pairs.join(',')}}`;
  }

  return JSON.stringify(val);
}

/**
 * 64-bit FNV-1a Hash Implementation
 * Fast, pure, and deterministic across all runtimes.
 */
export function deterministicContentHash(data: unknown): string {
  const str = canonicalJsonStringify(data);
  let h1 = 0x811c9dc5;
  let h2 = 0x811c9dc5 ^ 0xdeadbeef;

  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 0x01000193);
    h2 = Math.imul(h2 ^ ch, 0x01000193);
  }

  // Combine into 16-character hex string
  const hex1 = (h1 >>> 0).toString(16).padStart(8, '0');
  const hex2 = (h2 >>> 0).toString(16).padStart(8, '0');
  return `${hex1}${hex2}`;
}
