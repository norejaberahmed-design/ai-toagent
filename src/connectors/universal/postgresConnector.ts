import {
  ConnectorInterface,
  SourceMetadata,
  ReadOnlyPolicy,
  ConnectionConfig,
  ConnectionTestResult,
  DiscoveredEntity,
  EntityStructure,
  EntityDataBatch,
  SourceHealth,
  ReadOptions,
} from './types';
import { trpc } from '../../trpcClient';
import { deterministicContentHash } from '../../engine/hash';

export class UniversalPostgreSQLConnector implements ConnectorInterface {
  public readonly metadata: SourceMetadata = {
    id: 'postgresql',
    displayNameAr: 'خادم PostgreSQL العلائقي',
    displayNameEn: 'PostgreSQL Relational Server',
    category: 'sql_server',
    status: 'ready',
    requiresServerProxy: true,
    documentationUrl: 'https://www.postgresql.org/docs/',
    descriptionAr: 'الاتصال المباشر بخادم PostgreSQL بصلاحية القراءة فقط عبر backend proxy آمن مع حظر تام لأي تعديل.',
  };

  public readonly readOnlyPolicy: ReadOnlyPolicy = {
    isReadOnly: true,
    mechanism: 'SET default_transaction_read_only = on + Backend Session Check + SQL Guard',
    forbiddenOperations: ['INSERT', 'UPDATE', 'DELETE', 'DROP', 'ALTER', 'TRUNCATE', 'CREATE'],
    enforcementActive: true,
  };

  private sessionId: string | null = null;
  private isConnected = false;
  private lastVerifiedAt = '';
  private entitiesCache: DiscoveredEntity[] = [];

  public async health(): Promise<SourceHealth> {
    return {
      connected: this.isConnected,
      lastVerifiedAt: this.lastVerifiedAt,
      readOnlyConfirmed: this.isConnected,
      businessStatus: this.isConnected ? 'analyzable' : 'disconnected',
    };
  }

  public async testConnection(config: ConnectionConfig): Promise<ConnectionTestResult> {
    if (!config.host || !config.database || !config.user) {
      return {
        ok: false,
        status: 'failed',
        message: 'بيانات الاتصال غير مكتملة (المضيف، اسم قاعدة البيانات، واسم المستخدم مطلوبة).',
        readOnlyGuaranteed: false,
        latencyMs: 0,
        businessStatus: 'disconnected',
      };
    }

    try {
      const res = await trpc.connectors.testPostgres.mutate({
        host: config.host,
        port: config.port ? Number(config.port) : 5432,
        database: config.database,
        user: config.user,
        password: config.password,
        ssl: config.ssl ?? false,
      });

      return {
        ok: res.ok,
        status: res.status === 'connected' ? 'connected' : 'failed',
        message: res.message,
        readOnlyGuaranteed: res.readOnlyGuaranteed,
        latencyMs: res.latencyMs,
        entitiesCount: res.tablesCount,
        businessStatus: res.ok ? 'analyzable' : 'disconnected',
      };
    } catch (err: any) {
      return {
        ok: false,
        status: 'failed',
        message: err.message || 'تعذر الاتصال ببروكسي خادم PostgreSQL.',
        readOnlyGuaranteed: false,
        latencyMs: 0,
        businessStatus: 'disconnected',
      };
    }
  }

  public async connect(config: ConnectionConfig): Promise<ConnectionTestResult> {
    try {
      const res = await trpc.connectors.connectPostgres.mutate({
        host: config.host || '',
        port: config.port ? Number(config.port) : 5432,
        database: config.database || '',
        user: config.user || '',
        password: config.password,
        ssl: config.ssl ?? false,
      });

      this.sessionId = res.sessionId;
      this.isConnected = true;
      this.lastVerifiedAt = new Date().toISOString();

      // Discover entities automatically
      await this.discover();

      return {
        ok: true,
        status: 'connected',
        message: res.test.message,
        readOnlyGuaranteed: res.test.readOnlyGuaranteed,
        latencyMs: res.test.latencyMs,
        entitiesCount: this.entitiesCache.length,
        businessStatus: this.entitiesCache.length > 0 ? 'analyzable' : 'partial',
      };
    } catch (err: any) {
      this.isConnected = false;
      this.sessionId = null;
      return {
        ok: false,
        status: 'failed',
        message: err.message || 'فشل الاتصال وحجز جلسة PostgreSQL.',
        readOnlyGuaranteed: false,
        latencyMs: 0,
        businessStatus: 'disconnected',
      };
    }
  }

  public async discover(): Promise<DiscoveredEntity[]> {
    if (!this.sessionId || !this.isConnected) {
      throw new Error('الخادم غير متصل. يرجى الاتصال أولاً.');
    }

    const tables = await trpc.connectors.discoverPostgres.query({
      sessionId: this.sessionId,
    });

    this.entitiesCache = tables.map((t) => ({
      name: t.name,
      displayName: t.name,
      fieldCount: t.columns.length,
      fields: t.columns.map((c) => ({
        name: c.name,
        dataType: c.dataType,
        nullable: c.isNullable,
        isPrimaryKey: c.isPrimaryKey,
      })),
      rowCountEstimate: t.rowCountEstimate,
    }));

    return this.entitiesCache;
  }

  public async inspectStructure(entityName: string): Promise<EntityStructure> {
    const entity = this.entitiesCache.find((e) => e.name === entityName);
    if (!entity) {
      throw new Error(`الكيان ${entityName} غير موجود في المخطط المكتشف.`);
    }

    return {
      name: entity.name,
      fields: entity.fields,
      primaryKeys: entity.fields.filter((f) => f.isPrimaryKey).map((f) => f.name),
    };
  }

  public async read(entityName: string, options?: ReadOptions): Promise<EntityDataBatch> {
    if (!this.sessionId || !this.isConnected) {
      throw new Error('الخادم غير متصل.');
    }

    const res = await trpc.connectors.readPostgres.mutate({
      sessionId: this.sessionId,
      tableName: entityName,
      limit: options?.limit || 1000,
    });

    const readAt = new Date().toISOString();
    const auditHash = deterministicContentHash({
      entity: entityName,
      rowCount: res.rows.length,
      readAt,
    });

    return {
      entityName,
      columns: res.columns,
      rows: res.rows,
      totalRead: res.rows.length,
      readAt,
      auditHash,
    };
  }

  public async disconnect(): Promise<void> {
    if (this.sessionId) {
      await trpc.connectors.disconnectPostgres.mutate({ sessionId: this.sessionId }).catch(() => {});
    }
    this.sessionId = null;
    this.isConnected = false;
    this.entitiesCache = [];
  }
}
