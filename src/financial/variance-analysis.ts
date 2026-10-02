import { VarianceComparison } from './types';

export function computeVariance(
  metricName: string,
  currentValue: number | null,
  comparisonValue: number | null,
  isCostMetric: boolean = false
): VarianceComparison {
  if (currentValue === null || comparisonValue === null) {
    return {
      metricName,
      currentValue,
      comparisonValue,
      absoluteVariance: null,
      percentageVariance: null,
      evaluation: 'NEUTRAL',
    };
  }

  const absVar = currentValue - comparisonValue;
  const pctVar = comparisonValue !== 0 ? Number(((absVar / comparisonValue) * 100).toFixed(2)) : null;

  let evaluation: VarianceComparison['evaluation'] = 'NEUTRAL';
  if (isCostMetric) {
    // For costs/expenses, lower is favorable
    if (absVar < 0) evaluation = 'FAVORABLE';
    else if (absVar > 0) evaluation = 'UNFAVORABLE';
  } else {
    // For sales/profits, higher is favorable
    if (absVar > 0) evaluation = 'FAVORABLE';
    else if (absVar < 0) evaluation = 'UNFAVORABLE';
  }

  return {
    metricName,
    currentValue,
    comparisonValue,
    absoluteVariance: Number(absVar.toFixed(2)),
    percentageVariance: pctVar,
    evaluation,
  };
}
