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
import { Database } from 'sql.js';
import { validateReadOnlyQuery } from '../../services/sqlGuard';
import { deterministicContentHash } from '../../engine/hash';
import { getSqlJs } from '../../services/sqlJsLoader';

export class UniversalSQLiteConnector implements ConnectorInterface {
  public readonly metadata: SourceMetadata = {
    id: 'sqlite',
    displayNameAr: 'ملف قاعدة بيانات SQLite (.db / .sqlite)',
    displayNameEn: 'SQLite Database File',
    category: 'file',
    status: 'ready',
    requiresServerProxy: false,
    documentationUrl: 'https://www.sqlite.org/docs.html',
    descriptionAr: 'قراءة حتمية وسريعة لملفات SQLite محلياً في المتصفح عبر WebAssembly مع حظر تام لأي تعديل.',
  };

  public readonly readOnlyPolicy: ReadOnlyPolicy = {
    isReadOnly: true,
    mechanism: 'In-Memory Wasm Sandbox + SQL Guard Read-Only Ast Validation',
    forbiddenOperations: ['INSERT', 'UPDATE', 'DELETE', 'DROP', 'ALTER', 'TRUNCATE', 'CREATE'],
    enforcementActive: true,
  };

  private db: Database | null = null;
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
    const start = Date.now();
    if (!config.fileBuffer) {
      return {
        ok: false,
        status: 'failed',
        message: 'لم يتم توفير ملف أو بيانات لقاعدة بيانات SQLite.',
        readOnlyGuaranteed: false,
        latencyMs: 0,
        businessStatus: 'disconnected',
      };
    }

    try {
      const SQL = await getSqlJs();
      const u8 = new Uint8Array(config.fileBuffer);
      const tempDb = new SQL.Database(u8);

      const res = tempDb.exec("SELECT count(*) as count FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'");
      const count = (res[0]?.values[0]?.[0] as number) || 0;
      tempDb.close();

      return {
        ok: true,
        status: 'connected',
        message: `تم فحص قاعدة بيانات SQLite بنجاح واكتشاف ${count} جداول.`,
        readOnlyGuaranteed: true,
        latencyMs: Date.now() - start,
        entitiesCount: count,
        businessStatus: count > 0 ? 'analyzable' : 'insufficient',
      };
    } catch (err: any) {
      return {
        ok: false,
        status: 'failed',
        message: err.message || 'الملف المقدم ليس قاعدة بيانات SQLite صالحة.',
        readOnlyGuaranteed: false,
        latencyMs: Date.now() - start,
        businessStatus: 'disconnected',
      };
    }
  }

  public async connect(config: ConnectionConfig): Promise<ConnectionTestResult> {
    const testRes = await this.testConnection(config);
    if (!testRes.ok || !config.fileBuffer) {
      return testRes;
    }

    try {
      const SQL = await getSqlJs();
      const u8 = new Uint8Array(config.fileBuffer);
      this.db = new SQL.Database(u8);
      this.isConnected = true;
      this.lastVerifiedAt = new Date().toISOString();

      await this.discover();

      return {
        ...testRes,
        entitiesCount: this.entitiesCache.length,
        businessStatus: this.entitiesCache.length > 0 ? 'analyzable' : 'partial',
      };
    } catch (err: any) {
      this.isConnected = false;
      this.db = null;
      return {
        ok: false,
        status: 'failed',
        message: err.message || 'تعذر فتح قاعدة بيانات SQLite.',
        readOnlyGuaranteed: false,
        latencyMs: 0,
        businessStatus: 'disconnected',
      };
    }
  }

  public async discover(): Promise<DiscoveredEntity[]> {
    if (!this.db || !this.isConnected) {
      throw new Error('قاعدة بيانات SQLite غير متصلة.');
    }

    const tablesRes = this.db.exec(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
    );

    const tables = tablesRes[0]?.values?.map((r) => String(r[0])) || [];
    const entities: DiscoveredEntity[] = [];

    for (const t of tables) {
      const colRes = this.db.exec(`PRAGMA table_info("${t}")`);
      const cols: DiscoveredEntity['fields'] = [];
      if (colRes[0]) {
        for (const row of colRes[0].values) {
          cols.push({
            name: String(row[1]),
            dataType: String(row[2] || 'TEXT'),
            nullable: Number(row[3]) === 0,
            isPrimaryKey: Number(row[5]) === 1,
          });
        }
      }

      entities.push({
        name: t,
        displayName: t,
        fieldCount: cols.length,
        fields: cols,
      });
    }

    this.entitiesCache = entities;
    return entities;
  }

  public async inspectStructure(entityName: string): Promise<EntityStructure> {
    const entity = this.entitiesCache.find((e) => e.name === entityName);
    if (!entity) {
      throw new Error(`الجدول ${entityName} غير موجود.`);
    }

    return {
      name: entity.name,
      fields: entity.fields,
      primaryKeys: entity.fields.filter((f) => f.isPrimaryKey).map((f) => f.name),
    };
  }

  public async read(entityName: string, options?: ReadOptions): Promise<EntityDataBatch> {
    if (!this.db || !this.isConnected) {
      throw new Error('قاعدة البيانات غير متصلة.');
    }

    const safeLimit = Math.min(Math.max(1, options?.limit || 1000), 5000);
    const sql = `SELECT * FROM "${entityName}" LIMIT ${safeLimit}`;
    validateReadOnlyQuery(sql);

    const res = this.db.exec(sql);
    const columns = res[0]?.columns || [];
    const rawRows = res[0]?.values || [];

    const rows = rawRows.map((r) => {
      const obj: Record<string, unknown> = {};
      columns.forEach((col, idx) => {
        obj[col] = r[idx];
      });
      return obj;
    });

    const readAt = new Date().toISOString();
    const auditHash = deterministicContentHash({
      entity: entityName,
      rowCount: rows.length,
      readAt,
    });

    return {
      entityName,
      columns,
      rows,
      totalRead: rows.length,
      readAt,
      auditHash,
    };
  }

  public async disconnect(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
    this.isConnected = false;
    this.entitiesCache = [];
  }
}
