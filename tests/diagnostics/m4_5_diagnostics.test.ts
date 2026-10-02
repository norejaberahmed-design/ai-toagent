import { diagnosticLogger } from '../../src/diagnostics/logger';
import { sanitizeMessage, sanitizeMetadata } from '../../src/diagnostics/sanitizer';
import { DependencyGraphEvaluator } from '../../src/diagnostics/dependencies';
import { DiagnosticAnalysisSession } from '../../src/diagnostics/trace';
import { evidenceAuditor } from '../../src/diagnostics/evidence-auditor';
import { executeDiagnosticAnalysis } from '../../src/diagnostics/analyzer';
import { generateSystemHealthReport } from '../../src/diagnostics/system-health';
import { CompanyMetrics } from '../../src/services/metricsEngine';
import { DataDiscoveryResult } from '../../src/services/discoveryEngine';

console.log('=============================================================');
console.log('--- STARTING M4.5 DIAGNOSTIC LOGGING & SYSTEM AUDIT TESTS ---');
console.log('=============================================================');

async function runM45Tests() {
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, message: string) {
    if (condition) {
      console.log(`  ✓ [PASS] ${message}`);
      passed++;
    } else {
      console.error(`  ✗ [FAIL] ${message}`);
      failed++;
      throw new Error(`Assertion failed: ${message}`);
    }
  }

  // Sample verified metrics fixtures
  const verifiedMetrics: CompanyMetrics = {
    totalSales: 50000,
    transactionCount: 200,
    averageTransaction: 250,
    totalExpenses: 12000,
    grossProfit: 20000,
    netProfit: 8000,
    profitMarginPercent: 40.0,
    profitStatusMessage: 'تم التحقق من الأرباح وفق التكاليف المسجلة.',
    topProducts: [{ id: 1, name: 'طابعة ليزر', soldQuantity: 30, totalRevenue: 15000 }],
    slowMovingProducts: [],
    topCustomers: [{ id: 1, name: 'مؤسسة الرياض', orderCount: 20, totalSpent: 12000 }],
    paymentMethods: [{ method: 'مدى', count: 150, totalAmount: 40000, percentage: 80 }],
    inventoryItems: [{ id: 1, name: 'طابعة ليزر', stock: 15, status: 'normal' }],
    provenanceRecords: [
      {
        metricKey: 'totalSales',
        metricLabel: 'إجمالي المبيعات',
        sourceTable: 'orders',
        sqlQuery: 'SELECT SUM(total) FROM orders',
        calculatedValue: 50000,
        validationStatus: 'VALIDATED',
        timestamp: new Date().toISOString(),
        provenanceId: 'EV-PROV-SALES-001',
      },
      {
        metricKey: 'grossProfit',
        metricLabel: 'إجمالي الربح',
        sourceTable: 'order_items',
        sqlQuery: 'SELECT SUM(total - cost) FROM order_items',
        calculatedValue: 20000,
        validationStatus: 'VALIDATED',
        timestamp: new Date().toISOString(),
        provenanceId: 'EV-PROV-PROFIT-001',
      },
      {
        metricKey: 'cost',
        metricLabel: 'التكاليف',
        sourceTable: 'order_items',
        sqlQuery: 'SELECT SUM(cost) FROM order_items',
        calculatedValue: 30000,
        validationStatus: 'VALIDATED',
        timestamp: new Date().toISOString(),
        provenanceId: 'EV-PROV-COST-001',
      },
      {
        metricKey: 'totalExpenses',
        metricLabel: 'المصروفات',
        sourceTable: 'expenses',
        sqlQuery: 'SELECT SUM(amount) FROM expenses',
        calculatedValue: 12000,
        validationStatus: 'VALIDATED',
        timestamp: new Date().toISOString(),
        provenanceId: 'EV-PROV-EXP-001',
      },
      {
        metricKey: 'netProfit',
        metricLabel: 'صافي الربح',
        sourceTable: 'financial_summary',
        sqlQuery: 'grossProfit - totalExpenses',
        calculatedValue: 8000,
        validationStatus: 'VALIDATED',
        timestamp: new Date().toISOString(),
        provenanceId: 'EV-PROV-NET-001',
      },
    ],
  };

  const completeDiscovery: DataDiscoveryResult = {
    tablesFound: ['orders', 'order_items', 'products', 'customers', 'expenses'],
    capabilities: {
      salesSupported: true,
      productsSupported: true,
      customersSupported: true,
      expensesSupported: true,
      costSupported: true,
      profitSupported: true,
      paymentsSupported: true,
      inventorySupported: true,
    },
    entities: {
      salesTable: 'orders',
      orderItemsTable: 'order_items',
      productsTable: 'products',
      customersTable: 'customers',
      expensesTable: 'expenses',
    },
    recordCounts: { orders: 200, order_items: 600, products: 50, customers: 120, expenses: 30 },
  };

  // -------------------------------------------------------------------------
  console.log('\nRunning Test 1 — Full Successful Analysis (تحليل ناجح بالكامل):');
  // -------------------------------------------------------------------------
  const res1 = executeDiagnosticAnalysis('ما وضع أرباحي؟', verifiedMetrics, completeDiscovery, 'ريال');
  assert(Boolean(res1.developerReport.analysisId), '1.1 Analysis ID is generated');
  assert(res1.developerReport.finalSystemStatus === 'COMPLETED', '1.2 Final status is COMPLETED');
  assert(res1.userView.reliabilityStatus === 'موثوق', '1.3 User reliability status is موثوق (Reliable)');
  assert(res1.developerReport.successfulCalculations.includes('gross_profit'), '1.4 Gross profit calculation succeeded');
  assert(res1.developerReport.durationMs >= 0, '1.5 Total duration is measured');
  assert(res1.developerReport.traceSteps.length >= 5, '1.6 Detailed trace steps recorded');

  // -------------------------------------------------------------------------
  console.log('\nRunning Test 2 — Data Source Unavailable (مصدر بيانات غير متاح):');
  // -------------------------------------------------------------------------
  const res2 = executeDiagnosticAnalysis('ما مبيعات الشركة؟', null, null);
  assert(res2.developerReport.dataSourceStatus === 'UNAVAILABLE', '2.1 Data source status marked UNAVAILABLE');
  assert(res2.userView.reliabilityStatus === 'تعذر إكمال التحليل', '2.2 User status is تعذر إكمال التحليل');
  assert(res2.userView.isReliable === false, '2.3 Result marked as unreliable');
  assert(res2.developerReport.aiResponseStatus === 'FALLBACK_EXPLANATION', '2.4 AI restricted to fallback explanation');

  // -------------------------------------------------------------------------
  console.log('\nRunning Test 3 — Missing / Incomplete Cost Data (بيانات ناقصة):');
  // -------------------------------------------------------------------------
  const noCostMetrics: CompanyMetrics = {
    ...verifiedMetrics,
    grossProfit: null,
    netProfit: null,
    profitMarginPercent: null,
    profitStatusMessage: 'لا تتوفر بيانات تكلفة لحساب الربح.',
  };
  const noCostDiscovery: DataDiscoveryResult = {
    ...completeDiscovery,
    capabilities: {
      ...completeDiscovery.capabilities,
      profitSupported: false,
      costSupported: false,
    },
  };
  const res3 = executeDiagnosticAnalysis('ما صافي الربح؟', noCostMetrics, noCostDiscovery);
  assert(res3.developerReport.finalSystemStatus === 'BLOCKED', '3.1 Analysis status is strictly BLOCKED when cost is missing');
  assert(res3.userView.reliabilityStatus === 'لا يمكن التحقق', '3.2 User reliability is لا يمكن التحقق');
  assert(!res3.userView.answerText.includes('8000'), '3.3 No hallucinated profit numbers appear in answer');

  // -------------------------------------------------------------------------
  console.log('\nRunning Test 4 — Error in Cost Calculation (خطأ في حساب تكلفة):');
  // -------------------------------------------------------------------------
  const eval4 = new DependencyGraphEvaluator();
  eval4.registerMetricResult('revenue', { value: 10000, isValid: true, evidenceId: 'EV-1' });
  const costDiag = eval4.registerMetricResult('costs', {
    value: null,
    isValid: false,
    failureReason: 'incomplete_cost_data',
  });
  assert(costDiag.status === 'FAILED', '4.1 Cost calculation status is FAILED');
  assert(costDiag.failure_reason === 'incomplete_cost_data', '4.2 Exact failure reason recorded');
  assert(costDiag.action === 'BLOCK_RESULT', '4.3 Action is BLOCK_RESULT');

  // -------------------------------------------------------------------------
  console.log('\nRunning Test 5 — Dependent Metric Cascade (اعتماد Metric على Metric فاشل):');
  // -------------------------------------------------------------------------
  const gpDiag = eval4.registerMetricResult('gross_profit', {
    value: 5000,
    isValid: true,
  });
  assert(gpDiag.status === 'BLOCKED', '5.1 Gross profit is BLOCKED because upstream costs failed');
  assert(gpDiag.action === 'BLOCK_RESULT', '5.2 Action is BLOCK_RESULT');

  const netDiag = eval4.registerMetricResult('net_profit', {
    value: 3000,
    isValid: true,
  });
  assert(netDiag.status === 'BLOCKED', '5.3 Net profit is BLOCKED because upstream gross_profit failed');

  // -------------------------------------------------------------------------
  console.log('\nRunning Test 6 — Missing Evidence Triggers BLOCKED (Evidence غير موجود):');
  // -------------------------------------------------------------------------
  const evRes = evidenceAuditor.evaluateEvidence(undefined, []);
  assert(evRes.status === 'BLOCKED', '6.1 Missing evidence is strictly BLOCKED');
  assert(evRes.isAllowableForUser === false, '6.2 Unverified result is forbidden from display to user');

  // -------------------------------------------------------------------------
  console.log('\nRunning Test 7 — AI Blocked from Answering Without Evidence:');
  // -------------------------------------------------------------------------
  const session7 = new DiagnosticAnalysisSession('كم ربحي التقديري؟');
  session7.setAiStatus('BLOCKED', 'FALLBACK_EXPLANATION');
  const rep7 = session7.finalizeReport('لا يمكن التحقق');
  assert(rep7.aiContextStatus === 'BLOCKED', '7.1 AI context status is BLOCKED');
  assert(rep7.aiResponseStatus === 'FALLBACK_EXPLANATION', '7.2 AI response status is FALLBACK_EXPLANATION');

  // -------------------------------------------------------------------------
  console.log('\nRunning Test 8 — Error Classification & Diagnostics (Error Classification):');
  // -------------------------------------------------------------------------
  const loggedError = diagnosticLogger.error('calc_error', 'فشل حساب تكلفة البضاعة', {
    component: 'financial_engine',
    operation: 'cogs_aggregation',
    error_category: 'CALCULATION_ERROR',
  });
  assert(loggedError.error_category === 'CALCULATION_ERROR', '8.1 Error classified as CALCULATION_ERROR');
  assert(loggedError.component === 'financial_engine', '8.2 Error component logged accurately');

  // -------------------------------------------------------------------------
  console.log('\nRunning Test 9 — Logging Failure Resilience (فصل الـ Logging لا يعطل الحسابات):');
  // -------------------------------------------------------------------------
  diagnosticLogger.setEnabled(false);
  const res9 = executeDiagnosticAnalysis('ما مبيعات الشركة؟', verifiedMetrics, completeDiscovery);
  assert(
    res9.userView.isReliable === true &&
    (res9.userView.summary.includes('50,000') || res9.userView.summary.includes((50000).toLocaleString('ar-SA'))),
    '9.1 Business calculation succeeds even when logging disabled'
  );
  diagnosticLogger.setEnabled(true);

  // -------------------------------------------------------------------------
  console.log('\nRunning Test 10 — Secret Redaction (حجب الأسرار والكلمات الحساسة):');
  // -------------------------------------------------------------------------
  const rawMsg = 'Connection failed with password=SuperSecretPassword123! at postgres://admin:dbpassword999@localhost:5432/db';
  const cleanMsg = sanitizeMessage(rawMsg);
  assert(!cleanMsg.includes('SuperSecretPassword123!'), '10.1 Plaintext password redacted');
  assert(!cleanMsg.includes('dbpassword999'), '10.2 Database URL password redacted');
  assert(cleanMsg.includes('[REDACTED_SECRET]'), '10.3 [REDACTED_SECRET] placeholder applied');

  const rawMeta = {
    apiKey: 'sk_live_998877665544332211',
    token: 'bearer_token_abc',
    safeField: 'normal_data',
  };
  const cleanMeta = sanitizeMetadata(rawMeta)!;
  assert(cleanMeta.apiKey === '[REDACTED_SECRET]', '10.4 apiKey field redacted in metadata');
  assert(cleanMeta.token === '[REDACTED_SECRET]', '10.5 token field redacted in metadata');
  assert(cleanMeta.safeField === 'normal_data', '10.6 Safe fields preserved unmutated');

  // -------------------------------------------------------------------------
  console.log('\nRunning Test 11 — Analysis ID in Entire Trace:');
  // -------------------------------------------------------------------------
  const session11 = new DiagnosticAnalysisSession('استعلام تدقيقي');
  const aid = session11.analysisId;
  session11.recordStep('خطوة 1', 'source', 'SUCCESS');
  session11.recordStep('خطوة 2', 'calculation', 'SUCCESS');
  const rep11 = session11.finalizeReport();
  assert(rep11.analysisId === aid, '11.1 Report preserves analysis ID');
  const relatedEvents = diagnosticLogger.getEvents({ analysisId: aid });
  assert(relatedEvents.length >= 2, '11.2 Trace events in logger carry the exact same analysisId');

  // -------------------------------------------------------------------------
  console.log('\nRunning Test 12 — First Failure Point & Root Cause Detection:');
  // -------------------------------------------------------------------------
  const eval12 = new DependencyGraphEvaluator();
  eval12.registerMetricResult('revenue', { value: 20000, isValid: true });
  eval12.registerMetricResult('costs', { value: null, isValid: false, failureReason: 'Missing purchase cost columns' });
  eval12.registerMetricResult('gross_profit', { value: 10000, isValid: true });
  eval12.registerMetricResult('net_profit', { value: 5000, isValid: true });

  const firstFail = eval12.getFirstFailure();
  assert(firstFail === 'costs', '12.1 First failure accurately identified as [costs]');
  const rootCause = eval12.getRootCause();
  assert(Boolean(rootCause && rootCause.includes('Missing purchase cost')), '12.2 Root cause candidate captured');

  // -------------------------------------------------------------------------
  console.log('\nRunning Test 13 — System Health Report Compilation:');
  // -------------------------------------------------------------------------
  const healthRep = generateSystemHealthReport(diagnosticLogger.getEvents(), true, true);
  assert(healthRep.components.logging === 'OK', '13.1 Logging component status is OK');
  assert(Boolean(healthRep.overallStatus), '13.2 Overall status evaluated');

  console.log('\n=============================================================');
  console.log(`TEST SUITE RESULTS: ${passed} PASSED / ${failed} FAILED`);
  console.log('=============================================================');
}

runM45Tests().catch((err) => {
  console.error('[M4.5 Test Failure]', err);
  process.exit(1);
});
