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
 * Pure helper to compute overlap ratio between top selling and top stocked items
 */
export function computeProductOverlap(
  topSellers: readonly string[],
  topStocked: readonly string[]
): number {
  if (topSellers.length === 0 || topStocked.length === 0) return 0;
  const stockSet = new Set(topStocked.map((s) => s.trim().toLowerCase()));
  let matchCount = 0;
  for (const seller of topSellers) {
    if (stockSet.has(seller.trim().toLowerCase())) {
      matchCount++;
    }
  }
  return Math.round((matchCount / topSellers.length) * 100) / 100;
}

/**
 * Detector 7 — INVENTORY_MISMATCH
 * Requires product-level breakdown data.
 * Compares top selling products with top stocked products.
 * If overlap < 0.30 -> WARNING.
 * Never claim inventory is low/high unless quantities/values are established.
 */
export function detectInventoryMismatches(
  snapshots: readonly UnifiedBusinessSnapshot[],
  config: DiscoveryConfig,
  thresholds: Thresholds
): Signal[] {
  if (snapshots.length === 0) {
    return [];
  }

  const breakdowns = config.breakdowns;
  if (!breakdowns || !breakdowns.products || !breakdowns.inventoryStock) {
    return [];
  }

  const topSellers = [...breakdowns.products]
    .sort((a, b) => b.share - a.share)
    .slice(0, 10)
    .map((p) => p.name);

  const topStocked = [...breakdowns.inventoryStock]
    .sort((a, b) => b.share - a.share)
    .slice(0, 10)
    .map((p) => p.name);

  if (topSellers.length === 0 || topStocked.length === 0) {
    return [];
  }

  const overlap = computeProductOverlap(topSellers, topStocked);
  if (overlap >= 0.30) {
    return [];
  }

  const latestSnap = snapshots[snapshots.length - 1];
  const inv = latestSnap.inventory;
  const sales = latestSnap.sales;

  if (!inv || inv.value === null || !sales || sales.value === null) {
    return [];
  }

  const evidence = [inv as DiscoveryValue<number>, sales as DiscoveryValue<number>];
  const currCheck = validateCurrencyConsistency(evidence);
  if (!currCheck.valid) {
    return [];
  }

  const detectedAt = extractLatestDetectedAt(evidence);
  if (!detectedAt) {
    return [];
  }

  let severity = Severity.WARNING;
  let explanation_ar = `عدم تطابق في تشكيلة المخزون: نسبة التداخل بين أكثر المنتجات مبيعاً وأكثرها تخزيناً تبلغ ${Math.round(overlap * 100)}% فقط (أقل من الحد الأدنى 30%). المخزون لا يواكب حركة الطلب الفعلية.`;

  if (!inv.is_complete || !sales.is_complete) {
    severity = Severity.INFO;
    explanation_ar += ' (ملاحظة: البيانات غير مكتملة).';
  }

  const id = computeSignalId(SignalType.INVENTORY_MISMATCH, evidence, detectedAt);

  return [
    {
      id,
      type: SignalType.INVENTORY_MISMATCH,
      severity,
      title_ar: 'عدم تطابق بين تشكيلة المخزون والمبيعات',
      explanation_ar,
      evidence,
      related_concepts: ['inventory', 'sales', 'product'],
      detected_at: detectedAt,
      run_id: '',
    },
  ];
}
