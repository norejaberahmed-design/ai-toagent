/**
 * Base Adapter Abstract Implementation
 * Principle: الحقيقة قبل الذكاء (Truth Before Intelligence)
 *
 * Implements common facilities across all enterprise data adapters:
 * - Deterministic schema hashing
 * - Standardized provenance generation
 * - Read-only enforcement verification
 * - Error normalization
 */

import {
  Connector,
  ConnectorMeta,
  ConnectionState,
  Credentials,
  TestResult,
  SchemaSnapshot,
  SemanticMapping,
  ROReport,
  DataPeriod,
  DataBatch,
  HealthStatus,
  BusinessConcept,
  Provenance,
  SafeTransform,
} from './types';
import { deterministicContentHash } from '../engine/hash';
import { validateReadOnlyQuery, SqlSecurityError } from '../services/sqlGuard';

export abstract class BaseAdapter implements Connector {
  public readonly sourceId: string;
  public readonly tenantId: string;
  protected state: ConnectionState = 'DISCONNECTED';
  protected credentials: Credentials | null = null;
  protected lastVerifiedAt: string | null = null;
  protected lastSchemaSnapshot: SchemaSnapshot | null = null;

  constructor(sourceId: string, tenantId: string) {
    this.sourceId = sourceId;
    this.tenantId = tenantId;
  }

  public abstract meta(): ConnectorMeta;
  public abstract connect(creds: Credentials): Promise<ConnectionState>;
  public abstract testConnection(): Promise<TestResult>;
  public abstract discover(): Promise<SchemaSnapshot>;
  public abstract map(schema: SchemaSnapshot): Promise<SemanticMapping>;
  public abstract readOnlyCheck(): Promise<ROReport>;
  public abstract fetch(concept: BusinessConcept, period: DataPeriod): Promise<DataBatch>;

  public async health(): Promise<HealthStatus> {
    return {
      state: this.state,
      lastCheck: this.lastVerifiedAt || 'NOT_VERIFIED',
      verified: this.state === 'CONNECTED',
    };
  }

  public async revoke(): Promise<void> {
    this.state = 'DISCONNECTED';
    this.credentials = null;
    this.lastSchemaSnapshot = null;
  }

  /**
   * Helper to compute a canonical deterministic hash for a schema
   */
  protected computeSchemaHash(tables: SchemaSnapshot['tables']): string {
    // Sort tables by name and columns by name for 100% deterministic representation
    const sorted = [...tables]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((t) => ({
        name: t.name,
        columns: [...t.columns]
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((c) => ({
            name: c.name,
            type: c.type.toUpperCase(),
            nullable: c.nullable,
          })),
      }));

    return deterministicContentHash(sorted);
  }

  /**
   * Helper to construct a standardized, immutable Provenance object
   */
  protected createProvenance(params: {
    sourceRef: string;
    queryHash: string;
    fetchedAt: string;
    transformationChain?: SafeTransform[];
    confidence?: number;
    isComplete?: boolean;
  }): Provenance {
    return {
      source_id: this.sourceId,
      connector_id: this.meta().id,
      source_ref: params.sourceRef,
      query_hash: params.queryHash,
      fetched_at: params.fetchedAt,
      transformation_chain: params.transformationChain || ['NONE'],
      confidence: params.confidence !== undefined ? params.confidence : 1.0,
      is_complete: params.isComplete !== undefined ? params.isComplete : true,
    };
  }

  /**
   * Validates SQL statement against mutations
   */
  protected verifySqlReadOnly(sql: string): void {
    validateReadOnlyQuery(sql);
  }

  /**
   * Helper test to verify that mutation queries are strictly rejected
   */
  protected testMutationRejection(): boolean {
    try {
      this.verifySqlReadOnly('INSERT INTO security_audit_test VALUES (1, 2)');
      return false; // If it didn't throw, read-only failed!
    } catch (err) {
      return err instanceof SqlSecurityError || (err as Error).message.includes('غير مسموح بها');
    }
  }
}
