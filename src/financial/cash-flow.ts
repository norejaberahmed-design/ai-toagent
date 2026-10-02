import { DataPeriod } from '../connectors/types';
import { CashFlowStatement, FinancialAnswerStatus } from './types';

export function prepareCashFlowStatement(params: {
  period: DataPeriod;
  currency: string;
  operatingCashFlow: number | null;
  investingCashFlow?: number | null;
  financingCashFlow?: number | null;
}): CashFlowStatement {
  const { period, currency, operatingCashFlow, investingCashFlow = null, financingCashFlow = null } = params;
  const evidence: string[] = [];
  let status: FinancialAnswerStatus = 'ANSWERED';
  let isComplete = true;

  if (operatingCashFlow === null) {
    status = 'INSUFFICIENT_DATA';
    isComplete = false;
    evidence.push('بيانات التدفق النقدي التشغيلي غير مسجلة في المصدر');
  } else {
    evidence.push(`التدفق النقدي التشغيلي المثبت: ${operatingCashFlow.toLocaleString('ar-SA')} ${currency}`);
  }

  let netCashFlow: number | null = null;
  if (operatingCashFlow !== null) {
    netCashFlow = operatingCashFlow + (investingCashFlow || 0) + (financingCashFlow || 0);
  }

  return {
    period,
    currency,
    operatingCashFlow,
    investingCashFlow,
    financingCashFlow,
    netCashFlow,
    isComplete,
    status,
    evidence,
  };
}
