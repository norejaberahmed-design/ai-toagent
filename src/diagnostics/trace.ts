/**
 * M4.5 — Diagnostic Trace & Analysis Session Manager
 * Orchestrates Request/Analysis IDs, step tracking, stage timings, and Developer Diagnostic Reports.
 */

import {
  DiagnosticTraceStep,
  DeveloperDiagnosticReport,
  PerformanceDiagnostics,
  UserReliabilityStatus,
  EvidenceReliabilityStatus,
} from './types';
import { diagnosticLogger } from './logger';
import { DependencyGraphEvaluator } from './dependencies';

export class DiagnosticAnalysisSession {
  public readonly analysisId: string;
  public readonly question: string;
  public readonly startTime: string;
  private startTimestamp: number;
  private steps: DiagnosticTraceStep[] = [];
  private stepCounter = 1;
  private dependencyEvaluator: DependencyGraphEvaluator;
  private evidenceIds: Set<string> = new Set();
  private warnings: string[] = [];
  private errors: string[] = [];
  private criticalErrors: string[] = [];

  // Stage Timers
  private timings: PerformanceDiagnostics = {
    data_loading_ms: 0,
    data_quality_ms: 0,
    calculation_ms: 0,
    evidence_ms: 0,
    ai_generation_ms: 0,
    total_analysis_ms: 0,
  };

  private currentStageTimer: { stage: keyof PerformanceDiagnostics; start: number } | null = null;
  private dataSourceStatus: 'OK' | 'WARNING' | 'FAILED' | 'UNAVAILABLE' = 'OK';
  private dataQualityStatus: 'PASS' | 'WARNING' | 'FAILED' = 'PASS';
  private aiContextStatus: 'ALLOWED' | 'BLOCKED' | 'EXPLANATION_ONLY' = 'EXPLANATION_ONLY';
  private aiResponseStatus: 'DELIVERED' | 'BLOCKED' | 'FALLBACK_EXPLANATION' = 'DELIVERED';

  constructor(question: string, customId?: string) {
    this.analysisId = customId || `AN-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    this.question = question;
    this.startTime = new Date().toISOString();
    this.startTimestamp = Date.now();
    this.dependencyEvaluator = new DependencyGraphEvaluator();

    diagnosticLogger.info('analysis_started', `بدء جلسة تحليل جديدة [${this.analysisId}]: "${this.question}"`, {
      analysis_id: this.analysisId,
      component: 'advisor',
      operation: 'query_analysis',
      status: 'PENDING',
    });

    this.recordStep('بدء التحليل واستلام السؤال', 'source', 'SUCCESS');
  }

  public getEvaluator(): DependencyGraphEvaluator {
    return this.dependencyEvaluator;
  }

  public startStageTimer(stage: keyof PerformanceDiagnostics): void {
    if (this.currentStageTimer) {
      this.endStageTimer();
    }
    this.currentStageTimer = { stage, start: Date.now() };
  }

  public endStageTimer(): void {
    if (this.currentStageTimer) {
      const duration = Date.now() - this.currentStageTimer.start;
      this.timings[this.currentStageTimer.stage] += duration;
      this.currentStageTimer = null;
    }
  }

  public recordStep(
    description: string,
    stage: DiagnosticTraceStep['stage'],
    status: DiagnosticTraceStep['status'],
    details?: string
  ): DiagnosticTraceStep {
    const step: DiagnosticTraceStep = {
      stepNumber: this.stepCounter++,
      description,
      stage,
      status,
      timestamp: new Date().toISOString(),
      details,
    };
    this.steps.push(step);

    const logMethod =
      status === 'FAILED'
        ? diagnosticLogger.error.bind(diagnosticLogger)
        : status === 'WARNING' || status === 'BLOCKED'
        ? diagnosticLogger.warning.bind(diagnosticLogger)
        : diagnosticLogger.info.bind(diagnosticLogger);

    logMethod('trace_step', `[${stage.toUpperCase()}] ${description}`, {
      analysis_id: this.analysisId,
      component: stage,
      operation: description,
      status: status === 'BLOCKED' ? 'BLOCKED' : status === 'FAILED' ? 'FAILED' : 'SUCCESS',
      metadata: details ? { details } : undefined,
    });

    return step;
  }

  public recordDataSourceStatus(status: 'OK' | 'WARNING' | 'FAILED' | 'UNAVAILABLE', message: string): void {
    this.dataSourceStatus = status;
    this.recordStep(
      `فحص مصدر البيانات: ${status}`,
      'source',
      status === 'OK' ? 'SUCCESS' : status === 'WARNING' ? 'WARNING' : 'FAILED',
      message
    );
    if (status !== 'OK') {
      this.warnings.push(`مصدر البيانات: ${message}`);
    }
  }

  public recordDataQuality(status: 'PASS' | 'WARNING' | 'FAILED', details: string): void {
    this.dataQualityStatus = status;
    this.recordStep(
      `فحص جودة البيانات: ${status}`,
      'quality',
      status === 'PASS' ? 'SUCCESS' : status === 'WARNING' ? 'WARNING' : 'FAILED',
      details
    );
    if (status === 'WARNING') {
      this.warnings.push(details);
    } else if (status === 'FAILED') {
      this.errors.push(details);
    }
  }

  public addEvidence(evidenceId: string): void {
    if (evidenceId) {
      this.evidenceIds.add(evidenceId);
    }
  }

  public setAiStatus(
    contextStatus: 'ALLOWED' | 'BLOCKED' | 'EXPLANATION_ONLY',
    responseStatus: 'DELIVERED' | 'BLOCKED' | 'FALLBACK_EXPLANATION'
  ): void {
    this.aiContextStatus = contextStatus;
    this.aiResponseStatus = responseStatus;
    this.recordStep(
      `حالة سياق الذكاء / الشرح: ${contextStatus} → ${responseStatus}`,
      'ai',
      responseStatus === 'BLOCKED' ? 'BLOCKED' : 'SUCCESS'
    );
  }

  public addWarning(msg: string): void {
    this.warnings.push(msg);
    diagnosticLogger.warning('diagnostic_warning', msg, { analysis_id: this.analysisId });
  }

  public addError(msg: string, category?: string): void {
    this.errors.push(msg);
    diagnosticLogger.error('diagnostic_error', msg, {
      analysis_id: this.analysisId,
      error_category: (category as any) || 'CALCULATION_ERROR',
    });
  }

  public addCritical(msg: string): void {
    this.criticalErrors.push(msg);
    diagnosticLogger.critical('diagnostic_critical', msg, { analysis_id: this.analysisId });
  }

  /**
   * Finalizes the analysis session and compiles the Developer Diagnostic Report.
   */
  public finalizeReport(userStatus?: UserReliabilityStatus): DeveloperDiagnosticReport {
    this.endStageTimer();
    const endTime = new Date().toISOString();
    const durationMs = Date.now() - this.startTimestamp;
    this.timings.total_analysis_ms = durationMs;

    this.recordStep('اكتمال التحليل وتوليد التقرير التشخيصي', 'completion', 'SUCCESS');

    const calcs = this.dependencyEvaluator.getCalculationDiagnostics();
    const successfulCalcs = calcs.filter((c) => c.status === 'SUCCESS').map((c) => c.calculation_type);
    const failedCalcs = calcs.filter((c) => c.status === 'FAILED').map((c) => c.calculation_type);
    const blockedCalcs = calcs.filter((c) => c.status === 'BLOCKED').map((c) => c.calculation_type);

    const firstFailure = this.dependencyEvaluator.getFirstFailure() || (this.errors.length > 0 ? this.errors[0] : null);
    const rootCause = this.dependencyEvaluator.getRootCause() || (firstFailure ? `تعثر أولي في: ${firstFailure}` : null);

    // Determine Final System Status
    let finalStatus: DeveloperDiagnosticReport['finalSystemStatus'] = 'COMPLETED';
    if (this.criticalErrors.length > 0 || (failedCalcs.length > 0 && successfulCalcs.length === 0)) {
      finalStatus = 'FAILED';
    } else if (blockedCalcs.length > 0) {
      finalStatus = 'BLOCKED';
    } else if (this.warnings.length > 0 || failedCalcs.length > 0) {
      finalStatus = 'WARNING';
    }

    // Determine Evidence Reliability Status
    let evidenceStatus: EvidenceReliabilityStatus = 'VERIFIED';
    if (this.evidenceIds.size === 0) {
      evidenceStatus = successfulCalcs.length > 0 ? 'PARTIAL' : 'INSUFFICIENT';
    } else if (failedCalcs.length > 0 || blockedCalcs.length > 0) {
      evidenceStatus = 'PARTIAL';
    }

    // Determine User Reliability Status if not explicitly passed
    let resolvedUserStatus: UserReliabilityStatus = userStatus || 'موثوق';
    if (!userStatus) {
      if (finalStatus === 'FAILED') {
        resolvedUserStatus = 'تعذر إكمال التحليل';
      } else if (finalStatus === 'BLOCKED') {
        resolvedUserStatus = 'لا يمكن التحقق';
      } else if (evidenceStatus === 'INSUFFICIENT' || this.dataQualityStatus === 'WARNING') {
        resolvedUserStatus = 'بيانات ناقصة';
      } else if (this.warnings.length > 0) {
        resolvedUserStatus = 'تحتاج مراجعة';
      }
    }

    const report: DeveloperDiagnosticReport = {
      analysisId: this.analysisId,
      question: this.question,
      startTime: this.startTime,
      endTime,
      durationMs,
      performance: { ...this.timings },

      dataSourceStatus: this.dataSourceStatus,
      dataQualityStatus: this.dataQualityStatus,

      calculationSteps: calcs,
      successfulCalculations: successfulCalcs,
      failedCalculations: failedCalcs,
      blockedCalculations: blockedCalcs,

      dependencyFailures: blockedCalcs,

      evidenceStatus,
      evidenceIds: Array.from(this.evidenceIds),

      aiContextStatus: this.aiContextStatus,
      aiResponseStatus: this.aiResponseStatus,

      warningsCount: this.warnings.length,
      errorsCount: this.errors.length,
      criticalErrorsCount: this.criticalErrors.length,

      firstFailurePoint: firstFailure,
      rootCauseCandidate: rootCause,

      finalSystemStatus: finalStatus,
      userReliabilityStatus: resolvedUserStatus,
      traceSteps: [...this.steps],
    };

    diagnosticLogger.info(
      'analysis_completed',
      `اكتملت جلسة التحليل [${this.analysisId}]: الحالة النهائية ${finalStatus} (الاستجابة للمستخدم: ${resolvedUserStatus})`,
      {
        analysis_id: this.analysisId,
        status: finalStatus === 'COMPLETED' ? 'SUCCESS' : finalStatus === 'WARNING' ? 'WARNING' : 'FAILED',
        duration_ms: durationMs,
        metadata: {
          firstFailure,
          successfulCount: successfulCalcs.length,
          blockedCount: blockedCalcs.length,
        },
      }
    );

    return report;
  }
}
