import { TrendAnalysisResult, TrendDataPoint } from './types';

export function analyzeFinancialTrend(
  metricName: string,
  points: TrendDataPoint[]
): TrendAnalysisResult {
  if (points.length < 2) {
    return {
      metricName,
      points,
      direction: 'INSUFFICIENT_DATA',
      explanation: 'لا توجد فترات كافية لتحليل الاتجاه (يلزم فترتان على الأقل)',
    };
  }

  // Evaluate revenue trend
  const first = points[0].revenue;
  const last = points[points.length - 1].revenue;

  if (first === null || last === null) {
    return {
      metricName,
      points,
      direction: 'INSUFFICIENT_DATA',
      explanation: 'القيم غير مكتملة في إحدى الفترات محل التحليل',
    };
  }

  const change = last - first;
  const percentageChange = first !== 0 ? Number(((change / first) * 100).toFixed(2)) : undefined;

  let direction: TrendAnalysisResult['direction'] = 'STABLE';
  if (percentageChange !== undefined) {
    if (percentageChange > 5) direction = 'UPWARD';
    else if (percentageChange < -5) direction = 'DOWNWARD';
    else direction = 'STABLE';
  }

  let explanation = `اتجاه ${metricName} مستقر نسبياً`;
  if (direction === 'UPWARD') {
    explanation = `نمو إيجابي في ${metricName} بمعدل ${percentageChange}% مقارنة ببداية الفترة`;
  } else if (direction === 'DOWNWARD') {
    explanation = `انخفاض في ${metricName} بمعدل ${Math.abs(percentageChange || 0)}% مقارنة ببداية الفترة`;
  }

  return {
    metricName,
    points,
    direction,
    percentageChange,
    explanation,
  };
}
