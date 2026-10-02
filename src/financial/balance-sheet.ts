import { DataPeriod } from '../connectors/types';
import { BalanceSheet, FinancialAnswerStatus } from './types';

export function prepareBalanceSheet(params: {
  period: DataPeriod;
  currency: string;
  cash: number | null;
  receivables: number | null;
  inventory: number | null;
  otherAssets?: number | null;
  payables: number | null;
  otherLiabilities?: number | null;
  capital: number | null;
  retainedEarnings: number | null;
}): BalanceSheet {
  const {
    period,
    currency,
    cash,
    receivables,
    inventory,
    otherAssets = 0,
    payables,
    otherLiabilities = 0,
    capital,
    retainedEarnings,
  } = params;

  const evidence: string[] = [];
  let status: FinancialAnswerStatus = 'ANSWERED';

  // Check completeness
  const missingComponents: string[] = [];
  if (cash === null) missingComponents.push('النقدية');
  if (receivables === null) missingComponents.push('الذمم المدينة');
  if (inventory === null) missingComponents.push('المخزون');
  if (payables === null) missingComponents.push('الذمم الدائنة');
  if (capital === null) missingComponents.push('رأس المال');

  if (missingComponents.length > 0) {
    status = 'PARTIAL_DATA';
    evidence.push(`عناصر ميزانية غير مكتملة في السجلات: ${missingComponents.join('، ')}`);
  }

  // Calculate totals if components exist
  const totalAssets =
    cash !== null && receivables !== null && inventory !== null
      ? cash + receivables + inventory + (otherAssets || 0)
      : null;

  const totalLiabilities =
    payables !== null ? payables + (otherLiabilities || 0) : null;

  const totalEquity =
    capital !== null && retainedEarnings !== null
      ? capital + retainedEarnings
      : null;

  let isBalanced = false;
  let difference = 0;

  if (totalAssets !== null && totalLiabilities !== null && totalEquity !== null) {
    const totalLiabAndEquity = totalLiabilities + totalEquity;
    difference = Number((totalAssets - totalLiabAndEquity).toFixed(2));
    if (Math.abs(difference) <= 0.05) {
      isBalanced = true;
      evidence.push(`الميزانية متوازنة بدقة: الأصول (${totalAssets.toLocaleString('ar-SA')} ${currency}) = الخصوم وحقوق الملكية (${totalLiabAndEquity.toLocaleString('ar-SA')} ${currency})`);
    } else {
      isBalanced = false;
      status = 'CONTRADICTED';
      evidence.push(`STATEMENT_NOT_BALANCED: عدم توازن الميزانية بفارق قدره ${difference.toLocaleString('ar-SA')} ${currency}. يُمنع التعديل التلقائي.`);
    }
  }

  return {
    period,
    currency,
    assets: {
      cash,
      receivables,
      inventory,
      otherAssets: otherAssets || null,
      totalAssets,
    },
    liabilities: {
      payables,
      otherLiabilities: otherLiabilities || null,
      totalLiabilities,
    },
    equity: {
      capital,
      retainedEarnings,
      totalEquity,
    },
    isBalanced,
    difference,
    status,
    evidence,
  };
}
