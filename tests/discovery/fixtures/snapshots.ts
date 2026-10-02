/**
 * NOT_PRODUCTION_DATA
 * TEST_ONLY
 *
 * Mathematical test fixtures specifically designed for validating P3.1 Deterministic Discovery Engine.
 * Strictly prohibited from use in production code or runtime application logic.
 */

import { Provenance, ProvenancedValue } from '../../../src/connectors/types';
import { UnifiedBusinessSnapshot } from '../../../src/model/unified';

export function createTestProvenancedValue(
  value: number | null,
  options: {
    fetched_at?: string;
    currency?: string;
    is_complete?: boolean;
    query_hash?: string;
    source_id?: string;
  } = {}
): ProvenancedValue<number> {
  const {
    fetched_at = '2024-03-31T23:59:59Z',
    currency = 'SAR',
    is_complete = true,
    query_hash = 'hash_fixture_001',
    source_id = 'src_test_only',
  } = options;

  const provenance: Provenance = {
    source_id,
    connector_id: 'test_connector',
    source_ref: 'test_table.test_col',
    query_hash,
    fetched_at,
    transformation_chain: ['SUM'],
    confidence: 0.95,
    is_complete,
  };

  return {
    value,
    unit: 'SAR',
    currency,
    period: { from: '2024-01-01', to: '2024-03-31', tz: 'UTC' },
    provenance,
    is_complete,
  };
}

export function createTestSnapshot(params: {
  tenantId?: string;
  from: string;
  to: string;
  currency?: string;
  is_complete?: boolean;
  sales?: number | null;
  revenue?: number | null;
  product?: number | null;
  customer?: number | null;
  cost?: number | null;
  expense?: number | null;
  profit?: number | null;
  collection?: number | null;
  receivable?: number | null;
  inventory?: number | null;
  purchase?: number | null;
  cashflow?: number | null;
  margin?: number | null;
  fetched_at?: string;
}): UnifiedBusinessSnapshot {
  const currency = params.currency ?? 'SAR';
  const is_complete = params.is_complete ?? true;
  const fetched_at = params.fetched_at ?? `${params.to}T23:59:59Z`;

  const makeVal = (v: number | null | undefined, hashSuffix: string) => {
    return createTestProvenancedValue(v === undefined ? null : v, {
      currency,
      is_complete,
      fetched_at,
      query_hash: `qhash_${hashSuffix}`,
    });
  };

  return {
    tenantId: params.tenantId ?? 'tenant_test_01',
    period: { from: params.from, to: params.to, tz: 'UTC' },
    currency,
    is_complete,
    batchHashes: [`batch_${params.from}_${params.to}`],
    sales: makeVal(params.sales, 'sales'),
    revenue: makeVal(params.revenue, 'revenue'),
    product: makeVal(params.product, 'product'),
    customer: makeVal(params.customer, 'customer'),
    cost: makeVal(params.cost, 'cost'),
    expense: makeVal(params.expense, 'expense'),
    profit: makeVal(params.profit, 'profit'),
    collection: makeVal(params.collection, 'collection'),
    receivable: makeVal(params.receivable, 'receivable'),
    inventory: makeVal(params.inventory, 'inventory'),
    purchase: makeVal(params.purchase, 'purchase'),
    cashflow: makeVal(params.cashflow, 'cashflow'),
    margin: makeVal(params.margin, 'margin'),
  };
}
