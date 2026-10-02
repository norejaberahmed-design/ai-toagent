import { ConnectorInterface, SourceMetadata } from './types';
import { UniversalPostgreSQLConnector } from './postgresConnector';
import { UniversalMySQLConnector } from './mysqlConnector';
import { UniversalSQLiteConnector } from './sqliteConnector';
import { UniversalExcelConnector } from './excelConnector';
import { UniversalCSVConnector } from './csvConnector';
import {
  UniversalOdooConnector,
  UniversalQuickBooksConnector,
  UniversalZohoBooksConnector,
  UniversalWafeqConnector,
  UniversalQoyodConnector,
} from './apiAdapters';

export class UniversalConnectorRegistry {
  private static instance: UniversalConnectorRegistry;
  private connectors = new Map<string, () => ConnectorInterface>();

  private constructor() {
    this.registerDefaults();
  }

  public static getInstance(): UniversalConnectorRegistry {
    if (!UniversalConnectorRegistry.instance) {
      UniversalConnectorRegistry.instance = new UniversalConnectorRegistry();
    }
    return UniversalConnectorRegistry.instance;
  }

  private registerDefaults() {
    // 1. PostgreSQL (Real Proxy)
    this.register('postgresql', () => new UniversalPostgreSQLConnector());

    // 2. MySQL (Real Proxy)
    this.register('mysql', () => new UniversalMySQLConnector());

    // 3. SQLite (Real In-Browser Wasm)
    this.register('sqlite', () => new UniversalSQLiteConnector());

    // 4. Excel (Real In-Browser Parser)
    this.register('excel', () => new UniversalExcelConnector());

    // 5. CSV (Real In-Browser Parser)
    this.register('csv', () => new UniversalCSVConnector());

    // 6. Odoo ERP API (Adapter Architecture)
    this.register('odoo', () => new UniversalOdooConnector());

    // 7. QuickBooks API (Adapter Architecture)
    this.register('quickbooks', () => new UniversalQuickBooksConnector());

    // 8. Zoho Books API (Adapter Architecture)
    this.register('zohobooks', () => new UniversalZohoBooksConnector());

    // 9. Wafeq API (Adapter Architecture)
    this.register('wafeq', () => new UniversalWafeqConnector());

    // 10. Qoyod API (Adapter Architecture)
    this.register('qoyod', () => new UniversalQoyodConnector());
  }

  public register(id: string, factory: () => ConnectorInterface): void {
    this.connectors.set(id, factory);
  }

  public get(id: string): ConnectorInterface | null {
    const factory = this.connectors.get(id);
    if (!factory) return null;
    return factory();
  }

  public getAllMetadata(): SourceMetadata[] {
    const list: SourceMetadata[] = [];
    for (const factory of this.connectors.values()) {
      const conn = factory();
      list.push(conn.metadata);
    }
    return list;
  }

  public getSupportedIds(): string[] {
    return Array.from(this.connectors.keys());
  }
}

export const universalConnectorRegistry = UniversalConnectorRegistry.getInstance();
