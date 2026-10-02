import { DataPeriod } from '../connectors/types';
import { EquityStatement, FinancialAnswerStatus } from './types';

export function prepareEquityStatement(params: {
  period: DataPeriod;
  currency: string;
  openingEquity: number | null;
  netIncome: number | null;
  dividendsOrDrawings?: number | null;
}): EquityStatement {
  const { period, currency, openingEquity, netIncome, dividendsOrDrawings = 0 } = params;
  const evidence: string[] = [];
  let status: FinancialAnswerStatus = 'ANSWERED';
  let isComplete = true;

  if (openingEquity === null || netIncome === null) {
    status = 'PARTIAL_DATA';
    isComplete = false;
    evidence.push('بيانات حقوق الملكية الافتتاحية أو صافي الدخل غير مكتملة');
  }

  const closingEquity =
    openingEquity !== null && netIncome !== null
      ? openingEquity + netIncome - (dividendsOrDrawings || 0)
      : null;

  if (closingEquity !== null) {
    evidence.push(`حقوق الملكية الختامية: ${closingEquity.toLocaleString('ar-SA')} ${currency}`);
  }

  return {
    period,
    currency,
    openingEquity,
    netIncome,
    dividendsOrDrawings: dividendsOrDrawings || null,
    closingEquity,
    isComplete,
    status,
    evidence,
  };
}
