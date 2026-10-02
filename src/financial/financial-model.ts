import { DataPeriod, Provenance } from '../connectors/types';
import { UnifiedBusinessSnapshot } from '../model/unified';
import { ReconstructedBusinessEntities } from '../relationships/types';
import { compileFinancialStatements } from './statements';
import { computeFinancialRatios } from './ratios';
import {
  FinancialAnswer,
  FinancialFinding,
  FinancialAnswerStatus,
} from './types';

export function runCompanyFinancialAnalysis(params: {
  period: DataPeriod;
  currency: string;
  snapshot?: UnifiedBusinessSnapshot;
  entities?: ReconstructedBusinessEntities;
  provenanceList?: Provenance[];
}): FinancialAnswer {
  const { period, currency, snapshot, entities, provenanceList = [] } = params;

  const findings: FinancialFinding[] = [];
  const warnings: string[] = [];
  const evidence: string[] = [];

  // 1. Extract base metrics from snapshot or reconstructed entities
  const revenue = snapshot?.revenue?.value ?? snapshot?.sales?.value ?? null;
  const cost = snapshot?.cost?.value ?? null;
  const expenses = snapshot?.expense?.value ?? null;
  const receivables = snapshot?.receivable?.value ?? null;
  const inventory = snapshot?.inventory?.value ?? null;
  const cashflow = snapshot?.cashflow?.value ?? null;

  // 2. Prepare Financial Statements
  const statements = compileFinancialStatements({
    period,
    currency,
    revenue,
    costOfSales: cost,
    operatingExpenses: expenses,
    cash: cashflow,
    receivables,
    inventory,
    payables: null, // from source if available
    capital: null,
    retainedEarnings: null,
    operatingCashFlow: cashflow,
    openingEquity: null,
  });

  // 3. Compute Financial Ratios
  const ratios = computeFinancialRatios({
    revenue,
    costOfSales: cost,
    grossProfit: statements.incomeStatement.grossProfit,
    operatingProfit: statements.incomeStatement.operatingProfit,
    netProfit: statements.incomeStatement.netProfit,
    cash: cashflow,
    receivables,
    inventory,
    totalAssets: statements.balanceSheet.assets.totalAssets,
    currentLiabilities: statements.balanceSheet.liabilities.totalLiabilities,
    totalLiabilities: statements.balanceSheet.liabilities.totalLiabilities,
    totalEquity: statements.balanceSheet.equity.totalEquity,
  });

  // 4. Rule: High-Sales / Low-Margin Detection
  if (entities && entities.products.length > 1) {
    const productsWithCost = entities.products.filter(
      (p) => p.totalRevenue > 0 && p.totalCost !== undefined && p.totalCost > 0
    );

    if (productsWithCost.length >= 2) {
      // Sort by sales descending
      const topSalesProducts = [...productsWithCost].sort((a, b) => b.totalRevenue - a.totalRevenue);
      const overallAvgMargin =
        productsWithCost.reduce((acc, p) => acc + ((p.totalRevenue - (p.totalCost || 0)) / p.totalRevenue), 0) /
        productsWithCost.length;

      // Find top sales products whose margin is noticeably below average
      for (const p of topSalesProducts.slice(0, 3)) {
        const prodMargin = (p.totalRevenue - (p.totalCost || 0)) / p.totalRevenue;
        if (prodMargin < overallAvgMargin * 0.8) {
          findings.push({
            type: 'WARNING',
            title: `صنف عالي المبيعات بهامش ربح منخفض: ${p.productName}`,
            explanation: `المنتج يحقق إيرادات مرتفعة (${p.totalRevenue.toLocaleString('ar-SA')} ${currency}) ولكن بهامش ربح (${(prodMargin * 100).toFixed(1)}%) أقل من متوسط الأصناف (${(overallAvgMargin * 100).toFixed(1)}%).`,
            rule: 'HIGH_SALES_LOW_MARGIN_RULE: مبيعات في الشريحة العليا مع هامش أدنى من 80% من متوسط هوامش الشركة',
            evidence: [
              `إيراد الصنف: ${p.totalRevenue.toLocaleString('ar-SA')} ${currency}`,
              `تكلفة الصنف: ${p.totalCost?.toLocaleString('ar-SA')} ${currency}`,
              `هامش الصنف: ${(prodMargin * 100).toFixed(1)}%`,
              `متوسط هوامش الأصناف: ${(overallAvgMargin * 100).toFixed(1)}%`,
            ],
            period,
            confidence: 0.95,
          });
        }
      }
    }
  }

  // 5. Contradiction warnings
  if (entities && entities.contradictionsCount > 0) {
    warnings.push(`تم رصد ${entities.contradictionsCount} فواتير تختلف قيمتها المسجلة عن مجموع بنودها.`);
  }

  if (cost === null && revenue !== null) {
    warnings.push('بيانات التكلفة غير مسجلة بالكامل، مما يمنع احتساب مجمل وصافي الربح حتمياً.');
  }

  let status: FinancialAnswerStatus = 'ANSWERED';
  if (revenue === null) status = 'INSUFFICIENT_DATA';
  else if (cost === null) status = 'PARTIAL_DATA';

  return {
    status,
    period,
    currency,
    incomeStatement: statements.incomeStatement,
    balanceSheet: statements.balanceSheet,
    cashFlow: statements.cashFlow,
    equityStatement: statements.equityStatement,
    ratios,
    findings,
    warnings,
    evidence: statements.incomeStatement.evidence,
    provenance: provenanceList,
  };
}
