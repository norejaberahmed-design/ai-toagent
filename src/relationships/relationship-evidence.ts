import { RelationshipEvidence, Cardinality } from './types';
import { VerificationStatus } from '../semantic/types';

export function evaluateRelationshipEvidence(
  sourceTable: string,
  sourceColumn: string,
  sourceValues: unknown[],
  targetTable: string,
  targetColumn: string,
  targetValues: unknown[]
): RelationshipEvidence | null {
  // Extract non-empty trimmed strings
  const sourceSet = new Set<string>();
  const sourceList: string[] = [];
  for (const v of sourceValues) {
    if (v !== null && v !== undefined && String(v).trim() !== '') {
      const s = String(v).trim();
      sourceSet.add(s);
      sourceList.push(s);
    }
  }

  const targetSet = new Set<string>();
  const targetList: string[] = [];
  for (const v of targetValues) {
    if (v !== null && v !== undefined && String(v).trim() !== '') {
      const s = String(v).trim();
      targetSet.add(s);
      targetList.push(s);
    }
  }

  if (sourceSet.size === 0 || targetSet.size === 0) return null;

  // Count matches
  let matchedCount = 0;
  let unmatchedCount = 0;

  for (const item of targetList) {
    if (sourceSet.has(item)) {
      matchedCount++;
    } else {
      unmatchedCount++;
    }
  }

  const matchRatio = targetList.length > 0 ? matchedCount / targetList.length : 0;
  // Threshold: at least 50% of target values exist in source, and at least 1 matched value
  if (matchRatio < 0.5 || matchedCount < 1) {
    return null;
  }

  // Determine cardinality
  const isSourceUnique = sourceSet.size === sourceList.length;
  // A single record sample in target cannot establish 1:1, defaults to 1:N for parent-child
  const isTargetUnique = targetSet.size === targetList.length && targetList.length > 1;

  let cardinality: Cardinality = 'N:N';
  if (isSourceUnique && isTargetUnique) cardinality = '1:1';
  else if (isSourceUnique && !isTargetUnique) cardinality = '1:N';
  else if (!isSourceUnique && isTargetUnique) cardinality = 'N:1';

  const evidence: string[] = [
    `تطابق في القيم المشتركة بمعدل ${(matchRatio * 100).toFixed(1)}% (${matchedCount} قيمة مطابقة)`,
    `علاقة من نوع ${cardinality} استناداً إلى تكرار وتفرد القيم في الجدولين`,
  ];

  const contradictions: string[] = [];
  if (unmatchedCount > 0) {
    contradictions.push(`وجود ${unmatchedCount} سجل في الجدول التابع غير مرتبط بسجل أب في الجدول الرئيسي`);
  }

  let confidence = Math.min(matchRatio, 0.95);
  let status: VerificationStatus = 'HIGH_CONFIDENCE';
  if (unmatchedCount > 0 && matchRatio < 0.9) {
    status = 'PARTIAL';
    confidence = Math.max(confidence - 0.15, 0.5);
  }

  return {
    sourceTable,
    sourceColumn,
    targetTable,
    targetColumn,
    cardinality,
    matchedValuesCount: matchedCount,
    unmatchedValuesCount: unmatchedCount,
    matchRatio: Number(matchRatio.toFixed(3)),
    matchingRule: 'CONTENT_VALUE_INTERSECTION',
    contradictions,
    evidence,
    confidence: Number(confidence.toFixed(2)),
    status,
  };
}
