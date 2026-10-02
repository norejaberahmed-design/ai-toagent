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
import * as XLSX from 'xlsx';
import { deterministicContentHash } from '../../engine/hash';

export class UniversalExcelConnector implements ConnectorInterface {
  public readonly metadata: SourceMetadata = {
    id: 'excel',
    displayNameAr: 'مصنف Microsoft Excel (.xlsx / .xls)',
    displayNameEn: 'Microsoft Excel Workbook',
    category: 'file',
    status: 'ready',
    requiresServerProxy: false,
    documentationUrl: 'https://docs.sheetjs.com/',
    descriptionAr: 'قراءة جداول المبيعات، المصروفات، والعملاء من أوراق العمل المتعددة داخل المتصفح بأمان تام.',
  };

  public readonly readOnlyPolicy: ReadOnlyPolicy = {
    isReadOnly: true,
    mechanism: 'In-Memory Pure File Parser (Read-Only Buffer)',
    forbiddenOperations: ['INSERT', 'UPDATE', 'DELETE', 'DROP', 'WRITE'],
    enforcementActive: true,
  };

  private workbook: XLSX.WorkBook | null = null;
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
        message: 'لم يتم توفير ملف مصنف Excel.',
        readOnlyGuaranteed: false,
        latencyMs: 0,
        businessStatus: 'disconnected',
      };
    }

    try {
      const wb = XLSX.read(config.fileBuffer, { type: 'array' });
      const sheetCount = wb.SheetNames.length;
      return {
        ok: sheetCount > 0,
        status: sheetCount > 0 ? 'connected' : 'failed',
        message: `تم فحص مصنف Excel واكتشاف ${sheetCount} صفحات عمل (${wb.SheetNames.join(', ')}).`,
        readOnlyGuaranteed: true,
        latencyMs: Date.now() - start,
        entitiesCount: sheetCount,
        businessStatus: sheetCount > 0 ? 'analyzable' : 'insufficient',
      };
    } catch (err: any) {
      return {
        ok: false,
        status: 'failed',
        message: err.message || 'الملف المقدم ليس مصنف Excel صالحاً.',
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
      this.workbook = XLSX.read(config.fileBuffer, { type: 'array' });
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
      this.workbook = null;
      return {
        ok: false,
        status: 'failed',
        message: err.message || 'تعذر تحميل صفحات مصنف Excel.',
        readOnlyGuaranteed: false,
        latencyMs: 0,
        businessStatus: 'disconnected',
      };
    }
  }

  public async discover(): Promise<DiscoveredEntity[]> {
    if (!this.workbook || !this.isConnected) {
      throw new Error('مصنف Excel غير متصل.');
    }

    const entities: DiscoveredEntity[] = [];

    for (const sheetName of this.workbook.SheetNames) {
      const ws = this.workbook.Sheets[sheetName];
      const rows: any[] = XLSX.utils.sheet_to_json(ws, { header: 1 });
      const headers: string[] = (rows[0] as string[]) || [];

      entities.push({
        name: sheetName,
        displayName: sheetName,
        fieldCount: headers.length,
        fields: headers.map((h, i) => ({
          name: String(h || `عمود_${i + 1}`),
          dataType: 'TEXT',
          nullable: true,
          isPrimaryKey: i === 0 && String(h).toLowerCase().includes('id'),
        })),
        rowCountEstimate: Math.max(0, rows.length - 1),
      });
    }

    this.entitiesCache = entities;
    return entities;
  }

  public async inspectStructure(entityName: string): Promise<EntityStructure> {
    const entity = this.entitiesCache.find((e) => e.name === entityName);
    if (!entity) throw new Error(`صفحة العمل ${entityName} غير موجودة.`);
    return {
      name: entity.name,
      fields: entity.fields,
      primaryKeys: entity.fields.filter((f) => f.isPrimaryKey).map((f) => f.name),
    };
  }

  public async read(entityName: string, options?: ReadOptions): Promise<EntityDataBatch> {
    if (!this.workbook || !this.isConnected) throw new Error('المصنف غير متصل.');

    const ws = this.workbook.Sheets[entityName];
    if (!ws) throw new Error(`صفحة العمل ${entityName} غير موجودة.`);

    let rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(ws);
    if (options?.limit) {
      rows = rows.slice(0, options.limit);
    }

    const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
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
    this.workbook = null;
    this.isConnected = false;
    this.entitiesCache = [];
  }
}
