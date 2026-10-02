import { FinancialRatios } from './types';

export function computeFinancialRatios(params: {
  revenue: number | null;
  costOfSales: number | null;
  grossProfit: number | null;
  operatingProfit: number | null;
  netProfit: number | null;
  cash: number | null;
  receivables: number | null;
  inventory: number | null;
  totalAssets: number | null;
  currentLiabilities: number | null;
  totalLiabilities: number | null;
  totalEquity: number | null;
}): FinancialRatios {
  const {
    revenue,
    costOfSales,
    grossProfit,
    operatingProfit,
    netProfit,
    cash,
    receivables,
    inventory,
    totalAssets,
    currentLiabilities,
    totalLiabilities,
    totalEquity,
  } = params;

  // 1. Margins
  const grossMargin =
    revenue !== null && revenue > 0 && grossProfit !== null
      ? Number((grossProfit / revenue).toFixed(4))
      : null;

  const netMargin =
    revenue !== null && revenue > 0 && netProfit !== null
      ? Number((netProfit / revenue).toFixed(4))
      : null;

  const operatingMargin =
    revenue !== null && revenue > 0 && operatingProfit !== null
      ? Number((operatingProfit / revenue).toFixed(4))
      : null;

  // 2. Liquidity Ratios
  const currentAssets =
    cash !== null && receivables !== null && inventory !== null
      ? cash + receivables + inventory
      : null;

  const currentRatio =
    currentAssets !== null && currentLiabilities !== null && currentLiabilities > 0
      ? Number((currentAssets / currentLiabilities).toFixed(2))
      : null;

  const quickAssets =
    cash !== null && receivables !== null ? cash + receivables : null;

  const quickRatio =
    quickAssets !== null && currentLiabilities !== null && currentLiabilities > 0
      ? Number((quickAssets / currentLiabilities).toFixed(2))
      : null;

  // 3. Efficiency Ratios
  const receivablesTurnover =
    revenue !== null && receivables !== null && receivables > 0
      ? Number((revenue / receivables).toFixed(2))
      : null;

  const inventoryTurnover =
    costOfSales !== null && inventory !== null && inventory > 0
      ? Number((costOfSales / inventory).toFixed(2))
      : null;

  const assetTurnover =
    revenue !== null && totalAssets !== null && totalAssets > 0
      ? Number((revenue / totalAssets).toFixed(2))
      : null;

  // 4. Leverage Ratios
  const debtRatio =
    totalLiabilities !== null && totalAssets !== null && totalAssets > 0
      ? Number((totalLiabilities / totalAssets).toFixed(4))
      : null;

  const debtToEquity =
    totalLiabilities !== null && totalEquity !== null && totalEquity > 0
      ? Number((totalLiabilities / totalEquity).toFixed(2))
      : null;

  // 5. Profitability Ratios
  const returnOnAssets =
    netProfit !== null && totalAssets !== null && totalAssets > 0
      ? Number((netProfit / totalAssets).toFixed(4))
      : null;

  const returnOnEquity =
    netProfit !== null && totalEquity !== null && totalEquity > 0
      ? Number((netProfit / totalEquity).toFixed(4))
      : null;

  return {
    grossMargin,
    netMargin,
    operatingMargin,
    currentRatio,
    quickRatio,
    receivablesTurnover,
    inventoryTurnover,
    assetTurnover,
    debtRatio,
    debtToEquity,
    returnOnAssets,
    returnOnEquity,
  };
}
