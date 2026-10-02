import {
  BusinessConcept,
  DataPeriod,
  Provenance,
  ProvenancedValue,
  SafeTransform,
} from '../connectors/types';

/**
 * Extended Provenance interface that includes explanation reasons
 * for incomplete or missing data, fully conforming to the frozen contract.
 */
export interface ExtendedProvenance extends Provenance {
  reason?: string;
  status?: string;
  conflictingSources?: string[];
}

/**
 * UnifiedBusinessSnapshot
 * Holds the 12 core business concepts, each with a full ProvenancedValue.
 * No financial or numeric value exists without its corresponding provenance.
 * Missing data is strictly value = null, is_complete = false (NEVER missing -> 0).
 */
export interface UnifiedBusinessSnapshot {
  tenantId?: string;
  period: DataPeriod | null;
  currency: string;
  is_complete: boolean;
  batchHashes: string[];

  // The 12 Mandatory Business Concepts
  sales: ProvenancedValue<number>;
  revenue: ProvenancedValue<number>;
  product: ProvenancedValue<number>;
  customer: ProvenancedValue<number>;
  cost: ProvenancedValue<number>;
  expense: ProvenancedValue<number>;
  profit: ProvenancedValue<number>;
  collection: ProvenancedValue<number>;
  receivable: ProvenancedValue<number>;
  inventory: ProvenancedValue<number>;
  purchase: ProvenancedValue<number>;
  cashflow: ProvenancedValue<number>;

  // Derived Metric
  margin: ProvenancedValue<number>;
}

/**
 * Creates an empty/missing ProvenancedValue with a clear audit reason.
 * Enforces rule: missing -> value: null, is_complete: false, NEVER 0.
 */
export function createMissingProvenancedValue<T = number>(
  concept: BusinessConcept | 'margin',
  reason: string,
  period: DataPeriod | null = null,
  currency: string | null = null
): ProvenancedValue<T> {
  const emptyProvenance: ExtendedProvenance = {
    source_id: 'NONE',
    connector_id: 'NONE',
    source_ref: `UNAVAILABLE: ${reason}`,
    query_hash: '0000000000000000',
    fetched_at: period ? period.from : '1970-01-01T00:00:00Z',
    transformation_chain: ['NONE'],
    confidence: 0,
    is_complete: false,
    reason,
    status: 'INSUFFICIENT_DATA',
  };

  return {
    value: null,
    unit: null,
    currency,
    period,
    provenance: emptyProvenance as Provenance,
    is_complete: false,
  };
}
