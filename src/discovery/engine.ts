import { UnifiedBusinessSnapshot } from '../model/unified';
import { detectAnomalies } from './detectors/anomaly';
import { detectCashflowRisks } from './detectors/cashflow-risk';
import { detectConcentrations } from './detectors/concentration';
import { detectDivergences } from './detectors/divergence';
import { detectInventoryMismatches } from './detectors/inventory-mismatch';
import { detectMarginErosions } from './detectors/margin-erosion';
import { detectOpportunities } from './detectors/opportunity';
import { detectReceivableAgings } from './detectors/receivable-aging';
import { detectTrends } from './detectors/trend';
import { sortSignalsByPriority } from './priority';
import {
  computeRunId,
  DEFAULT_THRESHOLDS,
  DiscoveryConfig,
  Severity,
  Signal,
  Thresholds,
} from './types';

/**
 * Pure, deterministic Discovery Engine.
 * Converts UnifiedBusinessSnapshot[] into prioritized Signal[].
 * Strictly no I/O, no async, no DB, no network, no Date.now(), no Math.random(), no global state.
 */
export function detectSignals(
  snapshots: readonly UnifiedBusinessSnapshot[],
  config: DiscoveryConfig
): readonly Signal[] {
  if (!snapshots || snapshots.length === 0) {
    return [];
  }

  // Tenant Isolation Enforcement: filter out any snapshot belonging to a different tenant
  const targetTenantId = config.tenant_id;
  const isolatedSnapshots = snapshots.filter(
    (snap) => !snap.tenantId || snap.tenantId === targetTenantId
  );

  if (isolatedSnapshots.length === 0) {
    return [];
  }

  // Deterministic chronological ordering (stable sorting by period.from)
  const sortedSnapshots = [...isolatedSnapshots].sort((a, b) => {
    const fromA = a.period?.from ?? '';
    const fromB = b.period?.from ?? '';
    const cmp = fromA.localeCompare(fromB);
    if (cmp !== 0) return cmp;
    const toA = a.period?.to ?? '';
    const toB = b.period?.to ?? '';
    return toA.localeCompare(toB);
  });

  // Effective thresholds: defaults overridden by config
  const effectiveThresholds: Thresholds = {
    ...DEFAULT_THRESHOLDS,
    ...(config.thresholds || {}),
  };

  // Run all 9 detectors synchronously
  const rawSignals: Signal[] = [
    ...detectCashflowRisks(sortedSnapshots, config, effectiveThresholds),
    ...detectTrends(sortedSnapshots, config, effectiveThresholds),
    ...detectAnomalies(sortedSnapshots, config, effectiveThresholds),
    ...detectConcentrations(sortedSnapshots, config, effectiveThresholds),
    ...detectDivergences(sortedSnapshots, config, effectiveThresholds),
    ...detectMarginErosions(sortedSnapshots, config, effectiveThresholds),
    ...detectInventoryMismatches(sortedSnapshots, config, effectiveThresholds),
    ...detectReceivableAgings(sortedSnapshots, config, effectiveThresholds),
    ...detectOpportunities(sortedSnapshots, config, effectiveThresholds),
  ];

  if (rawSignals.length === 0) {
    return [];
  }

  // Compute deterministic run_id from all generated signal IDs
  const allIds = rawSignals.map((s) => s.id);
  const run_id = computeRunId(allIds);

  // Bind run_id to each signal immutably
  const signalsWithRunId: Signal[] = rawSignals.map((s) => ({
    ...s,
    run_id,
  }));

  // Sort strictly by priority ranking and deterministic tie-breaker
  return sortSignalsByPriority(signalsWithRunId);
}

/**
 * Summarizes signals deterministically in Arabic without LLM or external calls.
 * Section 26: template-based, deterministic, Arabic, no LLM.
 */
export function summarizeSignals(
  signals: readonly Signal[]
): {
  headline_ar: string;
  bullets_ar: readonly string[];
} {
  if (!signals || signals.length === 0) {
    return {
      headline_ar: 'لم يتم رصد أي إشارات مالية أو تشغيلية حرجة بناءً على البيانات المتوفرة.',
      bullets_ar: [],
    };
  }

  const criticalList = signals.filter((s) => s.severity === Severity.CRITICAL);
  const warningList = signals.filter((s) => s.severity === Severity.WARNING);
  const oppList = signals.filter((s) => s.severity === Severity.OPPORTUNITY);
  const infoList = signals.filter((s) => s.severity === Severity.INFO);

  const countsText: string[] = [];
  if (criticalList.length > 0) countsText.push(`${criticalList.length} حرجة`);
  if (warningList.length > 0) countsText.push(`${warningList.length} تحذيرية`);
  if (oppList.length > 0) countsText.push(`${oppList.length} فرص استثمارية/تطويرية`);
  if (infoList.length > 0) countsText.push(`${infoList.length} معلوماتية`);

  const headline_ar = `تم رصد ${signals.length} إشارة حتمية: ${countsText.join('، ')}.`;

  const bullets_ar = signals.map((s) => {
    let prefix = '• ';
    if (s.severity === Severity.CRITICAL) prefix = '🔴 [حرج] ';
    else if (s.severity === Severity.WARNING) prefix = '⚠️ [تحذير] ';
    else if (s.severity === Severity.OPPORTUNITY) prefix = '💡 [فرصة] ';
    else prefix = 'ℹ️ [معلومات] ';

    return `${prefix}${s.title_ar}: ${s.explanation_ar}`;
  });

  return {
    headline_ar,
    bullets_ar,
  };
}
