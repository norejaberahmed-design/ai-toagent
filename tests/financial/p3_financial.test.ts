import { compileFinancialStatements } from '../../src/financial/statements';
import { prepareIncomeStatement } from '../../src/financial/income-statement';
import { prepareBalanceSheet } from '../../src/financial/balance-sheet';
import { computeFinancialRatios } from '../../src/financial/ratios';
import { analyzeFinancialTrend } from '../../src/financial/trend-analysis';
import { computeVariance } from '../../src/financial/variance-analysis';
import { runCompanyFinancialAnalysis } from '../../src/financial/financial-model';
import { ReconstructedBusinessEntities } from '../../src/relationships/types';
import { UnifiedBusinessSnapshot } from '../../src/model/unified';

import { DataPeriod } from '../../src/connectors/types';

export function runFinancialTests() {
  console.log('--- P3.3 FINANCIAL INTELLIGENCE & ACCOUNTING TESTS ---');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, desc: string) {
    if (condition) {
      console.log(`  ✓ [PASS] ${desc}`);
      passed++;
    } else {
      console.error(`  ✗ [FAIL] ${desc}: Assertion failed`);
      failed++;
    }
  }

  const period2024: DataPeriod = {
    from: '2024-01-01T00:00:00Z',
    to: '2024-12-31T23:59:59Z',
    tz: 'Asia/Riyadh',
  };

  // Test 1: Complete Income Statement
  const income1 = prepareIncomeStatement({
    period: period2024,
    currency: 'SAR',
    revenue: 100000,
    costOfSales: 40000,
    operatingExpenses: 25000,
  });
  assert(income1.grossProfit === 60000, '1. Gross Profit = 100000 - 40000 = 60000');
  assert(income1.grossMarginRatio === 0.6, '1. Gross Margin Ratio = 0.60');
  assert(income1.operatingProfit === 35000, '1. Operating Profit = 60000 - 25000 = 35000');
  assert(income1.netProfit === 35000, '1. Net Profit = 35000');
  assert(income1.isComplete === true, '1. Income statement marked complete');
  assert(income1.status === 'ANSWERED', '1. Income statement status is ANSWERED');

  // Test 2: Incomplete Income Statement (Missing cost -> null profit, NEVER 0)
  const income2 = prepareIncomeStatement({
    period: period2024,
    currency: 'SAR',
    revenue: 100000,
    costOfSales: null,
    operatingExpenses: 15000,
  });
  assert(income2.grossProfit === null, '2. Gross Profit is strictly null when cost is missing');
  assert(income2.netProfit === null, '2. Net Profit is strictly null when cost is missing');
  assert(income2.isComplete === false, '2. Income statement marked incomplete');
  assert(income2.status === 'PARTIAL_DATA', '2. Status is PARTIAL_DATA');

  // Test 3: Balanced Balance Sheet (Assets = Liabilities + Equity)
  const balance1 = prepareBalanceSheet({
    period: period2024,
    currency: 'SAR',
    cash: 50000,
    receivables: 30000,
    inventory: 20000, // Total Assets = 100,000
    payables: 40000,  // Total Liab = 40,000
    capital: 50000,
    retainedEarnings: 10000, // Total Equity = 60,000 -> Liab + Eq = 100,000
  });
  assert(balance1.assets.totalAssets === 100000, '3. Total Assets = 100,000');
  assert(balance1.isBalanced === true, '3. Balance Sheet isBalanced = true');
  assert(balance1.difference === 0, '3. Difference = 0');
  assert(balance1.status === 'ANSWERED', '3. Status is ANSWERED');

  // Test 4: Unbalanced Balance Sheet (Contradiction detected, no fake balancing)
  const balance2 = prepareBalanceSheet({
    period: period2024,
    currency: 'SAR',
    cash: 50000,
    receivables: 30000,
    inventory: 20000, // Total Assets = 100,000
    payables: 50000,
    capital: 60000,
    retainedEarnings: 10000, // Total Liab + Eq = 120,000 -> Diff = -20,000
  });
  assert(balance2.isBalanced === false, '4. Balance Sheet isBalanced = false');
  assert(balance2.difference === -20000, '4. Difference accurately recorded (-20,000)');
  assert(balance2.status === 'CONTRADICTED', '4. Status is CONTRADICTED');

  // Test 5: Financial Ratios
  const ratios = computeFinancialRatios({
    revenue: 100000,
    costOfSales: 40000,
    grossProfit: 60000,
    operatingProfit: 35000,
    netProfit: 35000,
    cash: 50000,
    receivables: 30000,
    inventory: 20000,
    totalAssets: 100000,
    currentLiabilities: 40000,
    totalLiabilities: 40000,
    totalEquity: 60000,
  });
  assert(ratios.grossMargin === 0.6, '5. Gross margin ratio = 0.6');
  assert(ratios.currentRatio === 2.5, '5. Current Ratio = 100,000 / 40,000 = 2.5');
  assert(ratios.quickRatio === 2.0, '5. Quick Ratio = (50,000 + 30,000) / 40,000 = 2.0');
  assert(ratios.receivablesTurnover === 3.33, '5. Receivables Turnover = 100,000 / 30,000 = 3.33');
  assert(ratios.debtToEquity === 0.67, '5. Debt to Equity = 40,000 / 60,000 = 0.67');

  // Test 6: Trend Analysis (Upward vs Downward)
  const trendUp = analyzeFinancialTrend('revenue', [
    { periodLabel: 'Q1', revenue: 10000, cost: 5000, profit: 5000, margin: 0.5 },
    { periodLabel: 'Q2', revenue: 15000, cost: 7000, profit: 8000, margin: 0.53 },
    { periodLabel: 'Q3', revenue: 22000, cost: 9000, profit: 13000, margin: 0.59 },
  ]);
  assert(trendUp.direction === 'UPWARD', '6. Upward revenue trend detected');
  assert(trendUp.percentageChange !== undefined && trendUp.percentageChange > 100, '6. Trend percentage change calculated');

  // Test 7: Variance Analysis (Actual vs Target / Previous)
  const variance = computeVariance('sales', 120000, 100000, false);
  assert(variance.absoluteVariance === 20000, '7. Absolute variance = 20,000');
  assert(variance.percentageVariance === 20, '7. Percentage variance = 20%');
  assert(variance.evaluation === 'FAVORABLE', '7. Revenue increase evaluated as FAVORABLE');

  // Test 8: High-Sales / Low-Margin Opportunity Detection
  const mockEntities: ReconstructedBusinessEntities = {
    customers: [],
    invoices: [],
    products: [
      { productId: 'P1', productName: 'منتج أ (مبيعات ضخمة وهوامش متدنية)', totalSoldQuantity: 1000, totalRevenue: 100000, totalCost: 95000 }, // Margin = 5%
      { productId: 'P2', productName: 'منتج ب (مبيعات جيدة وهوامش ممتازة)', totalSoldQuantity: 300, totalRevenue: 60000, totalCost: 20000 },   // Margin = 66.7%
      { productId: 'P3', productName: 'منتج ج (أداء متوازن)', totalSoldQuantity: 200, totalRevenue: 40000, totalCost: 20000 },                 // Margin = 50%
    ],
    contradictionsCount: 0,
  };

  const mockSnapshot: Partial<UnifiedBusinessSnapshot> = {
    revenue: { value: 200000, unit: 'SAR', currency: 'SAR', period: period2024, is_complete: true, provenance: null },
    cost: { value: 135000, unit: 'SAR', currency: 'SAR', period: period2024, is_complete: true, provenance: null },
  };

  const analysis = runCompanyFinancialAnalysis({
    period: period2024,
    currency: 'SAR',
    snapshot: mockSnapshot as UnifiedBusinessSnapshot,
    entities: mockEntities,
  });

  assert(analysis.findings.length > 0, '8. High-Sales / Low-Margin finding produced');
  assert(analysis.findings[0].type === 'WARNING', '8. Finding marked as WARNING');
  assert(analysis.findings[0].title.includes('منتج أ'), '8. Specifically identified high sales low margin product');

  // Test 9: Purity and Determinism
  const originalDateNow = Date.now;
  const originalMathRandom = Math.random;
  try {
    Date.now = () => { throw new Error('Date.now() called in financial engine'); };
    Math.random = () => { throw new Error('Math.random() called in financial engine'); };

    const run1 = runCompanyFinancialAnalysis({
      period: period2024,
      currency: 'SAR',
      snapshot: mockSnapshot as UnifiedBusinessSnapshot,
      entities: mockEntities,
    });
    const run2 = runCompanyFinancialAnalysis({
      period: period2024,
      currency: 'SAR',
      snapshot: mockSnapshot as UnifiedBusinessSnapshot,
      entities: mockEntities,
    });

    assert(JSON.stringify(run1) === JSON.stringify(run2), '9. Financial analysis is 100% deterministic');
  } finally {
    Date.now = originalDateNow;
    Math.random = originalMathRandom;
  }

  return { passed, failed };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const res = runFinancialTests();
  if (res.failed > 0) process.exit(1);
}
