import { DataPeriod } from '../connectors/types';
import { IncomeStatement, FinancialAnswerStatus } from './types';

export function prepareIncomeStatement(params: {
  period: DataPeriod;
  currency: string;
  revenue: number | null;
  costOfSales: number | null;
  operatingExpenses: number | null;
  otherIncomeExpense?: number | null;
}): IncomeStatement {
  const { period, currency, revenue, costOfSales, operatingExpenses, otherIncomeExpense } = params;
  const evidence: string[] = [];

  let status: FinancialAnswerStatus = 'ANSWERED';
  let isComplete = true;

  if (revenue === null) {
    evidence.push('الإيرادات غير متوفرة في السجلات');
    status = 'INSUFFICIENT_DATA';
    isComplete = false;
  } else {
    evidence.push(`إجمالي الإيرادات المقيدة: ${revenue.toLocaleString('ar-SA')} ${currency}`);
  }

  // Cost of Sales & Gross Profit
  let grossProfit: number | null = null;
  let grossMarginRatio: number | null = null;

  if (revenue !== null && costOfSales !== null) {
    grossProfit = revenue - costOfSales;
    grossMarginRatio = revenue > 0 ? grossProfit / revenue : 0;
    evidence.push(`تكلفة المبيعات المثبتة: ${costOfSales.toLocaleString('ar-SA')} ${currency}`);
    evidence.push(`إجمالي الربح المحسوب: ${grossProfit.toLocaleString('ar-SA')} ${currency} (هامش: ${(grossMarginRatio * 100).toFixed(1)}%)`);
  } else if (costOfSales === null) {
    evidence.push('غياب بيانات تكلفة المبيعات (حظر احتساب الأرباح حتمياً)');
    if (status === 'ANSWERED') status = 'PARTIAL_DATA';
    isComplete = false;
  }

  // Operating Expenses & Operating Profit
  let operatingProfit: number | null = null;
  if (grossProfit !== null && operatingExpenses !== null) {
    operatingProfit = grossProfit - operatingExpenses;
    evidence.push(`المصروفات التشغيلية: ${operatingExpenses.toLocaleString('ar-SA')} ${currency}`);
    evidence.push(`الربح التشغيلي: ${operatingProfit.toLocaleString('ar-SA')} ${currency}`);
  } else if (operatingExpenses === null && grossProfit !== null) {
    evidence.push('المصروفات التشغيلية غير مقيدة منفصلة');
    if (status === 'ANSWERED') status = 'PARTIAL_DATA';
    isComplete = false;
  }

  // Net Profit
  let netProfit: number | null = null;
  let netMarginRatio: number | null = null;

  if (operatingProfit !== null) {
    netProfit = operatingProfit + (otherIncomeExpense || 0);
    netMarginRatio = revenue && revenue > 0 ? netProfit / revenue : null;
    evidence.push(`صافي الربح النهائي: ${netProfit.toLocaleString('ar-SA')} ${currency}`);
  }

  return {
    period,
    currency,
    revenue,
    costOfSales,
    grossProfit,
    grossMarginRatio,
    operatingExpenses,
    operatingProfit,
    netProfit,
    netMarginRatio,
    isComplete,
    status,
    evidence,
  };
}
