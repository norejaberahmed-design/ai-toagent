import { BusinessConcept } from '../../connectors/types';
import { UnifiedBusinessSnapshot } from '../../model/unified';
import {
  BreakdownItem,
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
 * Pure HHI computation: HHI = Σ share²
 */
export function computeHHI(shares: readonly number[]): number {
  if (shares.length === 0) return 0;
  const rawSum = shares.reduce((acc, s) => acc + s * s, 0);
  return Math.round(rawSum * 1000) / 1000;
}

/**
 * Detector 3 — CONCENTRATION
 * Requires reliable breakdown data (e.g. from config.breakdowns).
 * HHI = Σ share²
 * Warning: HHI >= 0.25 or top1_share > 0.30
 * Critical: HHI >= 0.40
 * If no real breakdown is provided: NO SIGNAL (never guess from revenue alone).
 */
export function detectConcentrations(
  snapshots: readonly UnifiedBusinessSnapshot[],
  config: DiscoveryConfig,
  thresholds: Thresholds
): Signal[] {
  if (snapshots.length === 0) {
    return [];
  }

  // Concentration requires explicit breakdown
  const breakdowns = config.breakdowns;
  if (!breakdowns) {
    return [];
  }

  const signals: Signal[] = [];
  const latestSnapshot = snapshots[snapshots.length - 1];

  const breakdownEntries: Array<{
    items: readonly BreakdownItem[];
    concept: BusinessConcept;
    labelAr: string;
  }> = [];

  if (breakdowns.customers && breakdowns.customers.length > 0) {
    breakdownEntries.push({
      items: breakdowns.customers,
      concept: 'customer',
      labelAr: 'العملاء',
    });
  }

  if (breakdowns.products && breakdowns.products.length > 0) {
    breakdownEntries.push({
      items: breakdowns.products,
      concept: 'product',
      labelAr: 'المنتجات',
    });
  }

  for (const entry of breakdownEntries) {
    const shares = entry.items.map((i) => i.share);
    const sortedShares = [...shares].sort((a, b) => b - a);
    const top1Share = sortedShares[0] || 0;
    const hhi = computeHHI(shares);

    const isHhiCritical = hhi >= thresholds.concentration_hhi_critical;
    const isHhiWarning = hhi >= thresholds.concentration_hhi_warning;
    const isTop1Warning = top1Share > thresholds.concentration_top1_warning;

    if (!isHhiCritical && !isHhiWarning && !isTop1Warning) {
      continue;
    }

    // Determine evidence from latest snapshot
    const conceptVal = latestSnapshot[entry.concept] || latestSnapshot.revenue || latestSnapshot.sales;
    if (!conceptVal || conceptVal.value === null) {
      continue;
    }

    const evidence = [conceptVal as DiscoveryValue<unknown>];
    const detectedAt = extractLatestDetectedAt(evidence);
    if (!detectedAt) {
      continue;
    }

    let severity: Severity;
    if (!conceptVal.is_complete) {
      severity = Severity.INFO;
    } else if (isHhiCritical) {
      severity = Severity.CRITICAL;
    } else {
      severity = Severity.WARNING;
    }

    const top1Pct = Math.round(top1Share * 100);
    const hhiFormatted = Math.round(hhi * 1000) / 1000;

    let explanation_ar = `تركز عالي في محفظة ${entry.labelAr}: مؤشر هيرفندال HHI = ${hhiFormatted} وحصة العميل/المنتج الأكبر تبلغ ${top1Pct}%.`;
    if (!conceptVal.is_complete) {
      explanation_ar += ' (ملاحظة: البيانات غير مكتملة).';
    }

    const id = computeSignalId(SignalType.CONCENTRATION, evidence, detectedAt);

    signals.push({
      id,
      type: SignalType.CONCENTRATION,
      severity,
      title_ar: `مخاطر تركز في محفظة ${entry.labelAr}`,
      explanation_ar,
      evidence,
      related_concepts: [entry.concept],
      detected_at: detectedAt,
      run_id: '',
    });
  }

  return signals;
}
