import {
  BusinessConcept,
  DataBatch,
  DataPeriod,
  ProvenancedValue,
} from '../connectors/types';
import { createMissingProvenancedValue, ExtendedProvenance } from '../model/unified';
import { deterministicContentHash } from './hash';

export interface MergeOptions {
  tenantCurrency: string;
  targetPeriod?: DataPeriod;
}

export interface CandidateMetric<T = number> {
  batch: DataBatch;
  computed: ProvenancedValue<T>;
  confidence: number;
}

/**
 * Validates whether two periods are compatible (e.g. 2024 does not mix with 2025).
 */
export function arePeriodsCompatible(a: DataPeriod | null, b: DataPeriod | null): boolean {
  if (!a || !b) return true;
  // Year check based on ISO string prefixes
  const aYear = a.from.substring(0, 4);
  const bYear = b.from.substring(0, 4);
  return aYear === bYear;
}

/**
 * Checks if a batch matches the target period.
 */
export function isBatchInPeriod(batch: DataBatch, targetPeriod?: DataPeriod): boolean {
  if (!targetPeriod) return true;
  const batchYear = batch.period.from.substring(0, 4);
  const targetYear = targetPeriod.from.substring(0, 4);
  return batchYear === targetYear;
}

/**
 * Merges multiple candidate values for a single Business Concept
 * Policy:
 * 1. Filter out batches that do not match the target period (2024 != 2025).
 * 2. Currency check: No currency conversion in P2. If mismatch between candidate and tenant, or between candidates -> CURRENCY_MISMATCH, value = null.
 * 3. Highest confidence wins:
 *    - If one candidate has strictly higher confidence -> that candidate is selected.
 *    - If multiple candidates have different values and equal confidence -> UNRESOLVED CONFLICT.
 *      Silent merge is strictly forbidden (never sum 5000 + 7000 = 12000, never silently pick one).
 *      Result: value = null, is_complete = false, status = PARTIAL_DATA, reason logged in provenance.
 */
export function mergeConceptCandidates<T = number>(
  concept: BusinessConcept,
  candidates: CandidateMetric<T>[],
  options: MergeOptions
): ProvenancedValue<T> {
  if (!candidates || candidates.length === 0) {
    return createMissingProvenancedValue<T>(
      concept,
      `لا توجد مصادر بيانات متاحة لحساب ${concept}`,
      options.targetPeriod,
      options.tenantCurrency
    );
  }

  // 1. Period Filtering: strictly discard batches from other periods
  const periodFiltered = candidates.filter((c) =>
    isBatchInPeriod(c.batch, options.targetPeriod)
  );

  if (periodFiltered.length === 0) {
    return createMissingProvenancedValue<T>(
      concept,
      `لا توجد بيانات للفترة المحددة (${options.targetPeriod?.from} إلى ${options.targetPeriod?.to})`,
      options.targetPeriod,
      options.tenantCurrency
    );
  }

  // 2. Currency Validation: No conversion allowed.
  for (const c of periodFiltered) {
    const cur = c.computed.currency;
    if (cur && cur !== options.tenantCurrency) {
      const missing = createMissingProvenancedValue<T>(
        concept,
        `CURRENCY_MISMATCH: عملة المصدر (${cur}) لا تطابق عملة المنشأة (${options.tenantCurrency}). تحويل العملات معطل في P2.`,
        c.computed.period,
        options.tenantCurrency
      );
      (missing.provenance as ExtendedProvenance).status = 'PARTIAL_DATA';
      return missing;
    }
  }

  // If only 1 candidate, return it directly
  if (periodFiltered.length === 1) {
    return periodFiltered[0].computed;
  }

  // Sort deterministically: primary by confidence DESC, secondary by deterministic hash
  const sorted = [...periodFiltered].sort((a, b) => {
    if (b.confidence !== a.confidence) {
      return b.confidence - a.confidence;
    }
    const hashA = a.computed.provenance?.query_hash || '';
    const hashB = b.computed.provenance?.query_hash || '';
    return hashA.localeCompare(hashB);
  });

  const best = sorted[0];
  const second = sorted[1];

  // 3. Conflict Detection:
  // If top candidates have different values and identical confidence, it's an unresolved conflict.
  if (
    best.confidence === second.confidence &&
    best.computed.value !== second.computed.value
  ) {
    const conflictHash = deterministicContentHash({
      concept,
      candidateA: best.computed.value,
      candidateB: second.computed.value,
      confA: best.confidence,
      confB: second.confidence,
    });

    const empty = createMissingProvenancedValue<T>(
      concept,
      `PARTIAL_DATA: تعارض غير محسوم بين مصدرين (${best.batch.provenance.source_id} بقيمة ${best.computed.value}) و (${second.batch.provenance.source_id} بقيمة ${second.computed.value}) بنفس نسبة الثقة (${best.confidence}). يمنع الدمج الصامت.`,
      best.computed.period,
      options.tenantCurrency
    );

    const ext = empty.provenance as ExtendedProvenance;
    ext.status = 'PARTIAL_DATA';
    ext.query_hash = conflictHash;
    ext.conflictingSources = [
      best.batch.provenance.source_id,
      second.batch.provenance.source_id,
    ];
    return empty;
  }

  // Highest confidence strictly wins!
  return best.computed;
}
