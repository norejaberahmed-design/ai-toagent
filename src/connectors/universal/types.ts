/**
 * Universal Application Connector Types & Contracts
 * Principle: الحقيقة قبل الذكاء (Truth Before Intelligence)
 *
 * Strict Rules:
 * - Read-only ONLY
 * - Unified interface across all connectors
 * - Explicit business status (Analyzable, Partial, Contradiction, Insufficient)
 * - Zero hardcoded or assumed table/field names
 */

export interface SourceMetadata {
  id: string;
  displayNameAr: string;
  displayNameEn: string;
  category: 'sql_server' | 'file' | 'erp_api' | 'accounting_api';
  status: 'ready' | 'adapter_ready' | 'partial';
  requiresServerProxy: boolean;
  documentationUrl: string;
  descriptionAr: string;
}

export interface ReadOnlyPolicy {
  isReadOnly: boolean;
  mechanism: string;
  forbiddenOperations: string[];
  enforcementActive: boolean;
}

export interface ConnectionConfig {
  host?: string;
  port?: number;
  database?: string;
  user?: string;
  password?: string;
  ssl?: boolean;
  fileBuffer?: ArrayBuffer | Uint8Array;
  fileName?: string;
  fileType?: 'sqlite' | 'xlsx' | 'csv';
  apiEndpoint?: string;
  apiKey?: string;
  companyId?: string;
  oauthToken?: string;
}

export type BusinessReadinessStatus =
  | 'connected'
  | 'disconnected'
  | 'analyzable'
  | 'partial'
  | 'contradiction'
  | 'insufficient';

export interface ConnectionTestResult {
  ok: boolean;
  status: 'connected' | 'failed' | 'read_only_violation';
  message: string;
  readOnlyGuaranteed: boolean;
  latencyMs: number;
  entitiesCount?: number;
  businessStatus: BusinessReadinessStatus;
}

export interface SourceHealth {
  connected: boolean;
  lastVerifiedAt: string;
  readOnlyConfirmed: boolean;
  latencyMs?: number;
  businessStatus: BusinessReadinessStatus;
  message?: string;
}

export interface DiscoveredField {
  name: string;
  dataType: string;
  nullable: boolean;
  isPrimaryKey: boolean;
}

export interface DiscoveredEntity {
  name: string;
  displayName: string;
  fieldCount: number;
  fields: DiscoveredField[];
  rowCountEstimate?: number;
}

export interface EntityStructure {
  name: string;
  fields: DiscoveredField[];
  primaryKeys: string[];
}

export interface ReadOptions {
  limit?: number;
  offset?: number;
}

export interface EntityDataBatch {
  entityName: string;
  columns: string[];
  rows: Record<string, unknown>[];
  totalRead: number;
  readAt: string;
  auditHash: string;
}

export interface ConnectorInterface {
  readonly metadata: SourceMetadata;
  readonly readOnlyPolicy: ReadOnlyPolicy;

  connect(config: ConnectionConfig): Promise<ConnectionTestResult>;
  testConnection(config: ConnectionConfig): Promise<ConnectionTestResult>;
  discover(): Promise<DiscoveredEntity[]>;
  inspectStructure(entityName: string): Promise<EntityStructure>;
  read(entityName: string, options?: ReadOptions): Promise<EntityDataBatch>;
  disconnect(): Promise<void>;
  health(): Promise<SourceHealth>;
}
