import { DataPeriod } from '../connectors/types';
import { prepareIncomeStatement } from './income-statement';
import { prepareBalanceSheet } from './balance-sheet';
import { prepareCashFlowStatement } from './cash-flow';
import { prepareEquityStatement } from './equity-statement';
import { IncomeStatement, BalanceSheet, CashFlowStatement, EquityStatement } from './types';

export interface FinancialStatementsBundle {
  period: DataPeriod;
  currency: string;
  incomeStatement: IncomeStatement;
  balanceSheet: BalanceSheet;
  cashFlow: CashFlowStatement;
  equityStatement: EquityStatement;
}

export function compileFinancialStatements(params: {
  period: DataPeriod;
  currency: string;
  revenue: number | null;
  costOfSales: number | null;
  operatingExpenses: number | null;
  cash: number | null;
  receivables: number | null;
  inventory: number | null;
  payables: number | null;
  capital: number | null;
  retainedEarnings: number | null;
  operatingCashFlow: number | null;
  openingEquity: number | null;
}): FinancialStatementsBundle {
  const { period, currency } = params;

  const incomeStatement = prepareIncomeStatement({
    period,
    currency,
    revenue: params.revenue,
    costOfSales: params.costOfSales,
    operatingExpenses: params.operatingExpenses,
  });

  const balanceSheet = prepareBalanceSheet({
    period,
    currency,
    cash: params.cash,
    receivables: params.receivables,
    inventory: params.inventory,
    payables: params.payables,
    capital: params.capital,
    retainedEarnings: params.retainedEarnings,
  });

  const cashFlow = prepareCashFlowStatement({
    period,
    currency,
    operatingCashFlow: params.operatingCashFlow,
  });

  const equityStatement = prepareEquityStatement({
    period,
    currency,
    openingEquity: params.openingEquity,
    netIncome: incomeStatement.netProfit,
  });

  return {
    period,
    currency,
    incomeStatement,
    balanceSheet,
    cashFlow,
    equityStatement,
  };
}
