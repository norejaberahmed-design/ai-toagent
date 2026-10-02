import {
  CompanyConnector,
  ConnectorMetadata,
  ConnectorStatus,
  ConnectionConfig,
  ConnectionVerificationResult,
  RawSchemaDiscovery,
  RawDataBatch,
} from './types';
import { SQLiteCompanySource } from '../services/sqliteEngine';
import { validateReadOnlyQuery } from '../services/sqlGuard';

export class SQLiteConnector implements CompanyConnector {
  public readonly metadata: ConnectorMetadata = {
    id: 'sqlite_file',
    name: 'ملف قاعدة بيانات SQLite (.db / .sqlite)',
    category: 'file',
    categoryLabel: 'الملفات وقواعد البيانات المحلية',
    description: 'قراءة وفحص ملفات SQLite المحلية مباشرة في بيئة معزولة ومحصنة للقراءة فقط 100%.',
    isImplemented: true,
    supportedFormats: ['.db', '.sqlite', '.sqlite3'],
  };

  private source: SQLiteCompanySource = new SQLiteCompanySource();
  private _status: ConnectorStatus = 'disconnected';

  public get status(): ConnectorStatus {
    return this._status;
  }

  public get isConnected(): boolean {
    return this.source.isConnected;
  }

  public get isReadOnlyGuaranteed(): boolean {
    return this.source.readOnlyVerified;
  }

  public get underlyingSource(): SQLiteCompanySource {
    return this.source;
  }

  public async connect(config: ConnectionConfig): Promise<ConnectionVerificationResult> {
    if (!config.fileBuffer || config.fileBuffer.length === 0) {
      this._status = 'insufficient_data';
      return {
        success: false,
        status: 'insufficient_data',
        message: 'لم يتم توفير بايتات صالحة لملف قاعدة البيانات.',
        readOnlyGuaranteed: false,
      };
    }

    try {
      const fileName = config.fileName || 'database.sqlite';
      await this.source.connect(config.fileBuffer, fileName);
      this._status = 'connected';

      const tables = this.source.getTables();
      return {
        success: true,
        status: 'connected',
        message: `تم ربط وتأمين قاعدة بيانات ${fileName} بنجاح بصيغة القراءة فقط.`,
        readOnlyGuaranteed: true,
        discoveredTablesCount: tables.length,
      };
    } catch (err: any) {
      this._status = 'disconnected';
      return {
        success: false,
        status: 'disconnected',
        message: err.message || 'تعذر فتح أو فحص ملف قاعدة البيانات.',
        readOnlyGuaranteed: false,
        error: String(err),
      };
    }
  }

  public async disconnect(): Promise<void> {
    this.source.disconnect();
    this._status = 'disconnected';
  }

  public async testConnection(): Promise<ConnectionVerificationResult> {
    if (!this.isConnected) {
      return {
        success: false,
        status: 'disconnected',
        message: 'المصدر غير متصل حالياً.',
        readOnlyGuaranteed: false,
      };
    }

    try {
      const tables = this.source.getTables();
      return {
        success: true,
        status: 'connected',
        message: 'الاتصال سليم ومفحوص بالكامل.',
        readOnlyGuaranteed: true,
        discoveredTablesCount: tables.length,
      };
    } catch (err: any) {
      return {
        success: false,
        status: 'needs_verification',
        message: err.message || 'فشل فحص الاتصال.',
        readOnlyGuaranteed: false,
      };
    }
  }

  public async discoverSchema(): Promise<RawSchemaDiscovery> {
    if (!this.isConnected) {
      throw new Error('المصدر غير متصل.');
    }

    const tables = this.source.getTables();
    const discoveredTables = tables.map((t) => {
      const columns = this.source.getTableColumns(t).map((c) => ({
        name: c.name,
        dataType: c.type,
        isNullable: true,
      }));
      let rowCount = 0;
      try {
        const countRes = this.source.executeQuery(`SELECT COUNT(*) as cnt FROM ${t}`);
        rowCount = Number(countRes[0]?.cnt) || 0;
      } catch (_) {}

      return {
        name: t,
        columns,
        rowCount,
      };
    });

    return {
      tables: discoveredTables,
      metadata: {
        engine: 'SQLite 3 (WASM Isolated Engine)',
        inspectedAt: new Date().toISOString(),
      },
    };
  }

  public async queryReadOnly(query: string, params: any[] = []): Promise<any[]> {
    validateReadOnlyQuery(query);
    return this.source.executeQuery(query, params);
  }

  public async extractTableData(tableName: string, limit: number = 1000): Promise<RawDataBatch> {
    // Prevent SQL injection in table name
    if (!/^[a-zA-Z0-9_]+$/.test(tableName)) {
      throw new Error('اسم الجدول غير صالح.');
    }

    const rows = await this.queryReadOnly(`SELECT * FROM ${tableName} LIMIT ${limit}`);
    const columns = rows.length > 0 ? Object.keys(rows[0]) : [];

    return {
      tableName,
      columns,
      rows,
      totalCount: rows.length,
    };
  }
}
