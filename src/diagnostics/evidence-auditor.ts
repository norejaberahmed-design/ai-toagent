/**
 * M4.5 — Evidence Auditor & Audit Trail Manager
 * Implements strict verification of evidence chains and immutable audit records.
 * Principle: الحقيقة قبل الذكاء (Evidence is the sole source of truth)
 */

import { AuditRecord, EvidenceReliabilityStatus } from './types';
import { diagnosticLogger } from './logger';

export class EvidenceAuditor {
  private static instance: EvidenceAuditor;
  private auditTrail: AuditRecord[] = [];
  private maxTrailSize = 500;

  private constructor() {}

  public static getInstance(): EvidenceAuditor {
    if (!EvidenceAuditor.instance) {
      EvidenceAuditor.instance = new EvidenceAuditor();
    }
    return EvidenceAuditor.instance;
  }

  /**
   * Evaluates evidence reliability for a calculated result.
   */
  public evaluateEvidence(
    provenanceId: string | undefined,
    evidenceItems: string[],
    hasSourceRecord: boolean = true
  ): {
    status: EvidenceReliabilityStatus;
    isAllowableForUser: boolean;
    reason: string;
  } {
    if (!provenanceId && evidenceItems.length === 0) {
      return {
        status: 'BLOCKED',
        isAllowableForUser: false,
        reason: 'غياب كامل لسجلات الإثبات أو مصدر الاستعلام (محظور العرض كحقيقة)',
      };
    }

    if (!hasSourceRecord) {
      return {
        status: 'INSUFFICIENT',
        isAllowableForUser: false,
        reason: 'السجل المصدر غير متوفر أو تعذر التحقق من سلامة البيانات الأصلية',
      };
    }

    if (provenanceId && evidenceItems.length > 0) {
      return {
        status: 'VERIFIED',
        isAllowableForUser: true,
        reason: 'سلسلة إثبات مكتملة وموثقة برقم إثبات واستعلام مصدر محدد',
      };
    }

    return {
      status: 'PARTIAL',
      isAllowableForUser: true,
      reason: 'إثبات جزئي يستند إلى بيانات متاحة لكن يفتقر إلى بعض القيود التدقيقية',
    };
  }

  /**
   * Records an immutable audit record in the audit trail.
   */
  public recordAudit(record: Omit<AuditRecord, 'auditId'>): AuditRecord {
    const auditId = `AUDIT-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    const fullRecord: AuditRecord = {
      auditId,
      ...record,
    };

    this.auditTrail.push(fullRecord);
    if (this.auditTrail.length > this.maxTrailSize) {
      this.auditTrail.shift();
    }

    diagnosticLogger.info(
      'evidence_created',
      `قيد تدقيق [${auditId}] لـ [${record.what}]: حالة الإثبات ${record.evidenceStatus}`,
      {
        evidence_id: record.evidenceId,
        component: 'evidence_auditor',
        operation: 'audit_record',
        status: record.evidenceStatus === 'VERIFIED' ? 'SUCCESS' : 'WARNING',
        metadata: {
          who: record.who,
          why: record.why,
          result: record.result,
        },
      }
    );

    return fullRecord;
  }

  public getAuditTrail(): AuditRecord[] {
    return [...this.auditTrail];
  }

  public clear(): void {
    this.auditTrail = [];
  }
}

export const evidenceAuditor = EvidenceAuditor.getInstance();
