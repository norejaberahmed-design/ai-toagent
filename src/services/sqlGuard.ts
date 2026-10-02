/**
 * SQL Guard - Read-Only Enforcement Engine
 * Strict read-only protection: prevents any data modification or schema mutations.
 */

const FORBIDDEN_SQL_KEYWORDS = [
  'INSERT',
  'UPDATE',
  'DELETE',
  'DROP',
  'ALTER',
  'TRUNCATE',
  'REPLACE',
  'CREATE',
  'ATTACH',
  'DETACH',
  'REINDEX',
  'VACUUM',
  'GRANT',
  'REVOKE',
  'COMMIT',
  'ROLLBACK',
  'SAVEPOINT',
  'RELEASE',
];

export class SqlSecurityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SqlSecurityError';
  }
}

/**
 * Validates that an SQL query is strictly read-only.
 * Only allows SELECT and harmless PRAGMA inspection statements.
 */
export function validateReadOnlyQuery(sql: string): boolean {
  const trimmed = sql.trim();
  if (!trimmed) {
    throw new SqlSecurityError('الاستعلام فارغ.');
  }

  // Normalize tokens by stripping strings and comments
  const stripped = trimmed
    .replace(/'(?:''|[^'])*'/g, '') // remove single-quoted strings
    .replace(/"(?:""|[^"])*"/g, '') // remove double-quoted identifiers
    .replace(/--.*$/gm, '') // remove single-line comments
    .replace(/\/\*[\s\S]*?\*\//g, ''); // remove multi-line comments

  // Check for semicolon separation that might hide multiple statements
  const statements = stripped
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean);

  for (const statement of statements) {
    const tokens = statement.split(/\s+/).map((t) => t.toUpperCase());
    const firstWord = tokens[0] || '';

    // Only allow SELECT or PRAGMA statements
    if (firstWord !== 'SELECT' && firstWord !== 'PRAGMA' && firstWord !== 'WITH') {
      throw new SqlSecurityError(
        `محاولة استعلام غير مسموح بها (${firstWord}). النظام محصن للقراءة فقط.`
      );
    }

    // Check for any forbidden destructive keywords anywhere in the statement tokens
    for (const token of tokens) {
      if (FORBIDDEN_SQL_KEYWORDS.includes(token)) {
        throw new SqlSecurityError(
          `العملية [${token}] غير مسموح بها. تم حظر محاولة التعديل لضمان سلامة بيانات الشركة.`
        );
      }
    }
  }

  return true;
}
