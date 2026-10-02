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

interface CandidateTrendSignal {
  concept: BusinessConcept;
  evidence: DiscoveryValue<number>[];
  slope: number;
  normSlope: number;
  pctChangePerPeriod: number;
  isComplete: boolean;
  currency: string;
}

const TREND_CONCEPTS: BusinessConcept[] = [
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
 * Detector 1 — TREND
 * Deterministic Linear Regression over >= 3 periods.
 */
export function detectTrends(
  snapshots: readonly UnifiedBusinessSnapshot[],
  config: DiscoveryConfig,
  thresholds: Thresholds
): Signal[] {
  if (snapshots.length < 3) {
    return [];
  }

  // Sort snapshots deterministically by period start
  const sortedSnapshots = [...snapshots].sort((a, b) => {
    const fromA = a.period?.from ?? '';
    const fromB = b.period?.from ?? '';
    return fromA.localeCompare(fromB);
  });

  const signals: Signal[] = [];
  const minSlope = thresholds.trend_slope_min;

  for (const concept of TREND_CONCEPTS) {
    const evidence: DiscoveryValue<number>[] = [];
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
      evidence.push(val as DiscoveryValue<number>);
    }

    if (hasNull || evidence.length < 3) {
      continue;
    }

    // Currency check: all evidence must share identical currency
    const currCheck = validateCurrencyConsistency(evidence);
    if (!currCheck.valid || !currCheck.currency) {
      continue;
    }

    // Extract detected_at (max fetched_at)
    const detectedAt = extractLatestDetectedAt(evidence);
    if (!detectedAt) {
      continue;
    }

    // Deterministic linear regression
    const n = evidence.length;
    let sumX = 0;
    let sumY = 0;
    let sumXY = 0;
    let sumX2 = 0;

    for (let i = 0; i < n; i++) {
      const x = i;
      const y = evidence[i].value as number;
      sumX += x;
      sumY += y;
      sumXY += x * y;
      sumX2 += x * x;
    }

    const denom = n * sumX2 - sumX * sumX;
    if (denom === 0) continue;

    const rawSlope = (n * sumXY - sumX * sumY) / denom;
    const meanY = sumY / n;
    const normSlope = meanY !== 0 ? rawSlope / Math.abs(meanY) : rawSlope;

    // Rule: if abs(slope) <= threshold -> no signal
    if (Math.abs(normSlope) <= minSlope) {
      continue;
    }

    const pct = Math.round(normSlope * 100 * 100) / 100;
    const conceptAr = CONCEPT_NAMES_AR[concept] || concept;
    const directionAr = normSlope > 0 ? 'اتجاه تصاعدي' : 'اتجاه تنازلي';

    let severity: Severity;
    if (anyIncomplete) {
      severity = Severity.INFO;
    } else if (normSlope < 0 && (concept === 'profit' || concept === 'cashflow')) {
      severity = normSlope <= -0.2 ? Severity.CRITICAL : Severity.WARNING;
    } else if (normSlope > 0 && (concept === 'cost' || concept === 'expense')) {
      severity = Severity.WARNING;
    } else if (normSlope < 0 && (concept === 'sales' || concept === 'revenue')) {
      severity = Severity.WARNING;
    } else if (normSlope > 0 && (concept === 'sales' || concept === 'revenue' || concept === 'profit')) {
      severity = Severity.OPPORTUNITY;
    } else {
      severity = Severity.INFO;
    }

    let explanation_ar = `${directionAr} لـ ${conceptAr} بمعدل تغير خطي يقدر بـ ${Math.abs(pct)}% لكل فترة عبر ${n} فترات متتالية.`;
    if (anyIncomplete) {
      explanation_ar += ' (ملاحظة: البيانات غير مكتملة).';
    }

    const id = computeSignalId(SignalType.TREND, evidence, detectedAt);

    signals.push({
      id,
      type: SignalType.TREND,
      severity,
      title_ar: `${directionAr} في ${conceptAr}`,
      explanation_ar,
      evidence,
      related_concepts: [concept],
      detected_at: detectedAt,
      run_id: '', // Will be assigned by engine
    });
  }

  return signals;
}
