/**
 * M4.5 — Diagnostic Query Analyzer
 * Bridges the Executive Advisor and the Diagnostic Audit Layer.
 * Principle: الحقيقة قبل الذكاء (Strict separation between User View and Developer Diagnostic Report)
 */

import { CompanyMetrics } from '../services/metricsEngine';
import { DataDiscoveryResult } from '../services/discoveryEngine';
import { queryCompanyAdvisor, AdvisorAnswer } from '../services/advisorEngine';
import { DiagnosticAnalysisSession } from './trace';
import { DeveloperDiagnosticReport, UserReliabilityStatus } from './types';
import { evidenceAuditor } from './evidence-auditor';

export interface DiagnosticAnalysisResult {
  userView: {
    question: string;
    summary: string;
    answerText: string;
    details?: string[];
    evidence: string[];
    reliabilityStatus: UserReliabilityStatus;
    isReliable: boolean;
    provenanceId?: string;
  };
  developerReport: DeveloperDiagnosticReport;
}

export function executeDiagnosticAnalysis(
  question: string,
  metrics: CompanyMetrics | null,
  discovery: DataDiscoveryResult | null,
  currency: string = 'ريال'
): DiagnosticAnalysisResult {
  const session = new DiagnosticAnalysisSession(question);
  const evaluator = session.getEvaluator();

  session.startStageTimer('data_loading_ms');
  // 1. Data Source Verification
  if (!metrics || !discovery) {
    session.recordDataSourceStatus('UNAVAILABLE', 'لم يتم ربط مصدر بيانات صالح');
    session.endStageTimer();

    session.recordStep('فشل توفر المصدر المالي', 'calculation', 'FAILED', 'لا توجد بيانات محملة');
    session.setAiStatus('BLOCKED', 'FALLBACK_EXPLANATION');

    const report = session.finalizeReport('تعذر إكمال التحليل');
    return {
      userView: {
        question,
        summary: 'البيانات بانتظار الربط.',
        answerText: 'لم يتم ربط بيانات الشركة بعد. يرجى ربط مصدر بيانات شركتك للبدء في التحليل دون أي تخمين.',
        evidence: ['مصدر البيانات غير متصل'],
        reliabilityStatus: 'تعذر إكمال التحليل',
        isReliable: false,
      },
      developerReport: report,
    };
  }

  session.recordDataSourceStatus('OK', `تم تحميل بيانات ${discovery.tablesFound.length} جداول`);
  session.endStageTimer();

  // 2. Data Quality & Capabilities Evaluation
  session.startStageTimer('data_quality_ms');
  const hasSales = metrics.totalSales !== null && metrics.totalSales > 0;
  const hasCost = discovery.capabilities.profitSupported && metrics.grossProfit !== null;
  const hasExpenses = discovery.capabilities.expensesSupported && metrics.totalExpenses !== null;

  session.recordDataQuality(
    hasSales ? 'PASS' : 'WARNING',
    hasSales ? 'سجلات المبيعات متوفرة وتفحص بنجاح' : 'سجلات المبيعات غير متوفرة أو بقيمة صفرية'
  );
  session.endStageTimer();

  // 3. Calculation & Dependency Evaluation
  session.startStageTimer('calculation_ms');
  session.recordStep('بدء احتساب سلاسل الاعتماد للمؤشرات', 'calculation', 'SUCCESS');

  // Register Revenue
  evaluator.registerMetricResult('revenue', {
    value: metrics.totalSales,
    isValid: hasSales,
    evidenceId: metrics.provenanceRecords.find((p) => p.metricKey === 'totalSales')?.provenanceId,
    failureReason: hasSales ? undefined : 'غياب سجلات المبيعات أو الإيرادات في المصدر',
  });

  // Register Costs (COGS)
  evaluator.registerMetricResult('costs', {
    value: hasCost ? (metrics.totalSales || 0) - (metrics.grossProfit || 0) : null,
    isValid: hasCost,
    evidenceId: metrics.provenanceRecords.find((p) => p.metricKey === 'cost')?.provenanceId,
    failureReason: hasCost ? undefined : 'غياب أعمدة التكلفة أو أسعار الشراء (Section 22 Rule)',
  });

  // Register Operating Expenses
  evaluator.registerMetricResult('operating_expenses', {
    value: metrics.totalExpenses,
    isValid: hasExpenses,
    evidenceId: metrics.provenanceRecords.find((p) => p.metricKey === 'totalExpenses')?.provenanceId,
    failureReason: hasExpenses ? undefined : 'غياب جدول المصروفات التشغيلية',
  });

  // Register Gross Profit (depends on revenue and costs)
  evaluator.registerMetricResult('gross_profit', {
    value: metrics.grossProfit,
    isValid: hasCost && hasSales,
    evidenceId: metrics.provenanceRecords.find((p) => p.metricKey === 'grossProfit')?.provenanceId,
    failureReason: !hasCost ? 'غياب بيانات التكلفة يمنع احتساب إجمالي الربح' : undefined,
  });

  // Register Gross Margin
  evaluator.registerMetricResult('gross_margin', {
    value: metrics.profitMarginPercent,
    isValid: hasCost && hasSales && metrics.profitMarginPercent !== null,
    evidenceId: metrics.provenanceRecords.find((p) => p.metricKey === 'profitMarginPercent')?.provenanceId,
  });

  // Register Net Profit (depends on gross_profit and operating_expenses)
  evaluator.registerMetricResult('net_profit', {
    value: metrics.netProfit,
    isValid: hasCost && hasSales && metrics.netProfit !== null,
    evidenceId: metrics.provenanceRecords.find((p) => p.metricKey === 'netProfit')?.provenanceId,
    failureReason: !hasCost ? 'حظر احتساب صافي الربح لغياب التكاليف' : undefined,
  });
  session.endStageTimer();

  // 4. Evidence Verification Stage
  session.startStageTimer('evidence_ms');
  const qLower = question.toLowerCase();
  let requestedMetric = 'general';

  if (qLower.includes('ربح') || qLower.includes('أرباح')) {
    requestedMetric = 'gross_profit';
  } else if (qLower.includes('مبيعات') || qLower.includes('إيراد')) {
    requestedMetric = 'revenue';
  } else if (qLower.includes('تكاليف') || qLower.includes('مصروف')) {
    requestedMetric = 'operating_expenses';
  } else if (qLower.includes('مخزون')) {
    requestedMetric = 'inventory';
  }

  const isAllowed = requestedMetric === 'general' ? true : evaluator.isMetricAllowed(requestedMetric);
  const normalizedReq = requestedMetric.toLowerCase().replace(/_/g, '');
  const provRecord = metrics.provenanceRecords.find((p) => {
    const k = p.metricKey.toLowerCase().replace(/_/g, '');
    return k === normalizedReq || k.includes(normalizedReq) || normalizedReq.includes(k);
  });
  const provId = provRecord?.provenanceId;

  if (provId) {
    session.addEvidence(provId);
  }

  const evidenceCheck = evidenceAuditor.evaluateEvidence(
    provId,
    metrics.provenanceRecords.map((p) => `${p.metricLabel}: ${p.metricKey}`),
    true
  );
  session.endStageTimer();

  // 5. AI / Advisor Explanation Stage (AI IS STRICTLY FOR EXPLANATION, NOT CALCULATION)
  session.startStageTimer('ai_generation_ms');
  let advisorAns: AdvisorAnswer;

  if (!isAllowed) {
    session.setAiStatus('BLOCKED', 'FALLBACK_EXPLANATION');
    const firstFail = evaluator.getFirstFailure();
    const reason = evaluator.getRootCause() || 'بيانات ناقصة';

    advisorAns = {
      summary: `تعذر احتساب ${requestedMetric === 'gross_profit' ? 'الأرباح' : 'المؤشر'} لغياب الاعتماد المسبق (${firstFail}).`,
      answerText: `لا يمكن حساب النتيجة بدقة لعدم توفر بيانات كافية في السجلات المربوطة (${reason}). يلتزم المستشار بمبدأ «الحقيقة قبل الذكاء» ويمتنع عن تخمين الأرقام.`,
      evidence: [`الاعتماد المسبق [${firstFail}] غير متوفر في المصدر`],
      isSupported: false,
      category: 'profit',
    };
  } else {
    session.setAiStatus('EXPLANATION_ONLY', 'DELIVERED');
    advisorAns = queryCompanyAdvisor(question, metrics, discovery, currency);
    if (advisorAns.provenanceId) {
      session.addEvidence(advisorAns.provenanceId);
    }
  }
  session.endStageTimer();

  const finalProvId = provId || advisorAns.provenanceId;
  if (finalProvId && !provId) {
    session.addEvidence(finalProvId);
  }

  // 6. Record in Audit Trail
  evidenceAuditor.recordAudit({
    who: 'executive_user',
    what: `استعلام تحليلي: ${question}`,
    when: new Date().toISOString(),
    why: 'تدقيق المؤشرات المالية والتشغيلية',
    result: advisorAns.summary,
    evidenceId: finalProvId || 'EV-PROV-SYS',
    evidenceStatus: isAllowed && finalProvId ? 'VERIFIED' : isAllowed ? evidenceCheck.status : 'BLOCKED',
  });

  // 7. Resolve User Reliability Status
  let reliabilityStatus: UserReliabilityStatus = 'موثوق';
  if (!isAllowed) {
    reliabilityStatus = 'لا يمكن التحقق';
  } else if (!advisorAns.isSupported) {
    reliabilityStatus = 'بيانات ناقصة';
  } else if (evidenceCheck.status === 'PARTIAL' && !finalProvId) {
    reliabilityStatus = 'تحتاج مراجعة';
  }

  const report = session.finalizeReport(reliabilityStatus);

  return {
    userView: {
      question,
      summary: advisorAns.summary,
      answerText: advisorAns.answerText,
      details: advisorAns.details,
      evidence: advisorAns.evidence,
      reliabilityStatus,
      isReliable: isAllowed && advisorAns.isSupported,
      provenanceId: advisorAns.provenanceId,
    },
    developerReport: report,
  };
}
