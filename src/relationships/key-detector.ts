import { KeyCandidate } from './types';

export function detectTableKeys(
  tableName: string,
  rows: Record<string, unknown>[]
): KeyCandidate[] {
  const keys: KeyCandidate[] = [];
  const rowCount = rows.length;
  if (rowCount === 0) return keys;

  const columnSet = new Set<string>();
  for (const r of rows) {
    for (const k of Object.keys(r)) {
      columnSet.add(k);
    }
  }
  const columns = Array.from(columnSet).sort();

  for (const col of columns) {
    let nullCount = 0;
    const valueSet = new Set<string>();

    for (const r of rows) {
      const v = r[col];
      if (v === null || v === undefined || v === '') {
        nullCount++;
      } else {
        valueSet.add(String(v).trim());
      }
    }

    const nullRate = nullCount / rowCount;
    const validCount = rowCount - nullCount;
    const uniquenessRatio = validCount > 0 ? valueSet.size / validCount : 0;

    // Check Candidate/Primary Key (100% unique, zero nulls)
    if (nullCount === 0 && uniquenessRatio === 1.0 && rowCount > 1) {
      keys.push({
        tableName,
        columnNames: [col],
        keyType: 'PRIMARY_KEY',
        uniquenessRatio,
        nullRate,
        confidence: 0.95,
        evidence: [
          `نسبة تفرد 100% (${valueSet.size} قيمة فريدة من ${rowCount})`,
          'انعدام القيم الفارغة (Zero Nulls)',
        ],
      });
    } else if (uniquenessRatio > 0.8 && nullRate < 0.05) {
      keys.push({
        tableName,
        columnNames: [col],
        keyType: 'CANDIDATE_KEY',
        uniquenessRatio,
        nullRate,
        confidence: 0.8,
        evidence: [`نسبة تفرد مرتفعة ${(uniquenessRatio * 100).toFixed(1)}%`],
      });
    }
  }

  // Sort deterministically
  keys.sort((a, b) => b.confidence - a.confidence);

  return keys;
}
