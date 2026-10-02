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
import Papa from 'papaparse';
import { deterministicContentHash } from '../../engine/hash';

export class UniversalCSVConnector implements ConnectorInterface {
  public readonly metadata: SourceMetadata = {
    id: 'csv',
    displayNameAr: 'ملف بيانات مجدولة CSV (.csv)',
    displayNameEn: 'Comma-Separated Values (CSV)',
    category: 'file',
    status: 'ready',
    requiresServerProxy: false,
    documentationUrl: 'https://www.papaparse.com/',
    descriptionAr: 'استيراد وفحص جداول CSV العربية والإنجليزية بدقة مع معالجة الفواصل والاقتباسات.',
  };

  public readonly readOnlyPolicy: ReadOnlyPolicy = {
    isReadOnly: true,
    mechanism: 'In-Memory Stream Parser (Pure Read-Only)',
    forbiddenOperations: ['INSERT', 'UPDATE', 'DELETE', 'DROP', 'WRITE'],
    enforcementActive: true,
  };

  private parsedData: { columns: string[]; rows: Record<string, unknown>[] } | null = null;
  private fileName = 'بيانات_CSV';
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
        message: 'لم يتم توفير ملف CSV.',
        readOnlyGuaranteed: false,
        latencyMs: 0,
        businessStatus: 'disconnected',
      };
    }

    try {
      const text = new TextDecoder('utf-8').decode(config.fileBuffer);
      const res = Papa.parse(text, { header: true, skipEmptyLines: true });
      const rowCount = res.data.length;
      const colCount = res.meta.fields?.length || 0;

      return {
        ok: rowCount > 0 && colCount > 0,
        status: rowCount > 0 ? 'connected' : 'failed',
        message: `تم تحليل ملف CSV بنجاح (${rowCount} صف، ${colCount} أعمدة).`,
        readOnlyGuaranteed: true,
        latencyMs: Date.now() - start,
        entitiesCount: 1,
        businessStatus: rowCount > 0 ? 'analyzable' : 'insufficient',
      };
    } catch (err: any) {
      return {
        ok: false,
        status: 'failed',
        message: err.message || 'فشل فحص ملف CSV.',
        readOnlyGuaranteed: false,
        latencyMs: Date.now() - start,
        businessStatus: 'disconnected',
      };
    }
  }

  public async connect(config: ConnectionConfig): Promise<ConnectionTestResult> {
    const testRes = await this.testConnection(config);
    if (!testRes.ok || !config.fileBuffer) return testRes;

    try {
      const text = new TextDecoder('utf-8').decode(config.fileBuffer);
      const res = Papa.parse(text, { header: true, skipEmptyLines: true });

      this.fileName = config.fileName?.replace(/\.csv$/i, '') || 'بيانات_CSV';
      this.parsedData = {
        columns: res.meta.fields || [],
        rows: res.data as Record<string, unknown>[],
      };
      this.isConnected = true;
      this.lastVerifiedAt = new Date().toISOString();

      await this.discover();

      return {
        ...testRes,
        entitiesCount: 1,
        businessStatus: this.parsedData.rows.length > 0 ? 'analyzable' : 'partial',
      };
    } catch (err: any) {
      this.isConnected = false;
      this.parsedData = null;
      return {
        ok: false,
        status: 'failed',
        message: err.message || 'تعذر استيعاب بيانات CSV.',
        readOnlyGuaranteed: false,
        latencyMs: 0,
        businessStatus: 'disconnected',
      };
    }
  }

  public async discover(): Promise<DiscoveredEntity[]> {
    if (!this.parsedData || !this.isConnected) {
      throw new Error('ملف CSV غير متصل.');
    }

    const cols = this.parsedData.columns.map((c, i) => ({
      name: c,
      dataType: 'TEXT',
      nullable: true,
      isPrimaryKey: i === 0 && c.toLowerCase().includes('id'),
    }));

    this.entitiesCache = [
      {
        name: this.fileName,
        displayName: this.fileName,
        fieldCount: cols.length,
        fields: cols,
        rowCountEstimate: this.parsedData.rows.length,
      },
    ];

    return this.entitiesCache;
  }

  public async inspectStructure(entityName: string): Promise<EntityStructure> {
    const entity = this.entitiesCache[0];
    if (!entity || entity.name !== entityName) {
      throw new Error(`الكيان ${entityName} غير موجود.`);
    }

    return {
      name: entity.name,
      fields: entity.fields,
      primaryKeys: entity.fields.filter((f) => f.isPrimaryKey).map((f) => f.name),
    };
  }

  public async read(entityName: string, options?: ReadOptions): Promise<EntityDataBatch> {
    if (!this.parsedData || !this.isConnected) {
      throw new Error('ملف CSV غير متصل.');
    }

    let rows = this.parsedData.rows;
    if (options?.limit) {
      rows = rows.slice(0, options.limit);
    }

    const readAt = new Date().toISOString();
    const auditHash = deterministicContentHash({
      entity: entityName,
      rowCount: rows.length,
      readAt,
    });

    return {
      entityName,
      columns: this.parsedData.columns,
      rows,
      totalRead: rows.length,
      readAt,
      auditHash,
    };
  }

  public async disconnect(): Promise<void> {
    this.parsedData = null;
    this.isConnected = false;
    this.entitiesCache = [];
  }
}
