/**
 * Multi-Tenant & Multi-Source Management Engine
 * Principle: الحقيقة قبل الذكاء (Truth Before Intelligence)
 *
 * Strict Multi-Tenant Isolation:
 * - Each tenant operates in an isolated context
 * - Zero cross-tenant data leakage or query bleeding
 * - Enforces TenantIsolationViolationError on any illegal access
 * - Supports multiple heterogeneous data sources per tenant
 */

import {
  Tenant,
  TenantSourceConfig,
  TenantAuthorizedSource,
  TenantIsolationViolationError,
  DataBatch,
  DataPeriod,
  BusinessConcept,
  BoundedFetchOptions,
} from './types';
import { adapterRegistry } from './adapter-registry';

export class MultiTenantManager {
  private tenants: Map<string, Tenant> = new Map();
  // Map of tenantId -> Map of sourceId -> TenantAuthorizedSource
  private tenantSources: Map<string, Map<string, TenantAuthorizedSource>> = new Map();
  // Reverse index to map sourceId -> tenantId for fast violation detection
  private sourceOwnershipIndex: Map<string, string> = new Map();

  constructor() {
    this.initializeDefaultTenants();
  }

  /**
   * Initializes starter demonstration tenants (Riyadh Retail & Jeddah Trading)
   */
  private initializeDefaultTenants() {
    this.createTenant({
      id: 'tenant_riyadh_enterprise',
      name: 'شركة أسواق الرياض الكبرى',
      code: 'RYD-01',
      currency: 'SAR',
      status: 'ACTIVE',
      description: 'سلسلة تجزئة بمصادر متعددة (نقاط بيع، قواعد بيانات، ومصنفات إكسل).',
    });

    this.createTenant({
      id: 'tenant_jeddah_trading',
      name: 'مؤسسة تجارة جدة المحدودة',
      code: 'JED-02',
      currency: 'SAR',
      status: 'ACTIVE',
      description: 'شركة استيراد وتوزيع جملة بمصادر CSV ومصنفات بيانات محاسبية.',
    });
  }

  /**
   * Create a new Tenant
   */
  public createTenant(tenantData: Partial<Tenant> & { id: string; name: string }): Tenant {
    if (!tenantData.id || !tenantData.id.trim()) {
      throw new Error('معرف الشركة (tenantId) مطلوب.');
    }

    if (this.tenants.has(tenantData.id)) {
      throw new Error(`معرف الشركة [${tenantData.id}] مسجل بالفعل.`);
    }

    const tenant: Tenant = {
      id: tenantData.id,
      name: tenantData.name,
      code: tenantData.code || tenantData.id.substring(0, 6).toUpperCase(),
      currency: tenantData.currency || 'SAR',
      status: tenantData.status || 'ACTIVE',
      createdAt: tenantData.createdAt || new Date().toISOString(),
      description: tenantData.description,
      allowedSourceTypes: tenantData.allowedSourceTypes,
      metadata: tenantData.metadata || {},
    };

    this.tenants.set(tenant.id, tenant);
    this.tenantSources.set(tenant.id, new Map());
    return tenant;
  }

  /**
   * Get a Tenant by ID
   */
  public getTenant(tenantId: string): Tenant {
    const tenant = this.tenants.get(tenantId);
    if (!tenant) {
      throw new Error(`الشركة المطلوبة [${tenantId}] غير موجودة في النظام.`);
    }
    return tenant;
  }

  /**
   * List all Tenants
   */
  public listTenants(): Tenant[] {
    return Array.from(this.tenants.values());
  }

  /**
   * Update Tenant details
   */
  public updateTenant(tenantId: string, updates: Partial<Tenant>): Tenant {
    const tenant = this.getTenant(tenantId);
    const updated: Tenant = {
      ...tenant,
      ...updates,
      id: tenant.id, // Immutable ID
    };
    this.tenants.set(tenantId, updated);
    return updated;
  }

  /**
   * Delete a Tenant and revoke all its sources
   */
  public async deleteTenant(tenantId: string): Promise<void> {
    const sources = this.tenantSources.get(tenantId);
    if (sources) {
      for (const [sourceId, authSource] of sources.entries()) {
        try {
          await authSource.adapter.revoke();
        } catch (_) {}
        this.sourceOwnershipIndex.delete(sourceId);
      }
      this.tenantSources.delete(tenantId);
    }
    this.tenants.delete(tenantId);
  }

  /**
   * Authorizes and registers a new data source strictly inside a tenant boundary
   */
  public async registerTenantSource(
    tenantId: string,
    sourceConfig: Omit<TenantSourceConfig, 'tenantId'>
  ): Promise<TenantAuthorizedSource> {
    const tenant = this.getTenant(tenantId);

    // Verify uniqueness of sourceId
    if (this.sourceOwnershipIndex.has(sourceConfig.sourceId)) {
      const owner = this.sourceOwnershipIndex.get(sourceConfig.sourceId);
      if (owner !== tenantId) {
        throw new TenantIsolationViolationError(tenantId, sourceConfig.sourceId, owner);
      }
      throw new Error(`المصدر [${sourceConfig.sourceId}] مسجل بالفعل لنفس الشركة.`);
    }

    // Instantiate appropriate adapter via registry
    const adapter = adapterRegistry.createAdapter(
      sourceConfig.adapterType,
      sourceConfig.sourceId,
      tenantId
    );

    // Attempt connecting adapter
    let connectionState = await adapter.connect(sourceConfig.credentials);

    const fullConfig: TenantSourceConfig = {
      ...sourceConfig,
      tenantId,
      addedAt: new Date().toISOString(),
    };

    const authSource: TenantAuthorizedSource = {
      sourceId: sourceConfig.sourceId,
      tenantId,
      adapterType: sourceConfig.adapterType,
      displayName: sourceConfig.displayName,
      adapter,
      config: fullConfig,
      status: connectionState,
      lastVerifiedAt: new Date().toISOString(),
    };

    const tenantSourcesMap = this.tenantSources.get(tenantId)!;
    tenantSourcesMap.set(sourceConfig.sourceId, authSource);
    this.sourceOwnershipIndex.set(sourceConfig.sourceId, tenantId);

    return authSource;
  }

  /**
   * Strict Tenant Isolation Verification
   */
  public verifyTenantAccess(tenantId: string, sourceId: string): void {
    const actualOwner = this.sourceOwnershipIndex.get(sourceId);
    if (!actualOwner) {
      throw new TenantIsolationViolationError(tenantId, sourceId);
    }
    if (actualOwner !== tenantId) {
      throw new TenantIsolationViolationError(tenantId, sourceId, actualOwner);
    }
  }

  /**
   * Get all sources authorized for a specific tenant
   */
  public getTenantSources(tenantId: string): TenantAuthorizedSource[] {
    this.getTenant(tenantId); // verifies existence
    const sourcesMap = this.tenantSources.get(tenantId);
    return sourcesMap ? Array.from(sourcesMap.values()) : [];
  }

  /**
   * Get a specific source for a tenant with strict isolation check
   */
  public getTenantSource(tenantId: string, sourceId: string): TenantAuthorizedSource {
    this.verifyTenantAccess(tenantId, sourceId);
    const sourcesMap = this.tenantSources.get(tenantId);
    const source = sourcesMap?.get(sourceId);
    if (!source) {
      throw new Error(`المصدر [${sourceId}] غير متاح للشركة [${tenantId}].`);
    }
    return source;
  }

  /**
   * Remove a source from a tenant
   */
  public async removeTenantSource(tenantId: string, sourceId: string): Promise<void> {
    this.verifyTenantAccess(tenantId, sourceId);
    const sourcesMap = this.tenantSources.get(tenantId);
    const source = sourcesMap?.get(sourceId);
    if (source) {
      try {
        await source.adapter.revoke();
      } catch (_) {}
      sourcesMap?.delete(sourceId);
      this.sourceOwnershipIndex.delete(sourceId);
    }
  }

  /**
   * Fetch data from a single tenant source with isolation guarantees
   */
  public async fetchTenantSourceData(
    tenantId: string,
    sourceId: string,
    concept: BusinessConcept,
    period: DataPeriod
  ): Promise<DataBatch> {
    const source = this.getTenantSource(tenantId, sourceId);
    return source.adapter.fetch(concept, period);
  }

  /**
   * Fetch data across all authorized sources of a tenant for a specific concept
   */
  public async fetchTenantMultiSourceData(
    tenantId: string,
    concept: BusinessConcept,
    period: DataPeriod
  ): Promise<DataBatch[]> {
    const sources = this.getTenantSources(tenantId);
    const batches: DataBatch[] = [];

    for (const source of sources) {
      try {
        const batch = await source.adapter.fetch(concept, period);
        batches.push(batch);
      } catch (err) {
        // Individual source errors do not corrupt the tenant batch array
        // (will be handled by P2 confidence weighting & provenance)
      }
    }

    return batches;
  }
}

export const tenantManager = new MultiTenantManager();
