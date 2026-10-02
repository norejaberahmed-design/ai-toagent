import { MathematicalVerification } from './types';

/**
 * Searches for exact mathematical relations between numeric columns in rows.
 * E.g., Checks if colA * colB == colC for rows.
 * Example from prompt: 15 (D) * 120 (E) == 1800 (F).
 */
export function detectMathematicalRelations(
  rows: Record<string, unknown>[],
  numericFields: string[]
): MathematicalVerification[] {
  const verifications: MathematicalVerification[] = [];
  if (numericFields.length < 3 || rows.length === 0) {
    return verifications;
  }

  const sampleRows = rows.slice(0, 100);

  // Check all triplets (A, B, C) where A * B == C
  for (let i = 0; i < numericFields.length; i++) {
    for (let j = i + 1; j < numericFields.length; j++) {
      for (let k = 0; k < numericFields.length; k++) {
        if (k === i || k === j) continue;

        const fieldA = numericFields[i];
        const fieldB = numericFields[j];
        const fieldC = numericFields[k];

        let matched = 0;
        let mismatched = 0;

        for (const row of sampleRows) {
          const valA = Number(row[fieldA]);
          const valB = Number(row[fieldB]);
          const valC = Number(row[fieldC]);

          if (isNaN(valA) || isNaN(valB) || isNaN(valC)) continue;
          if (valA === 0 && valB === 0 && valC === 0) continue; // Skip all zeroes

          const product = valA * valB;
          // Tolerance for floating point
          if (Math.abs(product - valC) <= 0.05) {
            matched++;
          } else {
            mismatched++;
          }
        }

        if (matched >= 3 && mismatched === 0) {
          verifications.push({
            formula: `${fieldA} * ${fieldB} == ${fieldC}`,
            factorA: fieldA,
            factorB: fieldB,
            resultField: fieldC,
            matchedCount: matched,
            mismatchCount: mismatched,
            tolerance: 0.05,
            verified: true,
          });
        }
      }
    }
  }

  return verifications;
}
