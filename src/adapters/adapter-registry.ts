/**
 * Unified Adapter Registry & Factory
 * Principle: الحقيقة قبل الذكاء (Truth Before Intelligence)
 *
 * Provides extensible adapter registration:
 * - Pre-configured adapters for PostgreSQL, SQLite, CSV, Excel
 * - Clean extension points for MySQL, SQL Server, Oracle, Odoo, QuickBooks, etc.
 * - Central factory for instantiating isolated adapters per tenant & source
 */

import { Connector, ConnectorMeta, SourceCategory, AdapterRegistryEntry } from './types';
import { PostgresAdapter } from './postgres-adapter';
import { SQLiteAdapter } from './sqlite-adapter';
import { CSVAdapter } from './csv-adapter';
import { ExcelAdapter } from './excel-adapter';

class AdapterRegistryService {
  private registry: Map<string, AdapterRegistryEntry> = new Map();

  constructor() {
    this.registerCoreAdapters();
    this.registerExtensiblePlaceholders();
  }

  /**
   * Registers mandatory concrete adapters
   */
  private registerCoreAdapters() {
    // 1. PostgreSQL
    this.register({
      adapterType: 'postgresql',
      category: 'database',
      displayNameAr: 'خادم PostgreSQL العلائقي',
      displayNameEn: 'PostgreSQL Relational Server',
      factory: (sourceId, tenantId) => new PostgresAdapter(sourceId, tenantId),
      isImplemented: true,
      requiresServerProxy: true,
    });

    // 2. SQLite
    this.register({
      adapterType: 'sqlite',
      category: 'file',
      displayNameAr: 'ملف قاعدة بيانات SQLite المحلية',
      displayNameEn: 'SQLite Local Database',
      factory: (sourceId, tenantId) => new SQLiteAdapter(sourceId, tenantId),
      isImplemented: true,
      supportedFormats: ['.sqlite', '.db', '.sqlite3'],
    });

    // 3. CSV
    this.register({
      adapterType: 'csv',
      category: 'file',
      displayNameAr: 'ملفات CSV المجدولة',
      displayNameEn: 'CSV Delimited Records',
      factory: (sourceId, tenantId) => new CSVAdapter(sourceId, tenantId),
      isImplemented: true,
      supportedFormats: ['.csv', '.tsv', '.txt'],
    });

    // 4. Excel
    this.register({
      adapterType: 'excel',
      category: 'file',
      displayNameAr: 'جداول مصنفات Excel (.xlsx / .xls)',
      displayNameEn: 'Excel Workbook Worksheets',
      factory: (sourceId, tenantId) => new ExcelAdapter(sourceId, tenantId),
      isImplemented: true,
      supportedFormats: ['.xlsx', '.xls', '.xlsm'],
    });
  }

  /**
   * Registers placeholders for future enterprise connectors
   */
  private registerExtensiblePlaceholders() {
    const futureAdapters: Array<{
      type: string;
      category: SourceCategory;
      nameAr: string;
      nameEn: string;
    }> = [
      { type: 'mysql', category: 'database', nameAr: 'خادم MySQL / MariaDB', nameEn: 'MySQL / MariaDB' },
      { type: 'sqlserver', category: 'database', nameAr: 'خادم Microsoft SQL Server', nameEn: 'MS SQL Server' },
      { type: 'oracle', category: 'database', nameAr: 'قواعد بيانات Oracle المؤسسية', nameEn: 'Oracle Database' },
      { type: 'odoo', category: 'erp', nameAr: 'نظام أودو (Odoo ERP)', nameEn: 'Odoo ERP' },
      { type: 'quickbooks', category: 'erp', nameAr: 'QuickBooks Online', nameEn: 'QuickBooks Online' },
      { type: 'xero', category: 'erp', nameAr: 'Xero Accounting', nameEn: 'Xero Accounting' },
      { type: 'zoho_books', category: 'erp', nameAr: 'Zoho Books', nameEn: 'Zoho Books' },
      { type: 'sap_business_one', category: 'erp', nameAr: 'SAP Business One', nameEn: 'SAP Business One' },
      { type: 'pos', category: 'pos', nameAr: 'نقاط البيع المحلية (POS)', nameEn: 'Point of Sale' },
      { type: 'google_sheets', category: 'cloud', nameAr: 'جداول Google Sheets', nameEn: 'Google Sheets' },
    ];

    for (const item of futureAdapters) {
      this.register({
        adapterType: item.type,
        category: item.category,
        displayNameAr: item.nameAr,
        displayNameEn: item.nameEn,
        factory: (sourceId, _tenantId) => this.createPlaceholderConnector(item.type, item.category, item.nameAr, item.nameEn),
        isImplemented: false,
      });
    }
  }

  /**
   * Creates a placeholder connector that correctly reports UNIMPLEMENTED / BLOCKED_NO_ENV
   */
  private createPlaceholderConnector(type: string, category: SourceCategory, nameAr: string, nameEn: string): Connector {
    return {
      meta: (): ConnectorMeta => ({
        id: type,
        category,
        displayNameAr: nameAr,
        displayNameEn: nameEn,
        requiresOAuth: category === 'cloud' || category === 'erp',
        readOnlySupported: true,
        status: 'UNIMPLEMENTED',
      }),
      connect: async () => 'BLOCKED_NO_ENV',
      testConnection: async () => ({
        ok: false,
        latencyMs: 0,
        verifiedAt: new Date().toISOString(),
        errorCode: 'CONNECTOR_NOT_AVAILABLE',
        message: `المحول [${nameAr}] غير مفعل في هذه البيئة بعد (يتطلب تهيئة الاعتماد والمفتاح الخاص).`,
      }),
      discover: async () => {
        throw new Error(`المحول [${type}] غير متاح حالياً.`);
      },
      map: async () => ({ version: '1.0.0', fields: [] }),
      readOnlyCheck: async () => ({
        isReadOnly: true,
        enforcementActive: false,
        checks: [{ name: 'Placeholder', passed: false, detail: 'غير متصل' }],
      }),
      fetch: async () => {
        throw new Error(`لا يمكن جلب البيانات من المحول [${type}]: غير متصل.`);
      },
      health: async () => ({
        state: 'BLOCKED_NO_ENV',
        lastCheck: new Date().toISOString(),
        verified: false,
      }),
      revoke: async () => {},
    };
  }

  /**
   * Register a new or custom adapter dynamically
   */
  public register(entry: AdapterRegistryEntry): void {
    this.registry.set(entry.adapterType.toLowerCase(), entry);
  }

  /**
   * Check if an adapter type exists
   */
  public hasAdapter(type: string): boolean {
    return this.registry.has(type.toLowerCase());
  }

  /**
   * Create an adapter instance for a given tenant and source
   */
  public createAdapter(type: string, sourceId: string, tenantId: string): Connector {
    const entry = this.registry.get(type.toLowerCase());
    if (!entry) {
      throw new Error(`نوع المصدر غير معروف في السجل: ${type}`);
    }
    return entry.factory(sourceId, tenantId);
  }

  /**
   * Retrieve all registered adapter definitions
   */
  public listAdapters(): AdapterRegistryEntry[] {
    return Array.from(this.registry.values());
  }
}

export const adapterRegistry = new AdapterRegistryService();
