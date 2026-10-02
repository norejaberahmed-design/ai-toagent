import {
  BusinessConcept,
  DataBatch,
  ProvenancedValue,
  SafeTransform,
  Provenance,
} from '../connectors/types';
import { createMissingProvenancedValue, ExtendedProvenance } from '../model/unified';
import { deterministicContentHash } from './hash';

export interface MetricDefinition {
  concept: BusinessConcept | 'margin';
  formula: string;
  requiredInputs: string[];
  unit: string;
  currencyBehavior: 'MATCH_TENANT' | 'NOT_APPLICABLE';
  periodBehavior: 'STRICT_PERIOD_MATCH';
  missingDataBehavior: 'RETURN_NULL_INCOMPLETE';
  description: string;
}

/**
 * Metric Definitions Contract
 * Strict and immutable specification for all 12 concepts + derived margin.
 */
export const METRIC_DEFINITIONS: Record<BusinessConcept | 'margin', MetricDefinition> = {
  sales: {
    concept: 'sales',
    formula: 'SUM(rows.value)',
    requiredInputs: ['amount | value | total_amount'],
    unit: 'currency',
    currencyBehavior: 'MATCH_TENANT',
    periodBehavior: 'STRICT_PERIOD_MATCH',
    missingDataBehavior: 'RETURN_NULL_INCOMPLETE',
    description: 'إجمالي قيمة المبيعات المعتمدة من الفواتير أو أوامر البيع الفعلية.',
  },
  revenue: {
    concept: 'revenue',
    formula: 'SUM(rows.value)',
    requiredInputs: ['amount | revenue | total'],
    unit: 'currency',
    currencyBehavior: 'MATCH_TENANT',
    periodBehavior: 'STRICT_PERIOD_MATCH',
    missingDataBehavior: 'RETURN_NULL_INCOMPLETE',
    description: 'إجمالي الإيرادات المتحققة في الفترة المحددة.',
  },
  cost: {
    concept: 'cost',
    formula: 'SUM(rows.value)',
    requiredInputs: ['cost_price | cost | cogs'],
    unit: 'currency',
    currencyBehavior: 'MATCH_TENANT',
    periodBehavior: 'STRICT_PERIOD_MATCH',
    missingDataBehavior: 'RETURN_NULL_INCOMPLETE',
    description: 'إجمالي تكلفة البضاعة المباعة أو تكلفة الخدمات.',
  },
  expense: {
    concept: 'expense',
    formula: 'SUM(rows.value)',
    requiredInputs: ['amount | expense_amount'],
    unit: 'currency',
    currencyBehavior: 'MATCH_TENANT',
    periodBehavior: 'STRICT_PERIOD_MATCH',
    missingDataBehavior: 'RETURN_NULL_INCOMPLETE',
    description: 'المصروفات التشغيلية والنفقات العامة المقيدة بدفاتر الشركة.',
  },
  profit: {
    concept: 'profit',
    formula: 'revenue - cost',
    requiredInputs: ['revenue', 'cost'],
    unit: 'currency',
    currencyBehavior: 'MATCH_TENANT',
    periodBehavior: 'STRICT_PERIOD_MATCH',
    missingDataBehavior: 'RETURN_NULL_INCOMPLETE',
    description: 'إجمالي الربح المحسوب حصرياً من الإيراد الفعلي ناقص التكلفة الفعلية.',
  },
  margin: {
    concept: 'margin',
    formula: 'profit / revenue',
    requiredInputs: ['profit', 'revenue'],
    unit: 'ratio',
    currencyBehavior: 'NOT_APPLICABLE',
    periodBehavior: 'STRICT_PERIOD_MATCH',
    missingDataBehavior: 'RETURN_NULL_INCOMPLETE',
    description: 'هامش الربح كنسبة مئوية، يشترط أن تكون الإيرادات موجبة وأكبر من صفر.',
  },
  product: {
    concept: 'product',
    formula: 'COUNT(distinct products)',
    requiredInputs: ['product_id | id | name'],
    unit: 'count',
    currencyBehavior: 'NOT_APPLICABLE',
    periodBehavior: 'STRICT_PERIOD_MATCH',
    missingDataBehavior: 'RETURN_NULL_INCOMPLETE',
    description: 'عدد المنتجات أو الخدمات النشطة المسجلة فعلياً في المصدر.',
  },
  customer: {
    concept: 'customer',
    formula: 'COUNT(distinct customers)',
    requiredInputs: ['customer_id | id | name'],
    unit: 'count',
    currencyBehavior: 'NOT_APPLICABLE',
    periodBehavior: 'STRICT_PERIOD_MATCH',
    missingDataBehavior: 'RETURN_NULL_INCOMPLETE',
    description: 'عدد العملاء الفعليين المسجلين في المصدر.',
  },
  collection: {
    concept: 'collection',
    formula: 'SUM(rows.collected_amount)',
    requiredInputs: ['collected_amount | receipt_amount'],
    unit: 'currency',
    currencyBehavior: 'MATCH_TENANT',
    periodBehavior: 'STRICT_PERIOD_MATCH',
    missingDataBehavior: 'RETURN_NULL_INCOMPLETE',
    description: 'التحصيلات النقدية والبنكية المسجلة فقط (لا يتم افتراض sales - receivables).',
  },
  receivable: {
    concept: 'receivable',
    formula: 'SUM(rows.outstanding_balance)',
    requiredInputs: ['balance | outstanding | receivable'],
    unit: 'currency',
    currencyBehavior: 'MATCH_TENANT',
    periodBehavior: 'STRICT_PERIOD_MATCH',
    missingDataBehavior: 'RETURN_NULL_INCOMPLETE',
    description: 'الذمم المدينة المستحقة فعلياً في دفاتر الشركة.',
  },
  inventory: {
    concept: 'inventory',
    formula: 'SUM(rows.stock_quantity | stock_value)',
    requiredInputs: ['stock | quantity | inventory_value'],
    unit: 'units',
    currencyBehavior: 'NOT_APPLICABLE',
    periodBehavior: 'STRICT_PERIOD_MATCH',
    missingDataBehavior: 'RETURN_NULL_INCOMPLETE',
    description: 'أرصدة المخزون الفعلية المتاحة (لا يتم تحويل الغياب إلى صفر).',
  },
  purchase: {
    concept: 'purchase',
    formula: 'SUM(rows.purchase_amount)',
    requiredInputs: ['purchase_amount | po_total'],
    unit: 'currency',
    currencyBehavior: 'MATCH_TENANT',
    periodBehavior: 'STRICT_PERIOD_MATCH',
    missingDataBehavior: 'RETURN_NULL_INCOMPLETE',
    description: 'أوامر ومشتريات الشركة المعتمدة.',
  },
  cashflow: {
    concept: 'cashflow',
    formula: 'SUM(rows.net_cashflow)',
    requiredInputs: ['cashflow | net_cash'],
    unit: 'currency',
    currencyBehavior: 'MATCH_TENANT',
    periodBehavior: 'STRICT_PERIOD_MATCH',
    missingDataBehavior: 'RETURN_NULL_INCOMPLETE',
    description: 'التدفقات النقدية المسجلة فقط (لا يتم افتراض collections - expenses).',
  },
};

/**
 * Extracts a numeric value from a row using standard column candidates.
 */
function extractRowNumber(row: Record<string, unknown>, candidates: string[]): number | null {
  for (const c of candidates) {
    if (c in row && row[c] !== null && row[c] !== undefined && row[c] !== '') {
      const parsed = Number(row[c]);
      if (!isNaN(parsed) && isFinite(parsed)) {
        return parsed;
      }
    }
  }

  // Fallback to checking keys in case of case-insensitivity
  const lowerRow: Record<string, unknown> = {};
  for (const k of Object.keys(row)) {
    lowerRow[k.toLowerCase()] = row[k];
  }

  for (const c of candidates) {
    const cl = c.toLowerCase();
    if (cl in lowerRow && lowerRow[cl] !== null && lowerRow[cl] !== undefined && lowerRow[cl] !== '') {
      const parsed = Number(lowerRow[cl]);
      if (!isNaN(parsed) && isFinite(parsed)) {
        return parsed;
      }
    }
  }

  return null;
}

/**
 * Computes a SUM metric purely and deterministically from a DataBatch.
 * Enforces:
 * - Empty batch -> value: null, is_complete: false.
 * - Missing rows -> value: null, is_complete: false.
 * - Records SUM in transformation_chain.
 */
export function computeSumFromBatch(
  batch: DataBatch,
  candidates: string[],
  currency: string
): ProvenancedValue<number> {
  if (!batch.rows || batch.rows.length === 0) {
    return createMissingProvenancedValue(
      batch.concept,
      `لا توجد سجلات بيانات كافية لحساب مفهوم ${batch.concept}`,
      batch.period,
      currency
    );
  }

  let total = 0;
  let validCount = 0;

  for (const row of batch.rows) {
    const val = extractRowNumber(row, candidates);
    if (val !== null) {
      total += val;
      validCount++;
    }
  }

  if (validCount === 0) {
    return createMissingProvenancedValue(
      batch.concept,
      `السجلات الموجودة لا تحتوي على قيم رقمية صالحة لحساب ${batch.concept}`,
      batch.period,
      currency
    );
  }

  const batchHash = deterministicContentHash(batch.rows);
  const chain: SafeTransform[] = ['SUM'];

  const prov: ExtendedProvenance = {
    source_id: batch.provenance.source_id,
    connector_id: batch.provenance.connector_id,
    source_ref: batch.provenance.source_ref,
    query_hash: batchHash,
    fetched_at: batch.provenance.fetched_at,
    transformation_chain: chain,
    confidence: batch.provenance.confidence,
    is_complete: true,
  };

  return {
    value: total,
    unit: 'currency',
    currency,
    period: batch.period,
    provenance: prov as Provenance,
    is_complete: true,
  };
}

/**
 * Computes a COUNT metric purely and deterministically from a DataBatch.
 */
export function computeCountFromBatch(
  batch: DataBatch,
  idCandidates: string[]
): ProvenancedValue<number> {
  if (!batch.rows || batch.rows.length === 0) {
    return createMissingProvenancedValue(
      batch.concept,
      `لا توجد سجلات مسجلة لحساب ${batch.concept}`,
      batch.period
    );
  }

  const uniqueSet = new Set<string>();
  for (const row of batch.rows) {
    let identified = false;
    for (const c of idCandidates) {
      if (row[c] !== undefined && row[c] !== null && String(row[c]).trim() !== '') {
        uniqueSet.add(String(row[c]).trim());
        identified = true;
        break;
      }
    }
    if (!identified) {
      uniqueSet.add(deterministicContentHash(row));
    }
  }

  const count = uniqueSet.size;
  const batchHash = deterministicContentHash(batch.rows);
  const chain: SafeTransform[] = ['COUNT'];

  const prov: ExtendedProvenance = {
    source_id: batch.provenance.source_id,
    connector_id: batch.provenance.connector_id,
    source_ref: batch.provenance.source_ref,
    query_hash: batchHash,
    fetched_at: batch.provenance.fetched_at,
    transformation_chain: chain,
    confidence: batch.provenance.confidence,
    is_complete: true,
  };

  return {
    value: count,
    unit: 'count',
    currency: null,
    period: batch.period,
    provenance: prov as Provenance,
    is_complete: true,
  };
}

/**
 * Computes PROFIT: revenue - cost
 * Strictly requires both revenue and cost to be non-null and complete!
 * If either is null: profit = null, is_complete = false.
 * Records ["revenue", "cost", "SUBTRACT"] in transformation_chain.
 */
export function computeProfit(
  revenue: ProvenancedValue<number>,
  cost: ProvenancedValue<number>
): ProvenancedValue<number> {
  if (
    revenue.value === null ||
    cost.value === null ||
    !revenue.is_complete ||
    !cost.is_complete ||
    !revenue.provenance ||
    !cost.provenance
  ) {
    return createMissingProvenancedValue(
      'profit',
      'لا يمكن حساب الربح لعدم توفر بيانات الإيرادات أو التكاليف بشكل مكتمل.',
      revenue.period || cost.period,
      revenue.currency || cost.currency
    );
  }

  // Currency mismatch check
  if (revenue.currency && cost.currency && revenue.currency !== cost.currency) {
    const empty = createMissingProvenancedValue(
      'profit',
      `CURRENCY_MISMATCH: تعارض بين عملة الإيراد (${revenue.currency}) وعملة التكلفة (${cost.currency})`,
      revenue.period,
      revenue.currency
    );
    (empty.provenance as ExtendedProvenance).status = 'PARTIAL_DATA';
    return empty;
  }

  const profitValue = revenue.value - cost.value;
  const combinedHash = deterministicContentHash({
    revHash: revenue.provenance.query_hash,
    costHash: cost.provenance.query_hash,
    val: profitValue,
  });

  // Transformation chain: ["revenue", "cost", "SUBTRACT"]
  const chain = ['revenue', 'cost', 'SUBTRACT'] as unknown as SafeTransform[];

  const prov: ExtendedProvenance = {
    source_id: `${revenue.provenance.source_id}+${cost.provenance.source_id}`,
    connector_id: `${revenue.provenance.connector_id}+${cost.provenance.connector_id}`,
    source_ref: 'derived: revenue - cost',
    query_hash: combinedHash,
    fetched_at: revenue.provenance.fetched_at,
    transformation_chain: chain,
    confidence: Math.min(revenue.provenance.confidence, cost.provenance.confidence),
    is_complete: true,
  };

  return {
    value: profitValue,
    unit: 'currency',
    currency: revenue.currency,
    period: revenue.period,
    provenance: prov as Provenance,
    is_complete: true,
  };
}

/**
 * Computes MARGIN: profit / revenue
 * Strictly requires profit and revenue non-null, and revenue > 0.
 * Records ["profit", "revenue", "DIVIDE"] in transformation_chain.
 */
export function computeMargin(
  profit: ProvenancedValue<number>,
  revenue: ProvenancedValue<number>
): ProvenancedValue<number> {
  if (
    profit.value === null ||
    revenue.value === null ||
    !profit.is_complete ||
    !revenue.is_complete ||
    !profit.provenance ||
    !revenue.provenance ||
    revenue.value <= 0
  ) {
    return createMissingProvenancedValue(
      'margin',
      'لا يمكن حساب هامش الربح لعدم توفر الربح أو لأن الإيرادات صفرية أو غير متاحة.',
      profit.period || revenue.period
    );
  }

  const marginRatio = profit.value / revenue.value;
  const combinedHash = deterministicContentHash({
    profitHash: profit.provenance.query_hash,
    revHash: revenue.provenance.query_hash,
    margin: marginRatio,
  });

  // Transformation chain: ["profit", "revenue", "DIVIDE"]
  const chain = ['profit', 'revenue', 'DIVIDE'] as unknown as SafeTransform[];

  const prov: ExtendedProvenance = {
    source_id: profit.provenance.source_id,
    connector_id: profit.provenance.connector_id,
    source_ref: 'derived: profit / revenue',
    query_hash: combinedHash,
    fetched_at: profit.provenance.fetched_at,
    transformation_chain: chain,
    confidence: Math.min(profit.provenance.confidence, revenue.provenance.confidence),
    is_complete: true,
  };

  return {
    value: marginRatio,
    unit: 'ratio',
    currency: null,
    period: profit.period,
    provenance: prov as Provenance,
    is_complete: true,
  };
}
