import { Severity, Signal, SignalType } from './types';

/**
 * Returns deterministic numerical priority rank according to Section 27:
 * 1. CRITICAL + CASHFLOW_RISK
 * 2. CRITICAL + ANOMALY
 * 3. CRITICAL + MARGIN_EROSION
 * 4. CRITICAL + CONCENTRATION
 * 5. Other CRITICAL
 * 6. WARNING + RECEIVABLE_AGING
 * 7. WARNING + DIVERGENCE
 * 8. WARNING + INVENTORY_MISMATCH
 * 9. Other WARNING
 * 10. INFO
 * 11. OPPORTUNITY
 */
export function getSignalPriorityRank(signal: Signal): number {
  if (signal.severity === Severity.CRITICAL) {
    if (signal.type === SignalType.CASHFLOW_RISK) return 1;
    if (signal.type === SignalType.ANOMALY) return 2;
    if (signal.type === SignalType.MARGIN_EROSION) return 3;
    if (signal.type === SignalType.CONCENTRATION) return 4;
    return 5;
  }

  if (signal.severity === Severity.WARNING) {
    if (signal.type === SignalType.RECEIVABLE_AGING) return 6;
    if (signal.type === SignalType.DIVERGENCE) return 7;
    if (signal.type === SignalType.INVENTORY_MISMATCH) return 8;
    return 9;
  }

  if (signal.severity === Severity.INFO) {
    return 10;
  }

  if (signal.severity === Severity.OPPORTUNITY) {
    return 11;
  }

  return 12;
}

/**
 * Sorts signals deterministically according to Section 27 priority rules.
 * Uses signal.id ascending as the strict tie-breaker.
 */
export function sortSignalsByPriority(
  signals: readonly Signal[]
): readonly Signal[] {
  return [...signals].sort((a, b) => {
    const rankA = getSignalPriorityRank(a);
    const rankB = getSignalPriorityRank(b);
    if (rankA !== rankB) {
      return rankA - rankB;
    }
    return a.id.localeCompare(b.id);
  });
}
