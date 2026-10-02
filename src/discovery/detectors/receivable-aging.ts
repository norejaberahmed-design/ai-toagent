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
 * Detector 8 — RECEIVABLE_AGING
 * Computes receivables / revenue.
 * ratio > 0.5 -> WARNING
 * ratio > 1.0 -> CRITICAL
 * Rule: Never name the ratio "X months" unless explicit documented time relation permits.
 */
export function detectReceivableAgings(
  snapshots: readonly UnifiedBusinessSnapshot[],
  config: DiscoveryConfig,
  thresholds: Thresholds
): Signal[] {
  if (snapshots.length === 0) {
    return [];
  }

  const latestSnap = snapshots[snapshots.length - 1];
  const rec = latestSnap.receivable;
  const rev = latestSnap.revenue || latestSnap.sales;

  if (!rec || rec.value === null || !rev || rev.value === null || rev.value <= 0) {
    return [];
  }

  const evidence = [rec as DiscoveryValue<number>, rev as DiscoveryValue<number>];
  const currCheck = validateCurrencyConsistency(evidence);
  if (!currCheck.valid) {
    return [];
  }

  const detectedAt = extractLatestDetectedAt(evidence);
  if (!detectedAt) {
    return [];
  }

  const ratio = rec.value / rev.value;
  const warnThreshold = thresholds.receivables_to_revenue_warning;
  const critThreshold = thresholds.receivables_to_revenue_critical;

  if (ratio <= warnThreshold) {
    return [];
  }

  const roundedRatio = Math.round(ratio * 100) / 100;

  let severity: Severity;
  if (!rec.is_complete || !rev.is_complete) {
    severity = Severity.INFO;
  } else if (ratio > critThreshold) {
    severity = Severity.CRITICAL;
  } else {
    severity = Severity.WARNING;
  }

  let explanation_ar = `نسبة الذمم المدينة إلى إيرادات الفترة تبلغ ${roundedRatio}x (${rec.value} ${rec.currency || ''} ذمم مقابل ${rev.value} ${rev.currency || ''} إيرادات).`;
  if (!rec.is_complete || !rev.is_complete) {
    explanation_ar += ' (ملاحظة: البيانات غير مكتملة).';
  }

  const id = computeSignalId(SignalType.RECEIVABLE_AGING, evidence, detectedAt);

  return [
    {
      id,
      type: SignalType.RECEIVABLE_AGING,
      severity,
      title_ar: 'تراكم وتأخر في تحصيل الذمم المدينة',
      explanation_ar,
      evidence,
      related_concepts: ['receivable', 'revenue', 'collection'],
      detected_at: detectedAt,
      run_id: '',
    },
  ];
}
