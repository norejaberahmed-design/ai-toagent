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

/**
 * Detector 5 — MARGIN_EROSION
 * Minimum 3 periods.
 * Margin must be available for every period.
 * threshold: margin_erosion_min (default: 0.05)
 * Example: 0.25 -> 0.22 -> 0.18 (erosion = 0.07 >= 0.05)
 */
export function detectMarginErosions(
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

  const margins: number[] = [];
  const evidenceList: DiscoveryValue<number>[] = [];
  let hasNull = false;
  let anyIncomplete = false;

  for (const snap of sortedSnapshots) {
    const m = snap.margin;
    if (!m || m.value === null) {
      hasNull = true;
      break;
    }
    if (!m.is_complete) {
      anyIncomplete = true;
    }
    margins.push(m.value);
    evidenceList.push(m as DiscoveryValue<number>);
  }

  if (hasNull || margins.length < 3) {
    return [];
  }

  const currCheck = validateCurrencyConsistency(evidenceList);
  if (!currCheck.valid) {
    return [];
  }

  const detectedAt = extractLatestDetectedAt(evidenceList);
  if (!detectedAt) {
    return [];
  }

  const initialMargin = margins[0];
  const latestMargin = margins[margins.length - 1];
  const erosion = initialMargin - latestMargin;

  // Must have eroded by at least threshold
  if (erosion < thresholds.margin_erosion_min) {
    return [];
  }

  // Check if cost increased while revenue remained flat or dropped
  let explanation_ar = `تآكل في هامش الربح بمقدار ${Math.round(erosion * 100 * 10) / 10}%، حيث تراجع الهامش من ${(initialMargin * 100).toFixed(1)}% إلى ${(latestMargin * 100).toFixed(1)}% خلال ${margins.length} فترات متتالية.`;

  const initialRev = sortedSnapshots[0].revenue?.value ?? sortedSnapshots[0].sales?.value ?? null;
  const latestRev = sortedSnapshots[sortedSnapshots.length - 1].revenue?.value ?? sortedSnapshots[sortedSnapshots.length - 1].sales?.value ?? null;
  const initialCost = sortedSnapshots[0].cost?.value ?? null;
  const latestCost = sortedSnapshots[sortedSnapshots.length - 1].cost?.value ?? null;

  if (initialCost !== null && latestCost !== null && initialRev !== null && latestRev !== null) {
    if (latestCost > initialCost && latestRev <= initialRev) {
      explanation_ar += ` يرجع ذلك مثبتًا إلى ارتفاع التكاليف من ${initialCost} إلى ${latestCost} مع ثبات أو تراجع الإيرادات.`;
    }
  }

  if (anyIncomplete) {
    explanation_ar += ' (ملاحظة: البيانات غير مكتملة).';
  }

  let severity: Severity;
  if (anyIncomplete) {
    severity = Severity.INFO;
  } else if (latestMargin <= 0 || erosion >= 0.15) {
    severity = Severity.CRITICAL;
  } else {
    severity = Severity.WARNING;
  }

  const id = computeSignalId(SignalType.MARGIN_EROSION, evidenceList, detectedAt);

  return [
    {
      id,
      type: SignalType.MARGIN_EROSION,
      severity,
      title_ar: 'تآكل مستمر في هامش الربح',
      explanation_ar,
      evidence: evidenceList,
      related_concepts: ['profit', 'sales'],
      detected_at: detectedAt,
      run_id: '',
    },
  ];
}
