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

const ANOMALY_CONCEPTS: BusinessConcept[] = [
  'sales',
  'revenue',
  'profit',
  'cost',
  'expense',
  'cashflow',
];

const CONCEPT_NAMES_AR: Record<string, string> = {
  sales: 'المبيعات',
  revenue: 'الإيرادات',
  profit: 'الأرباح',
  cost: 'التكاليف',
  expense: 'المصروفات',
  cashflow: 'التدفقات النقدية',
};

/**
 * Detector 2 — ANOMALY
 * Requires >= 6 periods.
 * Computes mean, stddev, z-score.
 * warning = 2.5, critical = 3.5.
 * If stddev = 0 -> no Signal.
 */
export function detectAnomalies(
  snapshots: readonly UnifiedBusinessSnapshot[],
  config: DiscoveryConfig,
  thresholds: Thresholds
): Signal[] {
  if (snapshots.length < 6) {
    return [];
  }

  // Sort snapshots deterministically by period start
  const sortedSnapshots = [...snapshots].sort((a, b) => {
    const fromA = a.period?.from ?? '';
    const fromB = b.period?.from ?? '';
    return fromA.localeCompare(fromB);
  });

  const signals: Signal[] = [];

  for (const concept of ANOMALY_CONCEPTS) {
    const values: number[] = [];
    const evidenceList: DiscoveryValue<number>[] = [];
    let hasNull = false;
    let anyIncomplete = false;

    for (const snap of sortedSnapshots) {
      const val = snap[concept];
      if (!val || val.value === null) {
        hasNull = true;
        break;
      }
      if (!val.is_complete) {
        anyIncomplete = true;
      }
      values.push(val.value);
      evidenceList.push(val as DiscoveryValue<number>);
    }

    if (hasNull || values.length < 6) {
      continue;
    }

    const currCheck = validateCurrencyConsistency(evidenceList);
    if (!currCheck.valid || !currCheck.currency) {
      continue;
    }

    // Deterministic mean and stddev
    const n = values.length;
    const sum = values.reduce((a, b) => a + b, 0);
    const mean = sum / n;

    const variance = values.reduce((acc, v) => acc + (v - mean) * (v - mean), 0) / n;
    const stddev = Math.sqrt(variance);

    if (stddev === 0) {
      continue;
    }

    const latestValue = values[n - 1];
    const latestEvidence = evidenceList[n - 1];
    const zScore = (latestValue - mean) / stddev;
    const absZ = Math.abs(zScore);

    if (absZ < thresholds.anomaly_z_warning) {
      continue;
    }

    let severity: Severity;
    if (anyIncomplete) {
      severity = Severity.INFO;
    } else if (absZ >= thresholds.anomaly_z_critical) {
      severity = Severity.CRITICAL;
    } else {
      severity = Severity.WARNING;
    }

    const detectedAt = extractLatestDetectedAt([latestEvidence]);
    if (!detectedAt) {
      continue;
    }

    const conceptAr = CONCEPT_NAMES_AR[concept] || concept;
    const roundedZ = Math.round(zScore * 100) / 100;
    const roundedMean = Math.round(mean * 100) / 100;

    let explanation_ar = `شذوذ إحصائي في ${conceptAr}: القيمة المرصودة (${latestValue}) تبتعد عن المتوسط التاريخي (${roundedMean}) بمعامل انحراف معياري z-score = ${roundedZ}.`;
    if (anyIncomplete) {
      explanation_ar += ' (ملاحظة: البيانات غير مكتملة).';
    }

    const id = computeSignalId(SignalType.ANOMALY, [latestEvidence], detectedAt);

    signals.push({
      id,
      type: SignalType.ANOMALY,
      severity,
      title_ar: `شذوذ إحصائي في ${conceptAr}`,
      explanation_ar,
      evidence: [latestEvidence],
      related_concepts: [concept],
      detected_at: detectedAt,
      run_id: '',
    });
  }

  return signals;
}
