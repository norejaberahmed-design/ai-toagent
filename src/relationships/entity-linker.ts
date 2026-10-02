import { RelationshipEvidence } from './types';

export interface LinkedRowPair {
  parentRow: Record<string, unknown>;
  childRow: Record<string, unknown>;
  matchedKey: string;
}

export function linkRowsAcrossRelationship(
  parentRows: Record<string, unknown>[],
  childRows: Record<string, unknown>[],
  relationship: RelationshipEvidence
): LinkedRowPair[] {
  const linked: LinkedRowPair[] = [];
  const parentMap = new Map<string, Record<string, unknown>>();

  for (const p of parentRows) {
    const keyVal = String(p[relationship.sourceColumn] || '').trim();
    if (keyVal) {
      parentMap.set(keyVal, p);
    }
  }

  for (const c of childRows) {
    const keyVal = String(c[relationship.targetColumn] || '').trim();
    if (keyVal && parentMap.has(keyVal)) {
      linked.push({
        parentRow: parentMap.get(keyVal)!,
        childRow: c,
        matchedKey: keyVal,
      });
    }
  }

  return linked;
}
