import { BusinessConcept } from '../../connectors/types';
import { UnifiedBusinessSnapshot } from '../../model/unified';
import {
  computeSignalId,
  DiscoveryConfig,
  DiscoveryValue,
  extractLatestDetectedAt,
  Severity,
  Signal,
  SignalType,
  Thresholds,
  validateCurrencyConsistency,
} from '../types';

export function computeDivergenceScore(slopeA: number, slopeB: number): number {
  return Math.round(Math.abs(slopeA - slopeB) * 1000) / 1000;
}

function calculateNormalizedSlope(values: number[]): number {
  const n = values.length;
  if (n < 2) return 0;
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumX2 = 0;
  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += values[i];
    sumXY += i * values[i];
    sumX2 += i * i;
  }
  const denom = n * sumX2 - sumX * sumX;
  if (denom === 0) return 0;
  const rawSlope = (n * sumXY - sumX * sumY) / denom;
  const meanY = sumY / n;
  return meanY !== 0 ? rawSlope / Math.abs(meanY) : rawSlope;
}

/**
 * Detector 4 — DIVERGENCE
 * Requires 2 computable opposing trends (e.g. sales up, collections down).
 * divergence_score = abs(slope_a - slope_b) >= divergence_min (0.10)
 */
export function detectDivergences(
  snapshots: readonly UnifiedBusinessSnapshot[],
  config: DiscoveryConfig,
  thresholds: Thresholds
): Signal[] {
  if (snapshots.length < 3) {
    return [];
  }

  // Sort snapshots chronologically
  const sortedSnapshots = [...snapshots].sort((a, b) => {
    const fromA = a.period?.from ?? '';
    const fromB = b.period?.from ?? '';
    return fromA.localeCompare(fromB);
  });

  const signals: Signal[] = [];
  const pairs: Array<{ conceptA: BusinessConcept; conceptB: BusinessConcept; labelA: string; labelB: string }> = [
    { conceptA: 'sales', conceptB: 'collection', labelA: 'المبيعات', labelB: 'التحصيلات' },
    { conceptA: 'revenue', conceptB: 'collection', labelA: 'الإيرادات', labelB: 'التحصيلات' },
    { conceptA: 'sales', conceptB: 'cashflow', labelA: 'المبيعات', labelB: 'التدفقات النقدية' },
    { conceptA: 'revenue', conceptB: 'profit', labelA: 'الإيرادات', labelB: 'الأرباح' },
  ];

  for (const pair of pairs) {
    const valsA: number[] = [];
    const valsB: number[] = [];
    let hasNull = false;
    let anyIncomplete = false;
    const evidenceList: DiscoveryValue<number>[] = [];

    for (const snap of sortedSnapshots) {
      const vA = snap[pair.conceptA];
      const vB = snap[pair.conceptB];
      if (!vA || vA.value === null || !vB || vB.value === null) {
        hasNull = true;
        break;
      }
      if (!vA.is_complete || !vB.is_complete) {
        anyIncomplete = true;
      }
      valsA.push(vA.value);
      valsB.push(vB.value);
    }

    if (hasNull || valsA.length < 3) {
      continue;
    }

    // Use latest values of both concepts as evidence
    const latestSnap = sortedSnapshots[sortedSnapshots.length - 1];
    const evA = latestSnap[pair.conceptA] as DiscoveryValue<number>;
    const evB = latestSnap[pair.conceptB] as DiscoveryValue<number>;
    evidenceList.push(evA, evB);

    const currCheck = validateCurrencyConsistency(evidenceList);
    if (!currCheck.valid || !currCheck.currency) {
      continue;
    }

    const detectedAt = extractLatestDetectedAt(evidenceList);
    if (!detectedAt) {
      continue;
    }

    const slopeA = calculateNormalizedSlope(valsA);
    const slopeB = calculateNormalizedSlope(valsB);

    // Opposing direction check: one positive, one negative
    const isOpposing = (slopeA > 0 && slopeB < 0) || (slopeA < 0 && slopeB > 0);
    if (!isOpposing) {
      continue;
    }

    const divergenceScore = computeDivergenceScore(slopeA, slopeB);
    if (divergenceScore < thresholds.divergence_min) {
      continue;
    }

    let severity: Severity;
    if (anyIncomplete) {
      severity = Severity.INFO;
    } else if (slopeA > 0 && slopeB < 0 && (pair.conceptB === 'cashflow' || pair.conceptB === 'collection')) {
      severity = Severity.CRITICAL;
    } else {
      severity = Severity.WARNING;
    }

    const pctA = Math.round(slopeA * 100);
    const pctB = Math.round(slopeB * 100);

    let explanation_ar = `تباعد ملحوظ بين ${pair.labelA} و${pair.labelB}: اتجاه ${pair.labelA} (${pctA > 0 ? '+' : ''}${pctA}%) يقابله اتجاه معاكس في ${pair.labelB} (${pctB > 0 ? '+' : ''}${pctB}%) بفارق تباعد مقداره ${divergenceScore}.`;
    if (anyIncomplete) {
      explanation_ar += ' (ملاحظة: البيانات غير مكتملة).';
    }

    const id = computeSignalId(SignalType.DIVERGENCE, evidenceList, detectedAt);

    signals.push({
      id,
      type: SignalType.DIVERGENCE,
      severity,
      title_ar: `تباعد اتجاه ${pair.labelA} عن ${pair.labelB}`,
      explanation_ar,
      evidence: evidenceList,
      related_concepts: [pair.conceptA, pair.conceptB],
      detected_at: detectedAt,
      run_id: '',
    });
  }

  return signals;
}
