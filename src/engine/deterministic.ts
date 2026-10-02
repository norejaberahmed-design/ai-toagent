import {
  BusinessConcept,
  DataBatch,
  DataPeriod,
  ProvenancedValue,
} from '../connectors/types';
import {
  UnifiedBusinessSnapshot,
  createMissingProvenancedValue,
} from '../model/unified';
import {
  computeSumFromBatch,
  computeCountFromBatch,
  computeProfit,
  computeMargin,
} from './metrics';
import { mergeConceptCandidates, CandidateMetric, MergeOptions } from './merge';
import { deterministicContentHash } from './hash';

export interface DeterministicEngineConfig {
  tenantCurrency?: string;
  targetPeriod?: DataPeriod;
  tenantId?: string;
}

/**
 * Pure Deterministic Business Intelligence Engine
 * Requirements:
 * - Purely synchronous.
 * - Zero I/O (no fs, no network, no fetch, no database).
 * - Zero non-determinism (no Date.now(), no Math.random(), no UUID).
 * - Same DataBatch[] produces 100% byte-for-byte identical UnifiedBusinessSnapshot.
 * - Missing data strictly results in value: null, is_complete: false (NEVER missing -> 0).
 */
export function runDeterministicEngine(
  batches: DataBatch[],
  config: DeterministicEngineConfig = {}
): UnifiedBusinessSnapshot {
  const tenantCurrency = config.tenantCurrency || 'SAR';
  const mergeOptions: MergeOptions = {
    tenantCurrency,
    targetPeriod: config.targetPeriod,
  };

  // 1. Deterministic sort of input batches by concept, then source_id, then content hash
  const sortedBatches = [...batches].sort((a, b) => {
    if (a.concept !== b.concept) {
      return a.concept.localeCompare(b.concept);
    }
    if (a.provenance.source_id !== b.provenance.source_id) {
      return a.provenance.source_id.localeCompare(b.provenance.source_id);
    }
    const hashA = a.provenance.query_hash || '';
    const hashB = b.provenance.query_hash || '';
    return hashA.localeCompare(hashB);
  });

  // Calculate batch hashes for audit trail
  const batchHashes = sortedBatches.map((b) => deterministicContentHash(b));

  // Determine overall period from batches if not specified
  let effectivePeriod: DataPeriod | null = config.targetPeriod || null;
  if (!effectivePeriod && sortedBatches.length > 0) {
    effectivePeriod = sortedBatches[0].period;
  }

  // 2. Group batches by Business Concept
  const batchesByConcept = new Map<BusinessConcept, DataBatch[]>();
  for (const b of sortedBatches) {
    const list = batchesByConcept.get(b.concept) || [];
    list.push(b);
    batchesByConcept.set(b.concept, list);
  }

  // Helper to compute and merge candidates for a concept
  const processConcept = (
    concept: BusinessConcept,
    computeFn: (b: DataBatch) => ProvenancedValue<number>
  ): ProvenancedValue<number> => {
    const conceptBatches = batchesByConcept.get(concept) || [];
    if (conceptBatches.length === 0) {
      return createMissingProvenancedValue(
        concept,
        `لا تتوفر بيانات في المصدر لحساب ${concept}.`,
        effectivePeriod,
        tenantCurrency
      );
    }

    const candidates: CandidateMetric<number>[] = conceptBatches.map((b) => ({
      batch: b,
      computed: computeFn(b),
      confidence: b.provenance.confidence,
    }));

    return mergeConceptCandidates(concept, candidates, mergeOptions);
  };

  // 3. Compute each of the base concepts
  const sales = processConcept('sales', (b) =>
    computeSumFromBatch(b, ['amount', 'value', 'total_amount', 'subtotal', 'sales'], tenantCurrency)
  );

  const revenue = processConcept('revenue', (b) =>
    computeSumFromBatch(b, ['revenue', 'amount', 'total', 'value'], tenantCurrency)
  );

  const cost = processConcept('cost', (b) =>
    computeSumFromBatch(b, ['cost', 'cost_price', 'cogs', 'buy_price', 'purchase_price'], tenantCurrency)
  );

  const expense = processConcept('expense', (b) =>
    computeSumFromBatch(b, ['expense', 'amount', 'expense_amount', 'cost'], tenantCurrency)
  );

  const product = processConcept('product', (b) =>
    computeCountFromBatch(b, ['product_id', 'id', 'code', 'name'])
  );

  const customer = processConcept('customer', (b) =>
    computeCountFromBatch(b, ['customer_id', 'id', 'client_id', 'name'])
  );

  const collection = processConcept('collection', (b) =>
    computeSumFromBatch(b, ['collected_amount', 'receipt_amount', 'paid_amount', 'amount'], tenantCurrency)
  );

  const receivable = processConcept('receivable', (b) =>
    computeSumFromBatch(b, ['outstanding_balance', 'receivable_amount', 'balance'], tenantCurrency)
  );

  const inventory = processConcept('inventory', (b) =>
    computeSumFromBatch(b, ['stock_quantity', 'stock', 'available_quantity', 'quantity'], tenantCurrency)
  );

  const purchase = processConcept('purchase', (b) =>
    computeSumFromBatch(b, ['purchase_amount', 'po_total', 'amount', 'total'], tenantCurrency)
  );

  const cashflow = processConcept('cashflow', (b) =>
    computeSumFromBatch(b, ['net_cashflow', 'cash_inflow', 'amount'], tenantCurrency)
  );

  // 4. Derive Profit: revenue - cost (or sales - cost if revenue was not directly populated)
  const revenueForProfit = revenue.is_complete ? revenue : sales;
  const profit = computeProfit(revenueForProfit, cost);

  // 5. Derive Margin: profit / revenue
  const margin = computeMargin(profit, revenueForProfit);

  // Overall completeness: true only if essential core financial metrics are complete
  const is_complete =
    sales.is_complete &&
    cost.is_complete &&
    profit.is_complete;

  return {
    tenantId: config.tenantId,
    period: effectivePeriod,
    currency: tenantCurrency,
    is_complete,
    batchHashes,
    sales,
    revenue,
    product,
    customer,
    cost,
    expense,
    profit,
    collection,
    receivable,
    inventory,
    purchase,
    cashflow,
    margin,
  };
}
