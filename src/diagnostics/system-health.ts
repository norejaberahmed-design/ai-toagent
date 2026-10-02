/**
 * M4.5 — System Health Diagnoser
 * Compiles a live system health assessment from logs, metrics, and connector statuses.
 */

import { SystemHealthReport } from './types';
import { diagnosticLogger } from './logger';

export function generateSystemHealthReport(
  recentEvents = diagnosticLogger.getEvents(),
  metricsAvailable = false,
  hasCostData = false
): SystemHealthReport {
  const issues: string[] = [];
  const componentErrors: Record<string, number> = {
    dataSources: 0,
    discovery: 0,
    semantic: 0,
    metrics: 0,
    financialEngine: 0,
    evidence: 0,
    ai: 0,
    logging: 0,
  };

  let firstFailure: string | null = null;
  let rootCause: string | null = null;

  for (const ev of recentEvents) {
    if (ev.level === 'ERROR' || ev.level === 'CRITICAL' || ev.status === 'BLOCKED') {
      if (!firstFailure) {
        firstFailure = `${ev.component}: ${ev.operation}`;
        rootCause = ev.message;
      }
      issues.push(`[${ev.level}] ${ev.component}: ${ev.message}`);

      if (ev.component.includes('source') || ev.component.includes('connect')) {
        componentErrors.dataSources++;
      } else if (ev.component.includes('discovery')) {
        componentErrors.discovery++;
      } else if (ev.component.includes('semantic')) {
        componentErrors.semantic++;
      } else if (ev.component.includes('metric') || ev.component.includes('calc')) {
        componentErrors.metrics++;
      } else if (ev.component.includes('financial')) {
        componentErrors.financialEngine++;
      } else if (ev.component.includes('evidence')) {
        componentErrors.evidence++;
      } else if (ev.component.includes('ai') || ev.component.includes('advisor')) {
        componentErrors.ai++;
      } else {
        componentErrors.logging++;
      }
    }
  }

  if (!metricsAvailable) {
    issues.push('لا توجد بيانات أعمال أو مؤشرات محتسبة حالياً (المصدر غير متصل أو بانتظار الفحص).');
    componentErrors.dataSources++;
  } else if (!hasCostData) {
    issues.push('بيانات التكاليف غير مسجلة في المصدر (حظر حتمي لاحتساب هوامش الربح منعاً للتخمين).');
    componentErrors.metrics++;
    if (!firstFailure) {
      firstFailure = 'costs: missing_cost_input';
      rootCause = 'غياب أعمدة وسجلات التكلفة يمنع حساب الربح بدقة';
    }
  }

  // Find most affected component
  let maxErrors = 0;
  let mostAffected: string | null = null;
  for (const [comp, count] of Object.entries(componentErrors)) {
    if (count > maxErrors) {
      maxErrors = count;
      mostAffected = comp;
    }
  }

  // Resolve overall status
  const criticalCount = recentEvents.filter((e) => e.level === 'CRITICAL').length;
  let overallStatus: SystemHealthReport['overallStatus'] = 'OK';
  if (criticalCount > 0) {
    overallStatus = 'CRITICAL';
  } else if (issues.length > 0) {
    overallStatus = 'WARNING';
  }

  // Actionable developer recommendation
  let recommendedDeveloperAction: string | null = null;
  if (!metricsAvailable) {
    recommendedDeveloperAction = 'ربط مصدر بيانات صالح من تبويب "المصادر" أو اختبار قاعدة بيانات نقاط البيع.';
  } else if (!hasCostData) {
    recommendedDeveloperAction = 'التحقق من تعيين جدول التكاليف في المصدر المربوط لتفعيل مؤشرات الربحية.';
  } else if (firstFailure) {
    recommendedDeveloperAction = `مراجعة خط أنابيب [${firstFailure}] والتحقق من سلامة المدخلات.`;
  }

  return {
    overallStatus,
    generatedAt: new Date().toISOString(),
    components: {
      dataSources: componentErrors.dataSources > 0 ? (metricsAvailable ? 'WARNING' : 'FAILED') : 'OK',
      discovery: componentErrors.discovery > 0 ? 'WARNING' : 'OK',
      semantic: componentErrors.semantic > 0 ? 'WARNING' : 'OK',
      metrics: componentErrors.metrics > 0 ? 'WARNING' : 'OK',
      financialEngine: componentErrors.financialEngine > 0 ? 'WARNING' : 'OK',
      evidence: componentErrors.evidence > 0 ? 'WARNING' : 'OK',
      ai: componentErrors.ai > 0 ? 'WARNING' : 'OK',
      logging: 'OK',
    },
    detectedIssues: issues.slice(0, 10),
    mostAffectedComponent: mostAffected,
    firstFailure,
    rootCause,
    recommendedDeveloperAction,
  };
}
