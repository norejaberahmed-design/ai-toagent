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
 * Detector 6 — CASHFLOW_RISK
 * Evaluates liquidity and cashflow risks:
 * 1. cashflow < 0 -> CRITICAL
 * 2. receivables > 2 * monthly_revenue -> WARNING
 * 3. collections < 0.5 * revenue -> WARNING
 * If value missing -> NO SIGNAL (never extrapolate cashflow from revenue alone).
 */
export function detectCashflowRisks(
  snapshots: readonly UnifiedBusinessSnapshot[],
  config: DiscoveryConfig,
  thresholds: Thresholds
): Signal[] {
  if (snapshots.length === 0) {
    return [];
  }

  const latestSnap = snapshots[snapshots.length - 1];
  const signals: Signal[] = [];

  // Rule 1: cashflow < 0
  const cf = latestSnap.cashflow;
  if (cf && cf.value !== null) {
    if (cf.value < 0 && thresholds.cashflow_negative_critical) {
      const evidence = [cf as DiscoveryValue<number>];
      const detectedAt = extractLatestDetectedAt(evidence);
      if (detectedAt) {
        let explanation_ar = `عجز نقدي تشغيلي سالب بقيمة ${cf.value} ${cf.currency || ''}. التدفق النقدي غير كافٍ لتغطية الالتزامات التشغيلية.`;
        let severity = Severity.CRITICAL;
        if (!cf.is_complete) {
          severity = Severity.INFO;
          explanation_ar += ' (ملاحظة: البيانات غير مكتملة).';
        }

        signals.push({
          id: computeSignalId(SignalType.CASHFLOW_RISK, evidence, detectedAt),
          type: SignalType.CASHFLOW_RISK,
          severity,
          title_ar: 'عجز في التدفق النقدي التشغيلي',
          explanation_ar,
          evidence,
          related_concepts: ['cashflow'],
          detected_at: detectedAt,
          run_id: '',
        });
      }
    }
  }

  // Rule 2: receivables > 2 * revenue
  const rec = latestSnap.receivable;
  const rev = latestSnap.revenue || latestSnap.sales;
  if (rec && rec.value !== null && rev && rev.value !== null && rev.value > 0) {
    if (rec.value > 2 * rev.value) {
      const evidence = [rec as DiscoveryValue<number>, rev as DiscoveryValue<number>];
      const currCheck = validateCurrencyConsistency(evidence);
      if (currCheck.valid) {
        const detectedAt = extractLatestDetectedAt(evidence);
        if (detectedAt) {
          const ratio = Math.round((rec.value / rev.value) * 100) / 100;
          let severity = Severity.WARNING;
          let explanation_ar = `تضخم في الذمم المدينة (${rec.value} ${rec.currency || ''}) تتجاوز ضعف إيرادات الفترة (${rev.value} ${rev.currency || ''}) بنسبة ${ratio}x.`;
          if (!rec.is_complete || !rev.is_complete) {
            severity = Severity.INFO;
            explanation_ar += ' (ملاحظة: البيانات غير مكتملة).';
          }

          signals.push({
            id: computeSignalId(SignalType.CASHFLOW_RISK, evidence, detectedAt),
            type: SignalType.CASHFLOW_RISK,
            severity,
            title_ar: 'مخاطر سيولة ناتجة عن تضخم الذمم المدينة',
            explanation_ar,
            evidence,
            related_concepts: ['receivable', 'revenue', 'cashflow'],
            detected_at: detectedAt,
            run_id: '',
          });
        }
      }
    }
  }

  // Rule 3: collections < 0.5 * revenue
  const col = latestSnap.collection;
  if (col && col.value !== null && rev && rev.value !== null && rev.value > 0) {
    if (col.value < 0.5 * rev.value) {
      const evidence = [col as DiscoveryValue<number>, rev as DiscoveryValue<number>];
      const currCheck = validateCurrencyConsistency(evidence);
      if (currCheck.valid) {
        const detectedAt = extractLatestDetectedAt(evidence);
        if (detectedAt) {
          const pct = Math.round((col.value / rev.value) * 100);
          let severity = Severity.WARNING;
          let explanation_ar = `تدني معدل التحصيل النقدي الفعلي (${col.value} ${col.currency || ''}) إلى ${pct}% فقط من إيرادات الفترة.`;
          if (!col.is_complete || !rev.is_complete) {
            severity = Severity.INFO;
            explanation_ar += ' (ملاحظة: البيانات غير مكتملة).';
          }

          signals.push({
            id: computeSignalId(SignalType.CASHFLOW_RISK, evidence, detectedAt),
            type: SignalType.CASHFLOW_RISK,
            severity,
            title_ar: 'ضعف التحصيل النقدي التشغيلي',
            explanation_ar,
            evidence,
            related_concepts: ['collection', 'revenue', 'cashflow'],
            detected_at: detectedAt,
            run_id: '',
          });
        }
      }
    }
  }

  return signals;
}
