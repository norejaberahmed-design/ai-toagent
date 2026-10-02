/**
 * M4.5 — Diagnostic Logging & System Audit Layer
 * Types and Contracts
 * Principle: الحقيقة قبل الذكاء (Truth Before Intelligence)
 */

export type LogLevel = 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';

export type ErrorCategory =
  | 'DATA_ERROR'
  | 'DATA_QUALITY_ERROR'
  | 'CALCULATION_ERROR'
  | 'DEPENDENCY_ERROR'
  | 'EVIDENCE_ERROR'
  | 'AI_ERROR'
  | 'CONFIGURATION_ERROR'
  | 'SYSTEM_ERROR';

export type EvidenceReliabilityStatus =
  | 'VERIFIED'
  | 'PARTIAL'
  | 'INSUFFICIENT'
  | 'BLOCKED';

export type UserReliabilityStatus =
  | 'موثوق'
  | 'بيانات ناقصة'
  | 'تحتاج مراجعة'
  | 'لا يمكن التحقق'
  | 'تعذر إكمال التحليل';

export interface DiagnosticEvent {
  timestamp: string;
  level: LogLevel;
  event: string;
  analysis_id?: string;
  request_id?: string;
  component: string;
  operation: string;
  status: 'SUCCESS' | 'WARNING' | 'FAILED' | 'BLOCKED' | 'PENDING';
  duration_ms?: number;
  error_category?: ErrorCategory;
  evidence_id?: string;
  message: string;
  metadata?: Record<string, unknown>;
}

export interface CalculationDiagnostic {
  calculation_type: string;
  input_dependencies: string[];
  calculation_stage: string;
  status: 'SUCCESS' | 'FAILED' | 'BLOCKED';
  failure_reason?: string;
  evidence_status: EvidenceReliabilityStatus;
  evidence_id?: string;
  dependent_metric?: string;
  action?: 'ALLOW_RESULT' | 'BLOCK_RESULT';
}

export interface MetricDependencyNode {
  metricKey: string;
  displayNameAr: string;
  dependencies: string[];
  isValid: boolean;
  isCalculated: boolean;
  isBlocked: boolean;
  value?: number | null;
  blockReason?: string;
}

export interface DiagnosticTraceStep {
  stepNumber: number;
  description: string;
  stage: 'source' | 'quality' | 'calculation' | 'evidence' | 'ai' | 'completion';
  status: 'SUCCESS' | 'FAILED' | 'BLOCKED' | 'WARNING';
  timestamp: string;
  durationMs?: number;
  details?: string;
}

export interface PerformanceDiagnostics {
  data_loading_ms: number;
  data_quality_ms: number;
  calculation_ms: number;
  evidence_ms: number;
  ai_generation_ms: number;
  total_analysis_ms: number;
}

export interface AuditRecord {
  auditId: string;
  who: string;
  what: string;
  when: string;
  why: string;
  result: string;
  evidenceId: string;
  evidenceStatus: EvidenceReliabilityStatus;
}

export interface DeveloperDiagnosticReport {
  analysisId: string;
  question: string;
  startTime: string;
  endTime: string;
  durationMs: number;
  performance: PerformanceDiagnostics;

  dataSourceStatus: 'OK' | 'WARNING' | 'FAILED' | 'UNAVAILABLE';
  dataQualityStatus: 'PASS' | 'WARNING' | 'FAILED';

  calculationSteps: CalculationDiagnostic[];
  successfulCalculations: string[];
  failedCalculations: string[];
  blockedCalculations: string[];

  dependencyFailures: string[];

  evidenceStatus: EvidenceReliabilityStatus;
  evidenceIds: string[];

  aiContextStatus: 'ALLOWED' | 'BLOCKED' | 'EXPLANATION_ONLY';
  aiResponseStatus: 'DELIVERED' | 'BLOCKED' | 'FALLBACK_EXPLANATION';

  warningsCount: number;
  errorsCount: number;
  criticalErrorsCount: number;

  firstFailurePoint: string | null;
  rootCauseCandidate: string | null;

  finalSystemStatus: 'COMPLETED' | 'BLOCKED' | 'FAILED' | 'WARNING';
  userReliabilityStatus: UserReliabilityStatus;
  traceSteps: DiagnosticTraceStep[];
}

export interface SystemHealthReport {
  overallStatus: 'OK' | 'WARNING' | 'CRITICAL';
  generatedAt: string;
  components: {
    dataSources: 'OK' | 'WARNING' | 'FAILED';
    discovery: 'OK' | 'WARNING' | 'FAILED';
    semantic: 'OK' | 'WARNING' | 'FAILED';
    metrics: 'OK' | 'WARNING' | 'FAILED';
    financialEngine: 'OK' | 'WARNING' | 'FAILED';
    evidence: 'OK' | 'WARNING' | 'FAILED';
    ai: 'OK' | 'WARNING' | 'FAILED';
    logging: 'OK' | 'WARNING' | 'FAILED';
  };
  detectedIssues: string[];
  mostAffectedComponent: string | null;
  firstFailure: string | null;
  rootCause: string | null;
  recommendedDeveloperAction: string | null;
}
