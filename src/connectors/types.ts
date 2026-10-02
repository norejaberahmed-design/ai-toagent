/**
 * Multi-Source Connector Architecture - Standardized Core Types
 * Principle: الحقيقة قبل الذكاء (Truth Before Intelligence)
 * Controlling Contract for all enterprise data connectors.
 */

export type ConnectorStatus =
  | 'IMPLEMENTED'
  | 'PARTIAL'
  | 'UNIMPLEMENTED'
  | 'ERROR'
  | 'BLOCKED_NO_ENV'
  // Backward compatibility aliases
  | 'connected'
  | 'needs_verification'
  | 'disconnected'
  | 'unsupported'
  | 'insufficient_data';

export type ConnectionState =
  | 'CONNECTED'
  | 'DISCONNECTED'
  | 'AUTH_EXPIRED'
  | 'UNREACHABLE'
  | 'BLOCKED_NO_ENV';

export type ConnectorCategory =
  | 'database'
  | 'file'
  | 'erp'
  | 'pos'
  | 'ecommerce'
  | 'cloud'
  // Backward compatibility aliases
  | 'accounting_erp'
  | 'pos_ecommerce'
  | 'cloud_storage';

export type SourceCategory = ConnectorCategory;

export interface ConnectorMeta {
  id: string;
  category: ConnectorCategory;

  displayNameAr: string;
  displayNameEn: string;

  requiresOAuth: boolean;
  readOnlySupported: boolean;

  status: ConnectorStatus;

  // UI helpers
  name?: string;
  categoryLabel?: string;
  description?: string;
  isImplemented?: boolean;
  requiresServerProxy?: boolean;
  supportedFormats?: string[];
  officialIntegrationDoc?: string;
}

export interface ConnectorMetadata {
  id: string;
  name: string;
  category: SourceCategory;
  categoryLabel: string;
  description: string;
  isImplemented: boolean;
  requiresServerProxy?: boolean;
  supportedFormats?: string[];
  officialIntegrationDoc?: string;
  displayNameAr?: string;
  displayNameEn?: string;
  requiresOAuth?: boolean;
  readOnlySupported?: boolean;
  status?: ConnectorStatus;
}

export interface Credentials {
  /**
   * لا يتم تسجيل هذه البيانات.
   * لا تصل إلى Frontend.
   * لا تدخل Audit Logs.
   * تحفظ وتستخدم داخل Backend فقط.
   */
  readonly [key: string]: string | number | boolean | Uint8Array | undefined;
}

export interface ConnectionConfig extends Credentials {
  sourceId?: string;
  sourceType?: string;
  connectionName?: string;
  host?: string;
  port?: number;
  database?: string;
  user?: string;
  password?: string;
  ssl?: boolean;
  fileBuffer?: Uint8Array;
  fileName?: string;
  fileSize?: number;
  apiUrl?: string;
  apiKey?: string;
  accessToken?: string;
  refreshToken?: string;
  companyId?: string;
}

export type ErrorCode =
  | 'NO_SOURCE'
  | 'INSUFFICIENT_DATA'
  | 'SOURCE_UNREACHABLE'
  | 'AUTH_EXPIRED'
  | 'RATE_LIMITED'
  | 'SCHEMA_DRIFT'
  | 'TIMEOUT'
  | 'PARTIAL_DATA'
  | 'CONNECTOR_NOT_AVAILABLE';

export interface TestResult {
  ok: boolean;
  latencyMs: number;

  /**
   * يثبت أن الاتصال تم اختباره فعليًا.
   */
  verifiedAt: string;

  errorCode?: ErrorCode;
  message?: string;
  discoveredTablesCount?: number;
  readOnlyGuaranteed?: boolean;
}

export interface ConnectionVerificationResult {
  success: boolean;
  status: ConnectorStatus;
  message: string;
  readOnlyGuaranteed: boolean;
  discoveredTablesCount?: number;
  latencyMs?: number;
  error?: string;
  ok?: boolean;
  verifiedAt?: string;
}

export interface SchemaSnapshot {
  capturedAt: string;

  tables: Array<{
    name: string;

    columns: Array<{
      name: string;
      type: string;
      nullable: boolean;
    }>;

    /**
     * تقديري فقط.
     * لا يستخدم كرقم تجاري.
     */
    rowCountEstimate?: number;
  }>;

  /**
   * يستخدم لاكتشاف تغير بنية المصدر.
   */
  hash: string;
}

export interface DiscoveredColumn {
  name: string;
  dataType: string;
  isNullable: boolean;
}

export interface DiscoveredTable {
  name: string;
  columns: DiscoveredColumn[];
  rowCount?: number;
}

export interface RawSchemaDiscovery {
  tables: DiscoveredTable[];
  metadata?: {
    engine: string;
    version?: string;
    inspectedAt: string;
  };
}

export type BusinessConcept =
  | 'sales'
  | 'revenue'
  | 'product'
  | 'customer'
  | 'cost'
  | 'expense'
  | 'profit'
  | 'collection'
  | 'receivable'
  | 'inventory'
  | 'purchase'
  | 'cashflow';

export type SafeTransform =
  | 'NONE'
  | 'SUM'
  | 'COUNT'
  | 'AVG'
  | 'MIN'
  | 'MAX'
  | 'NORMALIZE_CURRENCY'
  | 'NORMALIZE_DATE'
  | 'NORMALIZE_AMOUNT';

export interface SemanticMapping {
  version: string;

  /**
   * يجب أن يكون الاعتماد من النظام أو مشرف مصرح.
   */
  approvedBy?: string;

  fields: Array<{
    businessConcept: BusinessConcept;

    sourceTable: string;
    sourceColumn: string;

    transform: SafeTransform;

    /**
     * 0..1
     * لا يعني أن البيانات صحيحة محاسبيًا،
     * بل يعبر عن ثقة المطابقة الدلالية.
     */
    confidence: number;
  }>;
}

export interface ROCheckItem {
  name: string;
  passed: boolean;
  detail: string;
}

export interface ROReport {
  isReadOnly: boolean;

  /**
   * هذه نتيجة تحقق فقط.
   * الإنفاذ الحقيقي يجب أن يكون في Connector/DB/API layer.
   */
  enforcementActive: boolean;

  checks: Array<{
    name: string;
    passed: boolean;
    detail: string;
  }>;
}

export interface DataPeriod {
  from: string;
  to: string;
  tz: string;
}

export interface Provenance {
  source_id: string;
  connector_id: string;

  source_ref: string;

  query_hash: string;

  fetched_at: string;

  transformation_chain: SafeTransform[];

  confidence: number;

  is_complete: boolean;
}

export interface ProvenancedValue<T = number> {
  value: T | null;

  unit: string | null;
  currency: string | null;

  period: DataPeriod | null;

  provenance: Provenance | null;

  is_complete: boolean;
}

export interface DataBatch {
  concept: BusinessConcept;

  period: DataPeriod;

  rows: Array<Record<string, unknown>>;

  provenance: Provenance;

  /**
   * عدد السجلات المقروءة فعليًا.
   * ليس تقديرًا.
   */
  actualRowCount: number;
}

export interface RawDataBatch {
  tableName: string;
  columns: string[];
  rows: Record<string, any>[];
  totalCount: number;
}

export interface HealthStatus {
  state: ConnectionState;
  lastCheck: string;

  /**
   * هل تم الاتصال والقراءة فعليًا؟
   */
  verified: boolean;
}

/**
 * Standard Connector Interface
 */
export interface Connector {
  meta(): ConnectorMeta;

  connect(creds: Credentials): Promise<ConnectionState>;

  testConnection(): Promise<TestResult>;

  discover(): Promise<SchemaSnapshot>;

  map(schema: SchemaSnapshot): Promise<SemanticMapping>;

  readOnlyCheck(): Promise<ROReport>;

  fetch(concept: BusinessConcept, period: DataPeriod): Promise<DataBatch>;

  health(): Promise<HealthStatus>;

  revoke(): Promise<void>;
}

// CompanyConnector interface for backward compatibility
export interface CompanyConnector {
  readonly metadata: ConnectorMetadata;
  readonly status: ConnectorStatus;
  readonly isConnected: boolean;
  readonly isReadOnlyGuaranteed: boolean;

  connect(config: ConnectionConfig): Promise<ConnectionVerificationResult>;
  disconnect(): Promise<void>;
  testConnection(): Promise<ConnectionVerificationResult>;
  discoverSchema(): Promise<RawSchemaDiscovery>;
  queryReadOnly(query: string, params?: any[]): Promise<any[]>;
  extractTableData(tableName: string, limit?: number): Promise<RawDataBatch>;
}
