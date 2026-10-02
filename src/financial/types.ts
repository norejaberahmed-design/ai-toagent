import { DataPeriod, Provenance } from '../connectors/types';
import { VerificationStatus } from '../semantic/types';

export type FinancialAnswerStatus =
  | 'ANSWERED'
  | 'PARTIAL_DATA'
  | 'INSUFFICIENT_DATA'
  | 'CURRENCY_MISMATCH'
  | 'PERIOD_MISMATCH'
  | 'NO_SOURCE'
  | 'UNSUPPORTED'
  | 'CONTRADICTED';

export interface IncomeStatement {
  period: DataPeriod;
  currency: string;
  revenue: number | null;
  costOfSales: number | null;
  grossProfit: number | null;
  grossMarginRatio: number | null;
  operatingExpenses: number | null;
  operatingProfit: number | null;
  netProfit: number | null;
  netMarginRatio: number | null;
  isComplete: boolean;
  status: FinancialAnswerStatus;
  evidence: string[];
}

export interface BalanceSheet {
  period: DataPeriod;
  currency: string;
  assets: {
    cash: number | null;
    receivables: number | null;
    inventory: number | null;
    otherAssets: number | null;
    totalAssets: number | null;
  };
  liabilities: {
    payables: number | null;
    otherLiabilities: number | null;
    totalLiabilities: number | null;
  };
  equity: {
    capital: number | null;
    retainedEarnings: number | null;
    totalEquity: number | null;
  };
  isBalanced: boolean;
  difference: number;
  status: FinancialAnswerStatus;
  evidence: string[];
}

export interface CashFlowStatement {
  period: DataPeriod;
  currency: string;
  operatingCashFlow: number | null;
  investingCashFlow: number | null;
  financingCashFlow: number | null;
  netCashFlow: number | null;
  isComplete: boolean;
  status: FinancialAnswerStatus;
  evidence: string[];
}

export interface EquityStatement {
  period: DataPeriod;
  currency: string;
  openingEquity: number | null;
  netIncome: number | null;
  dividendsOrDrawings: number | null;
  closingEquity: number | null;
  isComplete: boolean;
  status: FinancialAnswerStatus;
  evidence: string[];
}

export interface FinancialRatios {
  grossMargin: number | null;
  netMargin: number | null;
  operatingMargin: number | null;
  currentRatio: number | null;
  quickRatio: number | null;
  receivablesTurnover: number | null;
  inventoryTurnover: number | null;
  assetTurnover: number | null;
  debtRatio: number | null;
  debtToEquity: number | null;
  returnOnAssets: number | null;
  returnOnEquity: number | null;
}

export interface TrendDataPoint {
  periodLabel: string;
  revenue: number | null;
  cost: number | null;
  profit: number | null;
  margin: number | null;
}

export interface TrendAnalysisResult {
  metricName: string;
  points: TrendDataPoint[];
  direction: 'UPWARD' | 'DOWNWARD' | 'STABLE' | 'VOLATILE' | 'INSUFFICIENT_DATA';
  percentageChange?: number;
  explanation: string;
}

export interface VarianceComparison {
  metricName: string;
  currentValue: number | null;
  comparisonValue: number | null;
  absoluteVariance: number | null;
  percentageVariance: number | null;
  evaluation: 'FAVORABLE' | 'UNFAVORABLE' | 'NEUTRAL';
}

export interface FinancialFinding {
  type: 'FINDING' | 'WARNING' | 'OPPORTUNITY' | 'ANOMALY';
  title: string;
  explanation: string;
  rule: string;
  evidence: string[];
  period: DataPeriod;
  confidence: number;
}

export interface FinancialAnswer {
  status: FinancialAnswerStatus;
  period: DataPeriod;
  currency: string;
  incomeStatement?: IncomeStatement;
  balanceSheet?: BalanceSheet;
  cashFlow?: CashFlowStatement;
  equityStatement?: EquityStatement;
  ratios?: FinancialRatios;
  findings: FinancialFinding[];
  warnings: string[];
  evidence: string[];
  provenance: Provenance[];
}
