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
 * Detector 9 — OPPORTUNITY
 * Generates objective data-backed opportunity signals without managerial hallucinations.
 * Rule: Never say "Must expand" or "Must lower price".
 * State: "High margin with stable sales — room to review growth opportunity."
 */
export function detectOpportunities(
  snapshots: readonly UnifiedBusinessSnapshot[],
  config: DiscoveryConfig,
  thresholds: Thresholds
): Signal[] {
  if (snapshots.length === 0) {
    return [];
  }

  const latestSnap = snapshots[snapshots.length - 1];
  const signals: Signal[] = [];

  // Case 1: High Margin (> 0.30) with stable/positive sales
  const margin = latestSnap.margin;
  const sales = latestSnap.sales || latestSnap.revenue;

  if (margin && margin.value !== null && sales && sales.value !== null && sales.value > 0) {
    if (margin.value > 0.30) {
      const evidence = [margin as DiscoveryValue<number>, sales as DiscoveryValue<number>];
      const currCheck = validateCurrencyConsistency(evidence);
      if (currCheck.valid) {
        const detectedAt = extractLatestDetectedAt(evidence);
        if (detectedAt) {
          const marginPct = Math.round(margin.value * 100);
          let severity = Severity.OPPORTUNITY;
          let explanation_ar = `هامش مرتفع (${marginPct}%) مع مبيعات بلغت (${sales.value} ${sales.currency || ''}) — توجد مساحة لمراجعة فرصة النمو.`;

          if (!margin.is_complete || !sales.is_complete) {
            severity = Severity.INFO;
            explanation_ar += ' (ملاحظة: البيانات غير مكتملة).';
          }

          signals.push({
            id: computeSignalId(SignalType.OPPORTUNITY, evidence, detectedAt),
            type: SignalType.OPPORTUNITY,
            severity,
            title_ar: 'فرصة مراجعة نمو وهوامش ربحية جيدة',
            explanation_ar,
            evidence,
            related_concepts: ['profit', 'sales'],
            detected_at: detectedAt,
            run_id: '',
          });
        }
      }
    }
  }

  // Case 2: High Sales + High Inventory
  const inv = latestSnap.inventory;
  if (sales && sales.value !== null && inv && inv.value !== null && sales.value > 0 && inv.value > 0) {
    if (inv.value >= 0.8 * sales.value) {
      const evidence = [sales as DiscoveryValue<number>, inv as DiscoveryValue<number>];
      const currCheck = validateCurrencyConsistency(evidence);
      if (currCheck.valid) {
        const detectedAt = extractLatestDetectedAt(evidence);
        if (detectedAt) {
          let severity = Severity.OPPORTUNITY;
          let explanation_ar = `مبيعات مرتفعة (${sales.value} ${sales.currency || ''}) مع مخزون مرتفع (${inv.value} ${inv.currency || ''}) — تستحق سياسة التسعير والمخزون مراجعة.`;

          if (!sales.is_complete || !inv.is_complete) {
            severity = Severity.INFO;
            explanation_ar += ' (ملاحظة: البيانات غير مكتملة).';
          }

          signals.push({
            id: computeSignalId(SignalType.OPPORTUNITY, evidence, detectedAt),
            type: SignalType.OPPORTUNITY,
            severity,
            title_ar: 'تزامن مبيعات ومخزون مرتفعين يستحق المراجعة',
            explanation_ar,
            evidence,
            related_concepts: ['sales', 'inventory'],
            detected_at: detectedAt,
            run_id: '',
          });
        }
      }
    }
  }

  // Case 3: Strong Cashflow Surplus (cashflow > 2 * expense)
  const cf = latestSnap.cashflow;
  const exp = latestSnap.expense || latestSnap.cost;
  if (cf && cf.value !== null && exp && exp.value !== null && exp.value > 0 && cf.value > 0) {
    if (cf.value > 2 * exp.value) {
      const evidence = [cf as DiscoveryValue<number>, exp as DiscoveryValue<number>];
      const currCheck = validateCurrencyConsistency(evidence);
      if (currCheck.valid) {
        const detectedAt = extractLatestDetectedAt(evidence);
        if (detectedAt) {
          let severity = Severity.OPPORTUNITY;
          let explanation_ar = `فائض سيولة نقدية تشغيلية يبلغ ${cf.value} ${cf.currency || ''}، يغطي المصروفات (${exp.value} ${exp.currency || ''}) بأكثر من الضعف.`;

          if (!cf.is_complete || !exp.is_complete) {
            severity = Severity.INFO;
            explanation_ar += ' (ملاحظة: البيانات غير مكتملة).';
          }

          signals.push({
            id: computeSignalId(SignalType.OPPORTUNITY, evidence, detectedAt),
            type: SignalType.OPPORTUNITY,
            severity,
            title_ar: 'فائض سيولة نقدية تشغيلية متاح للاستثمار',
            explanation_ar,
            evidence,
            related_concepts: ['cashflow', 'expense'],
            detected_at: detectedAt,
            run_id: '',
          });
        }
      }
    }
  }

  return signals;
}
