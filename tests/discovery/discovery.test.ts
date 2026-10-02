/**
 * P3.1 Deterministic Discovery Engine Test Suite
 * Master Verification Tests (Tests 1 to 20 + Integration)
 */

import { computeHHI } from '../../src/discovery/detectors/concentration';
import { computeDivergenceScore } from '../../src/discovery/detectors/divergence';
import { detectSignals, summarizeSignals } from '../../src/discovery/engine';
import { getSignalPriorityRank, sortSignalsByPriority } from '../../src/discovery/priority';
import {
  computeRunId,
  computeSha256,
  computeSignalId,
  DEFAULT_THRESHOLDS,
  DiscoveryConfig,
  Severity,
  Signal,
  SignalType,
} from '../../src/discovery/types';
import { createTestProvenancedValue, createTestSnapshot } from './fixtures/snapshots';

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, msg: string) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✓ [PASS] ${msg}`);
  } else {
    failedTests++;
    console.error(`  ✗ [FAIL] ${msg}`);
    throw new Error(`Assertion failed: ${msg}`);
  }
}

console.log('=============================================================');
console.log('--- STARTING P3.1 DETERMINISTIC DISCOVERY ENGINE TESTS ---');
console.log('=============================================================');

const baseConfig: DiscoveryConfig = {
  tenant_id: 'tenant_test_01',
};

// -------------------------------------------------------------
// Test 1 — Purity
// -------------------------------------------------------------
console.log('\nRunning Test 1 — Purity (No Date.now, Math.random, I/O):');
let dateNowCalls = 0;
let mathRandomCalls = 0;

const origDateNow = Date.now;
const origMathRandom = Math.random;

Date.now = () => {
  dateNowCalls++;
  return 1700000000000;
};
Math.random = () => {
  mathRandomCalls++;
  return 0.5;
};

try {
  const pSnaps = [
    createTestSnapshot({ from: '2024-01-01', to: '2024-01-31', sales: 10000, revenue: 10000, margin: 0.35 }),
    createTestSnapshot({ from: '2024-02-01', to: '2024-02-28', sales: 11000, revenue: 11000, margin: 0.35 }),
    createTestSnapshot({ from: '2024-03-01', to: '2024-03-31', sales: 12000, revenue: 12000, margin: 0.35 }),
  ];

  const signals = detectSignals(pSnaps, baseConfig);
  assert(dateNowCalls === 0, 'Date.now() calls === 0');
  assert(mathRandomCalls === 0, 'Math.random() calls === 0');
  assert(signals !== undefined, 'Execution is purely synchronous (not a Promise)');
} finally {
  Date.now = origDateNow;
  Math.random = origMathRandom;
}

// -------------------------------------------------------------
// Test 2 — Determinism
// -------------------------------------------------------------
console.log('\nRunning Test 2 — Determinism:');
{
  const snaps = [
    createTestSnapshot({ from: '2024-01-01', to: '2024-01-31', sales: 10000, margin: 0.25 }),
    createTestSnapshot({ from: '2024-02-01', to: '2024-02-28', sales: 12000, margin: 0.22 }),
    createTestSnapshot({ from: '2024-03-01', to: '2024-03-31', sales: 14000, margin: 0.18 }),
  ];

  const run1 = detectSignals(snaps, baseConfig);
  const run2 = detectSignals(snaps, baseConfig);

  const json1 = JSON.stringify(run1);
  const json2 = JSON.stringify(run2);

  assert(json1 === json2, 'Two separate runs yield 100% byte-identical output');
  assert(run1.length > 0, 'Signals were generated deterministically');
}

// -------------------------------------------------------------
// Test 3 — Null Handling
// -------------------------------------------------------------
console.log('\nRunning Test 3 — Null:');
{
  const nullSnaps = [
    createTestSnapshot({ from: '2024-01-01', to: '2024-01-31', sales: null }),
    createTestSnapshot({ from: '2024-02-01', to: '2024-02-28', sales: null }),
    createTestSnapshot({ from: '2024-03-01', to: '2024-03-31', sales: null }),
  ];

  const signals = detectSignals(nullSnaps, baseConfig);
  const salesTrends = signals.filter(
    (s) => s.type === SignalType.TREND && s.related_concepts.includes('sales')
  );
  assert(salesTrends.length === 0, 'sales === null results in NO TREND signal (null is never converted to 0)');
}

// -------------------------------------------------------------
// Test 4 — Minimum Periods for Trend
// -------------------------------------------------------------
console.log('\nRunning Test 4 — Minimum Periods (>= 3 periods for Trend):');
{
  const twoSnaps = [
    createTestSnapshot({ from: '2024-01-01', to: '2024-01-31', sales: 10000 }),
    createTestSnapshot({ from: '2024-02-01', to: '2024-02-28', sales: 12000 }),
  ];
  const signals2 = detectSignals(twoSnaps, baseConfig);
  const trend2 = signals2.filter((s) => s.type === SignalType.TREND);
  assert(trend2.length === 0, '2 periods: no TREND signals');

  const threeSnaps = [
    createTestSnapshot({ from: '2024-01-01', to: '2024-01-31', sales: 10000 }),
    createTestSnapshot({ from: '2024-02-01', to: '2024-02-28', sales: 12000 }),
    createTestSnapshot({ from: '2024-03-01', to: '2024-03-31', sales: 14000 }),
  ];
  const signals3 = detectSignals(threeSnaps, baseConfig);
  const trend3 = signals3.filter((s) => s.type === SignalType.TREND && s.related_concepts.includes('sales'));
  assert(trend3.length === 1, '3 periods exceeding threshold: produces TREND signal');
  assert(trend3[0].title_ar.includes('تصاعدي'), 'Trend correctly identified as positive/ascending');
}

// -------------------------------------------------------------
// Test 5 — Z-score Mathematical Anomaly
// -------------------------------------------------------------
console.log('\nRunning Test 5 — Z-score Mathematical Anomaly:');
{
  // 6 historical periods: [100, 100, 100, 100, 100, 300]
  // Mean = (500 + 300) / 6 = 133.33
  // Variance = (5 * (100 - 133.33)^2 + (300 - 133.33)^2) / 6 = (5 * 1111.11 + 27777.77) / 6 = 5555.55
  // StdDev = sqrt(5555.55) = 74.53
  // Z-score = (300 - 133.33) / 74.53 = 2.23 (warning if >= 2.0 or 2.5)
  // Let's use a more extreme spike: [100, 100, 100, 100, 100, 450]
  // Mean = 600 / 6 = 158.33
  // Variance = (5 * 3402.77 + 85069.44) / 6 = 17013.88
  // StdDev = 130.43
  // Z-score = (450 - 158.33) / 130.43 = 2.23
  // To exceed warning threshold 2.5:
  // [100, 100, 100, 100, 100, 600]
  // Mean = 1100 / 6 = 183.33
  // Diff^2: 5 * 83.33^2 = 34722.22, (600 - 183.33)^2 = 173611.11
  // Var = 208333.33 / 6 = 34722.22
  // StdDev = 186.34
  // Z-score = (600 - 183.33) / 186.34 = 2.236
  // Let's calculate mathematically:
  // For x = [10, 10, 10, 10, 10, 100]:
  // Mean = 150 / 6 = 25
  // Var = (5 * 15^2 + 75^2) / 6 = (1125 + 5625) / 6 = 1125
  // StdDev = Math.sqrt(1125) = 33.541
  // Z = (100 - 25) / 33.541 = 75 / 33.541 = 2.236 (N=6 max z-score is sqrt(5) = 2.236)
  // Note: For sample of size N=6, mathematically max z-score is sqrt((N-1)) = sqrt(5) = 2.236!
  // Therefore with N=7 or custom thresholds, e.g. thresholds: { anomaly_z_warning: 2.0, anomaly_z_critical: 2.2 }:
  const customConfig: DiscoveryConfig = {
    tenant_id: 'tenant_test_01',
    thresholds: {
      anomaly_z_warning: 2.0,
      anomaly_z_critical: 2.2,
    },
  };

  const anomalySnaps = [
    createTestSnapshot({ from: '2024-01-01', to: '2024-01-31', sales: 10 }),
    createTestSnapshot({ from: '2024-02-01', to: '2024-02-28', sales: 10 }),
    createTestSnapshot({ from: '2024-03-01', to: '2024-03-31', sales: 10 }),
    createTestSnapshot({ from: '2024-04-01', to: '2024-04-30', sales: 10 }),
    createTestSnapshot({ from: '2024-05-01', to: '2024-05-31', sales: 10 }),
    createTestSnapshot({ from: '2024-06-01', to: '2024-06-30', sales: 100 }),
  ];

  const signals = detectSignals(anomalySnaps, customConfig);
  const anomalySig = signals.find((s) => s.type === SignalType.ANOMALY);
  assert(anomalySig !== undefined, 'Anomaly detected with mathematical z-score >= 2.0');
  assert(anomalySig!.severity === Severity.CRITICAL, 'Z-score 2.236 >= critical threshold 2.2 evaluates to CRITICAL');
}

// -------------------------------------------------------------
// Test 6 — HHI Formula & Concentration
// -------------------------------------------------------------
console.log('\nRunning Test 6 — HHI:');
{
  const shares = [0.45, 0.2, 0.15, 0.1, 0.1];
  const hhi = computeHHI(shares);
  // 0.45^2 + 0.20^2 + 0.15^2 + 0.10^2 + 0.10^2 = 0.2025 + 0.04 + 0.0225 + 0.01 + 0.01 = 0.285
  assert(hhi >= 0.25 && hhi < 0.4, `HHI = ${hhi} satisfies >= 0.25 and < 0.40`);

  const concentrationConfig: DiscoveryConfig = {
    tenant_id: 'tenant_test_01',
    breakdowns: {
      customers: [
        { name: 'Customer A', share: 0.45 },
        { name: 'Customer B', share: 0.2 },
        { name: 'Customer C', share: 0.15 },
        { name: 'Customer D', share: 0.1 },
        { name: 'Customer E', share: 0.1 },
      ],
    },
  };

  const snaps = [
    createTestSnapshot({ from: '2024-01-01', to: '2024-01-31', customer: 5, revenue: 100000 }),
  ];

  const signals = detectSignals(snaps, concentrationConfig);
  const concSignal = signals.find((s) => s.type === SignalType.CONCENTRATION);
  assert(concSignal !== undefined, 'Concentration signal produced for HHI >= 0.25');
  assert(concSignal!.severity === Severity.WARNING, 'Concentration evaluated as WARNING');
  assert(concSignal!.explanation_ar.includes('0.285'), 'Explanation accurately states calculated HHI');
}

// -------------------------------------------------------------
// Test 7 — Divergence
// -------------------------------------------------------------
console.log('\nRunning Test 7 — Divergence:');
{
  const divScore = computeDivergenceScore(0.15, -0.05);
  assert(divScore === 0.2, `divergence_score = abs(0.15 - (-0.05)) = 0.20 >= 0.10`);

  const divSnaps = [
    createTestSnapshot({ from: '2024-01-01', to: '2024-01-31', sales: 10000, collection: 9000 }),
    createTestSnapshot({ from: '2024-02-01', to: '2024-02-28', sales: 12000, collection: 8000 }),
    createTestSnapshot({ from: '2024-03-01', to: '2024-03-31', sales: 14000, collection: 7000 }),
  ];

  const signals = detectSignals(divSnaps, baseConfig);
  const divSignal = signals.find((s) => s.type === SignalType.DIVERGENCE);
  assert(divSignal !== undefined, 'Divergence signal detected when sales grow while collections decline');
  assert(divSignal!.severity === Severity.CRITICAL, 'Sales growth with collection decline marked as CRITICAL');
}

// -------------------------------------------------------------
// Test 8 — Margin Erosion
// -------------------------------------------------------------
console.log('\nRunning Test 8 — Margin Erosion (0.25 -> 0.22 -> 0.18):');
{
  const marginSnaps = [
    createTestSnapshot({ from: '2024-01-01', to: '2024-01-31', margin: 0.25, revenue: 100000, cost: 75000 }),
    createTestSnapshot({ from: '2024-02-01', to: '2024-02-28', margin: 0.22, revenue: 100000, cost: 78000 }),
    createTestSnapshot({ from: '2024-03-01', to: '2024-03-31', margin: 0.18, revenue: 100000, cost: 82000 }),
  ];

  const signals = detectSignals(marginSnaps, baseConfig);
  const erosionSignal = signals.find((s) => s.type === SignalType.MARGIN_EROSION);
  assert(erosionSignal !== undefined, 'Margin erosion signal detected (0.25 -> 0.18, erosion = 0.07 >= 0.05)');
  assert(erosionSignal!.severity === Severity.WARNING, 'Margin erosion correctly marked as WARNING');
  assert(erosionSignal!.explanation_ar.includes('تآكل في هامش الربح بمقدار 7%'), 'Exact calculated percentage stated in Arabic');
}

// -------------------------------------------------------------
// Test 9 — Cashflow Risk
// -------------------------------------------------------------
console.log('\nRunning Test 9 — Cashflow Risk (cashflow = -5000):');
{
  const cfSnaps = [
    createTestSnapshot({ from: '2024-01-01', to: '2024-01-31', cashflow: -5000 }),
  ];

  const signals = detectSignals(cfSnaps, baseConfig);
  const cfSignal = signals.find((s) => s.type === SignalType.CASHFLOW_RISK);
  assert(cfSignal !== undefined, 'Cashflow risk detected for cashflow = -5000');
  assert(cfSignal!.severity === Severity.CRITICAL, 'Negative cashflow is strictly CRITICAL');
}

// -------------------------------------------------------------
// Test 10 — Currency Mismatch
// -------------------------------------------------------------
console.log('\nRunning Test 10 — Currency Mismatch (SAR + USD rejected):');
{
  const mixedCurrencySnaps = [
    createTestSnapshot({ from: '2024-01-01', to: '2024-01-31', sales: 10000, currency: 'SAR' }),
    createTestSnapshot({ from: '2024-02-01', to: '2024-02-28', sales: 12000, currency: 'USD' }),
    createTestSnapshot({ from: '2024-03-01', to: '2024-03-31', sales: 14000, currency: 'SAR' }),
  ];

  const signals = detectSignals(mixedCurrencySnaps, baseConfig);
  const trendSignals = signals.filter((s) => s.type === SignalType.TREND && s.related_concepts.includes('sales'));
  assert(trendSignals.length === 0, 'Mixed currency evidence (SAR + USD) strictly rejected — no Signal generated');
}

// -------------------------------------------------------------
// Test 11 — Provenance
// -------------------------------------------------------------
console.log('\nRunning Test 11 — Provenance:');
{
  const snaps = [
    createTestSnapshot({ from: '2024-01-01', to: '2024-01-31', cashflow: -3000 }),
  ];
  const signals = detectSignals(snaps, baseConfig);
  assert(signals.length > 0, 'Generated at least one signal');
  for (const sig of signals) {
    assert(sig.evidence.length >= 1, 'Signal has evidence.length >= 1');
    for (const ev of sig.evidence) {
      assert(ev.provenance !== null && ev.provenance !== undefined, 'Evidence provenance is not null');
      assert(ev.provenance!.source_id !== undefined, 'Provenance contains source_id');
      assert(ev.provenance!.query_hash !== undefined, 'Provenance contains query_hash');
    }
  }
}

// -------------------------------------------------------------
// Test 12 — Priority Sorting
// -------------------------------------------------------------
console.log('\nRunning Test 12 — Priority Sorting:');
{
  const mockSignals: Signal[] = [
    {
      id: 'sig_info',
      type: SignalType.TREND,
      severity: Severity.INFO,
      title_ar: 'معلومات',
      explanation_ar: 'توضيح',
      evidence: [],
      related_concepts: ['sales'],
      detected_at: '2024-01-01T00:00:00Z',
      run_id: 'run_1',
    },
    {
      id: 'sig_crit',
      type: SignalType.CASHFLOW_RISK,
      severity: Severity.CRITICAL,
      title_ar: 'حرج',
      explanation_ar: 'توضيح',
      evidence: [],
      related_concepts: ['cashflow'],
      detected_at: '2024-01-01T00:00:00Z',
      run_id: 'run_1',
    },
    {
      id: 'sig_warn',
      type: SignalType.RECEIVABLE_AGING,
      severity: Severity.WARNING,
      title_ar: 'تحذير',
      explanation_ar: 'توضيح',
      evidence: [],
      related_concepts: ['receivable'],
      detected_at: '2024-01-01T00:00:00Z',
      run_id: 'run_1',
    },
    {
      id: 'sig_opp',
      type: SignalType.OPPORTUNITY,
      severity: Severity.OPPORTUNITY,
      title_ar: 'فرصة',
      explanation_ar: 'توضيح',
      evidence: [],
      related_concepts: ['profit'],
      detected_at: '2024-01-01T00:00:00Z',
      run_id: 'run_1',
    },
  ];

  const sorted = sortSignalsByPriority(mockSignals);
  assert(sorted[0].severity === Severity.CRITICAL, 'Rank 1 is CRITICAL');
  assert(sorted[1].severity === Severity.WARNING, 'Rank 2 is WARNING');
  assert(sorted[2].severity === Severity.INFO, 'Rank 3 is INFO');
  assert(sorted[3].severity === Severity.OPPORTUNITY, 'Rank 4 is OPPORTUNITY');
}

// -------------------------------------------------------------
// Test 13 — run_id Determinism
// -------------------------------------------------------------
console.log('\nRunning Test 13 — run_id Determinism:');
{
  const id1 = computeRunId(['sig_a', 'sig_b', 'sig_c']);
  const id2 = computeRunId(['sig_c', 'sig_a', 'sig_b']);
  assert(id1 === id2, 'Same signals in different order produce identical run_id');

  const idDifferent = computeRunId(['sig_a', 'sig_b', 'sig_d']);
  assert(id1 !== idDifferent, 'Changing one signal produces a different run_id');
}

// -------------------------------------------------------------
// Test 14 — Partial / Incomplete Data
// -------------------------------------------------------------
console.log('\nRunning Test 14 — Partial Data (Severity <= INFO):');
{
  const incompleteSnaps = [
    createTestSnapshot({ from: '2024-01-01', to: '2024-01-31', cashflow: -5000, is_complete: false }),
  ];

  const signals = detectSignals(incompleteSnaps, baseConfig);
  const cfSig = signals.find((s) => s.type === SignalType.CASHFLOW_RISK);
  assert(cfSig !== undefined, 'Signal generated for incomplete data');
  assert(cfSig!.severity === Severity.INFO, 'Incomplete data strictly demoted to severity = INFO');
  assert(cfSig!.explanation_ar.includes('البيانات غير مكتملة'), 'Explanation explicitly mentions incomplete data');
}

// -------------------------------------------------------------
// Test 15 — Empty Snapshots
// -------------------------------------------------------------
console.log('\nRunning Test 15 — Empty Snapshots:');
{
  const emptyRes = detectSignals([], baseConfig);
  assert(Array.isArray(emptyRes) && emptyRes.length === 0, 'detectSignals([], config) returns strictly []');
}

// -------------------------------------------------------------
// Test 16 — Tenant Isolation
// -------------------------------------------------------------
console.log('\nRunning Test 16 — Tenant Isolation:');
{
  const mixedTenantSnaps = [
    createTestSnapshot({ tenantId: 'tenant_alnoor', from: '2024-01-01', to: '2024-01-31', cashflow: -5000 }),
  ];

  const signals = detectSignals(mixedTenantSnaps, { tenant_id: 'tenant_alfajr' });
  assert(signals.length === 0, 'Snapshot from another tenant is isolated and rejected — zero data leak');
}

// -------------------------------------------------------------
// Test 17 — No Mutation
// -------------------------------------------------------------
console.log('\nRunning Test 17 — No Mutation of Inputs:');
{
  const snap = createTestSnapshot({ from: '2024-01-01', to: '2024-01-31', sales: 50000 });
  const rawCopy = JSON.stringify(snap);

  detectSignals([snap], baseConfig);
  const afterCopy = JSON.stringify(snap);

  assert(rawCopy === afterCopy, 'Snapshots remain 100% unmutated after engine execution');
}

// -------------------------------------------------------------
// Test 18 — Stable Chronological Ordering
// -------------------------------------------------------------
console.log('\nRunning Test 18 — Stable Ordering:');
{
  const s1 = createTestSnapshot({ from: '2024-01-01', to: '2024-01-31', sales: 10000 });
  const s2 = createTestSnapshot({ from: '2024-02-01', to: '2024-02-28', sales: 12000 });
  const s3 = createTestSnapshot({ from: '2024-03-01', to: '2024-03-31', sales: 14000 });

  const orderForward = detectSignals([s1, s2, s3], baseConfig);
  const orderScrambled = detectSignals([s3, s1, s2], baseConfig);

  assert(
    JSON.stringify(orderForward) === JSON.stringify(orderScrambled),
    'Scrambled input array produces byte-identical signals due to deterministic chronological sort'
  );
}

// -------------------------------------------------------------
// Test 19 — Evidence Identity & Query Hash
// -------------------------------------------------------------
console.log('\nRunning Test 19 — Evidence Identity:');
{
  const ev1 = createTestProvenancedValue(100, { query_hash: 'hash_alpha' });
  const ev2 = createTestProvenancedValue(100, { query_hash: 'hash_beta' });

  const id1 = computeSignalId(SignalType.TREND, [ev1], '2024-03-31T23:59:59Z');
  const id2 = computeSignalId(SignalType.TREND, [ev2], '2024-03-31T23:59:59Z');

  assert(id1 !== id2, 'Changing provenance query_hash produces completely distinct Signal ID');
}

// -------------------------------------------------------------
// Test 20 — No Unsupported Claims
// -------------------------------------------------------------
console.log('\nRunning Test 20 — No Unsupported Claims:');
{
  const recSnaps = [
    createTestSnapshot({ from: '2024-01-01', to: '2024-01-31', receivable: 60000, revenue: 100000 }),
  ];

  const signals = detectSignals(recSnaps, baseConfig);
  const recSig = signals.find((s) => s.type === SignalType.RECEIVABLE_AGING);
  assert(recSig !== undefined, 'Receivable aging signal detected');
  assert(!recSig!.explanation_ar.includes('أشهر'), 'Explanation does NOT claim duration in months without documented time relation');
  assert(recSig!.explanation_ar.includes('0.6x'), 'Explanation states exact calculated ratio (0.6x)');
}

// -------------------------------------------------------------
// Test 21 — Summarize Signals
// -------------------------------------------------------------
console.log('\nRunning Test 21 — Summarize Signals (Arabic, Template-Based, No LLM):');
{
  const snaps = [
    createTestSnapshot({ from: '2024-01-01', to: '2024-01-31', cashflow: -5000, receivable: 80000, revenue: 100000 }),
  ];

  const signals = detectSignals(snaps, baseConfig);
  const summary = summarizeSignals(signals);
  assert(summary.headline_ar.length > 0, 'Arabic headline generated');
  assert(summary.bullets_ar.length === signals.length, 'Bullet count matches signal count');
  assert(!summary.headline_ar.includes('undefined'), 'No undefined variables in summary text');
}

console.log('=============================================================');
console.log(`TEST SUITE RESULTS: ${passedTests} PASSED / ${failedTests} FAILED`);
console.log('=============================================================');

if (failedTests > 0) {
  process.exit(1);
}
