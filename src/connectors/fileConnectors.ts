import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import {
  CompanyConnector,
  ConnectorMetadata,
  ConnectorStatus,
  ConnectionConfig,
  ConnectionVerificationResult,
  RawSchemaDiscovery,
  RawDataBatch,
  DiscoveredTable,
} from './types';

/**
 * Excel Connector (.xlsx / .xls)
 * Parses real Excel worksheets into tabular business datasets.
 */
export class ExcelConnector implements CompanyConnector {
  public readonly metadata: ConnectorMetadata = {
    id: 'excel_file',
    name: 'جداول Excel (.xlsx / .xls)',
    category: 'file',
    categoryLabel: 'الملفات وقواعد البيانات المحلية',
    description: 'استيراد وفحص جداول المبيعات والمصروفات من مصنفات إكسل الفعلية.',
    isImplemented: true,
    supportedFormats: ['.xlsx', '.xls'],
  };

  private _status: ConnectorStatus = 'disconnected';
  private workbook: XLSX.WorkBook | null = null;
  private tablesData: Record<string, Record<string, any>[]> = {};
  public fileName: string = '';

  public get status(): ConnectorStatus {
    return this._status;
  }
  public get isConnected(): boolean {
    return this._status === 'connected';
  }
  public get isReadOnlyGuaranteed(): boolean {
    return true; // Memory parsed buffer cannot write back to source file
  }

  public async connect(config: ConnectionConfig): Promise<ConnectionVerificationResult> {
    if (!config.fileBuffer || config.fileBuffer.length === 0) {
      this._status = 'insufficient_data';
      return {
        success: false,
        status: 'insufficient_data',
        message: 'الملف فارغ أو لا يحتوي على محتوى صالح.',
        readOnlyGuaranteed: true,
      };
    }

    try {
      this.fileName = config.fileName || 'data.xlsx';
      this.workbook = XLSX.read(config.fileBuffer, { type: 'array' });
      this.tablesData = {};

      if (!this.workbook.SheetNames || this.workbook.SheetNames.length === 0) {
        throw new Error('مصنف Excel لا يحتوي على أي صفحات عمل صالحة.');
      }

      // Parse each sheet as a table
      for (const sheetName of this.workbook.SheetNames) {
        const worksheet = this.workbook.Sheets[sheetName];
        if (worksheet) {
          const rows = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, { defval: null });
          if (rows && rows.length > 0) {
            this.tablesData[sheetName] = rows;
          }
        }
      }

      const activeSheets = Object.keys(this.tablesData);
      if (activeSheets.length === 0) {
        throw new Error('صفحات مصنف Excel فارغة أو لا تحتوي على صفوف بيانات.');
      }

      this._status = 'connected';
      return {
        success: true,
        status: 'connected',
        message: `تم فحص مصنف Excel (${this.fileName}) بنجاح وقراءة ${activeSheets.length} صفحات عمل.`,
        readOnlyGuaranteed: true,
        discoveredTablesCount: activeSheets.length,
      };
    } catch (err: any) {
      this._status = 'disconnected';
      this.workbook = null;
      this.tablesData = {};
      return {
        success: false,
        status: 'disconnected',
        message: err.message || 'تعذر قراءة مصنف Excel.',
        readOnlyGuaranteed: true,
        error: String(err),
      };
    }
  }

  public async disconnect(): Promise<void> {
    this.workbook = null;
    this.tablesData = {};
    this._status = 'disconnected';
  }

  public async testConnection(): Promise<ConnectionVerificationResult> {
    if (!this.isConnected) {
      return {
        success: false,
        status: 'disconnected',
        message: 'مصنف Excel غير متصل حالياً.',
        readOnlyGuaranteed: true,
      };
    }
    return {
      success: true,
      status: 'connected',
      message: 'البيانات مفحوصة ومتاحة في الذاكرة بصيغة القراءة فقط.',
      readOnlyGuaranteed: true,
      discoveredTablesCount: Object.keys(this.tablesData).length,
    };
  }

  public async discoverSchema(): Promise<RawSchemaDiscovery> {
    if (!this.isConnected) throw new Error('المصدر غير متصل.');

    const tables: DiscoveredTable[] = Object.entries(this.tablesData).map(([sheetName, rows]) => {
      const sample = rows[0] || {};
      const columns = Object.keys(sample).map((key) => ({
        name: key,
        dataType: typeof sample[key] === 'number' ? 'NUMBER' : 'TEXT',
        isNullable: true,
      }));

      return {
        name: sheetName,
        columns,
        rowCount: rows.length,
      };
    });

    return {
      tables,
      metadata: {
        engine: 'Excel Workbook (SheetJS Engine)',
        inspectedAt: new Date().toISOString(),
      },
    };
  }

  public async queryReadOnly(query: string): Promise<any[]> {
    // In-memory query simulation for sheets
    return [];
  }

  public async extractTableData(tableName: string, limit: number = 1000): Promise<RawDataBatch> {
    if (!this.isConnected) throw new Error('المصدر غير متصل.');
    const rows = this.tablesData[tableName] || [];
    const sliced = rows.slice(0, limit);
    const columns = sliced.length > 0 ? Object.keys(sliced[0]) : [];

    return {
      tableName,
      columns,
      rows: sliced,
      totalCount: rows.length,
    };
  }
}

/**
 * CSV Connector
 * Parses real tabular CSV text with auto-delimiter detection.
 */
export class CSVConnector implements CompanyConnector {
  public readonly metadata: ConnectorMetadata = {
    id: 'csv_file',
    name: 'ملفات CSV المجدولة',
    category: 'file',
    categoryLabel: 'الملفات وقواعد البيانات المحلية',
    description: 'تحليل السجلات المصدرة من أي نظام تجاري بصيغة CSV القياسية.',
    isImplemented: true,
    supportedFormats: ['.csv'],
  };

  private _status: ConnectorStatus = 'disconnected';
  private rows: Record<string, any>[] = [];
  public fileName: string = '';

  public get status(): ConnectorStatus {
    return this._status;
  }
  public get isConnected(): boolean {
    return this._status === 'connected';
  }
  public get isReadOnlyGuaranteed(): boolean {
    return true;
  }

  public async connect(config: ConnectionConfig): Promise<ConnectionVerificationResult> {
    if (!config.fileBuffer || config.fileBuffer.length === 0) {
      this._status = 'insufficient_data';
      return {
        success: false,
        status: 'insufficient_data',
        message: 'الملف فارغ أو لا يحتوي على محتوى صالح.',
        readOnlyGuaranteed: true,
      };
    }

    try {
      this.fileName = config.fileName || 'data.csv';
      const textDecoder = new TextDecoder('utf-8');
      const csvString = textDecoder.decode(config.fileBuffer);

      const parsed = Papa.parse<Record<string, any>>(csvString, {
        header: true,
        skipEmptyLines: true,
        dynamicTyping: true,
      });

      if (parsed.errors && parsed.errors.length > 0 && parsed.data.length === 0) {
        throw new Error(`خطأ في هيكلة ملف CSV: ${parsed.errors[0]?.message}`);
      }

      this.rows = parsed.data;
      if (this.rows.length === 0) {
        throw new Error('ملف CSV فارغ ولا يحتوي على سجلات.');
      }

      this._status = 'connected';
      return {
        success: true,
        status: 'connected',
        message: `تم فحص ملف CSV (${this.fileName}) بنجاح وقراءة ${this.rows.length} سجل فعلي.`,
        readOnlyGuaranteed: true,
        discoveredTablesCount: 1,
      };
    } catch (err: any) {
      this._status = 'disconnected';
      this.rows = [];
      return {
        success: false,
        status: 'disconnected',
        message: err.message || 'تعذر قراءة ملف CSV.',
        readOnlyGuaranteed: true,
        error: String(err),
      };
    }
  }

  public async disconnect(): Promise<void> {
    this.rows = [];
    this._status = 'disconnected';
  }

  public async testConnection(): Promise<ConnectionVerificationResult> {
    if (!this.isConnected) {
      return {
        success: false,
        status: 'disconnected',
        message: 'ملف CSV غير متصل.',
        readOnlyGuaranteed: true,
      };
    }
    return {
      success: true,
      status: 'connected',
      message: `تم فحص الملف والبيانات جاهزة (${this.rows.length} سجل).`,
      readOnlyGuaranteed: true,
      discoveredTablesCount: 1,
    };
  }

  public async discoverSchema(): Promise<RawSchemaDiscovery> {
    if (!this.isConnected) throw new Error('المصدر غير متصل.');
    const sample = this.rows[0] || {};
    const columns = Object.keys(sample).map((key) => ({
      name: key,
      dataType: typeof sample[key] === 'number' ? 'NUMBER' : 'TEXT',
      isNullable: true,
    }));

    return {
      tables: [
        {
          name: this.fileName.replace(/\.[^/.]+$/, '') || 'records',
          columns,
          rowCount: this.rows.length,
        },
      ],
      metadata: {
        engine: 'CSV Parser (PapaParse Engine)',
        inspectedAt: new Date().toISOString(),
      },
    };
  }

  public async queryReadOnly(): Promise<any[]> {
    return this.rows;
  }

  public async extractTableData(tableName: string, limit: number = 1000): Promise<RawDataBatch> {
    if (!this.isConnected) throw new Error('المصدر غير متصل.');
    const sliced = this.rows.slice(0, limit);
    const columns = sliced.length > 0 ? Object.keys(sliced[0]) : [];

    return {
      tableName,
      columns,
      rows: sliced,
      totalCount: this.rows.length,
    };
  }
}
