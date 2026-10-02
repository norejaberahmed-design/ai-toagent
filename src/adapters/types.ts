/**
 * P3.5 Multi-Tenant & Multi-Source Unified Adapter Types
 * Principle: الحقيقة قبل الذكاء (Truth Before Intelligence)
 *
 * Strict Tenant Isolation + Unified Adapter Contract + Zero Cross-Tenant Leakage
 */

import {
  Connector,
  ConnectorMeta,
  ConnectionState,
  ConnectorStatus,
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
  SourceCategory,
} from '../connectors/types';

// Re-export core connector types so consumers have a unified import point
export type {
  Connector,
  ConnectorMeta,
  ConnectionState,
  ConnectorStatus,
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
  SourceCategory,
};

/**
 * Tenant Status Lifecycle
 */
export type TenantStatus = 'ACTIVE' | 'SUSPENDED' | 'ARCHIVED' | 'PROVISIONING';

/**
 * Organization / Tenant Entity
 */
export interface Tenant {
  id: string;
  name: string;
  code: string;
  currency: string;
  status: TenantStatus;
  createdAt: string;
  description?: string;
  allowedSourceTypes?: string[];
  metadata?: Record<string, unknown>;
}

/**
 * Authorized Source Configuration within a Tenant
 */
export interface TenantSourceConfig {
  sourceId: string;
  tenantId: string;
  adapterType: string;
  displayName: string;
  category: SourceCategory;
  credentials: Credentials;
  isPrimary?: boolean;
  priority?: number;
  addedAt?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Tenant Authorized Source Instance
 */
export interface TenantAuthorizedSource {
  sourceId: string;
  tenantId: string;
  adapterType: string;
  displayName: string;
  adapter: Connector;
  config: TenantSourceConfig;
  status: ConnectionState;
  lastVerifiedAt?: string;
  lastSchemaSnapshot?: SchemaSnapshot;
}

/**
 * Security Error raised on cross-tenant access attempts
 */
export class TenantIsolationViolationError extends Error {
  public readonly tenantId: string;
  public readonly attemptedSourceId: string;
  public readonly actualOwnerTenantId?: string;

  constructor(tenantId: string, attemptedSourceId: string, actualOwnerTenantId?: string) {
    const detail = actualOwnerTenantId
      ? `المصدر [${attemptedSourceId}] مملوك للشركة [${actualOwnerTenantId}] ولا يمكن الوصول إليه من الشركة [${tenantId}].`
      : `المصدر [${attemptedSourceId}] غير مصرح به للشركة [${tenantId}].`;
    super(`انتهاك عزل الشركات (Tenant Isolation Violation): ${detail}`);
    this.name = 'TenantIsolationViolationError';
    this.tenantId = tenantId;
    this.attemptedSourceId = attemptedSourceId;
    this.actualOwnerTenantId = actualOwnerTenantId;
  }
}

/**
 * Factory signature for creating adapters dynamically
 */
export type AdapterFactory = (sourceId: string, tenantId: string) => Connector;

/**
 * Adapter Registry Entry
 */
export interface AdapterRegistryEntry {
  adapterType: string;
  category: SourceCategory;
  displayNameAr: string;
  displayNameEn: string;
  factory: AdapterFactory;
  isImplemented: boolean;
  supportedFormats?: string[];
  requiresServerProxy?: boolean;
}

/**
 * Pagination & Bounded Fetch Options
 */
export interface BoundedFetchOptions {
  limit?: number;
  offset?: number;
  timeoutMs?: number;
}
