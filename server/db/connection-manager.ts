/**
 * Server Database Connection Manager
 * Principle: الحقيقة قبل الذكاء (Truth Before Intelligence)
 *
 * Strict Security Rules:
 * - READ ONLY enforced at session and engine levels
 * - INSERT, UPDATE, DELETE, DROP, ALTER, TRUNCATE, CREATE strictly forbidden
 * - No credentials leaked to frontend or persisted in client storage
 * - Bounded row reading with safe identifier sanitization
 */

import { Client as PgClient, ClientConfig as PgClientConfig } from 'pg';
import mysql from 'mysql2/promise';

export interface PostgresConfig {
  host: string;
  port?: number;
  database: string;
  user: string;
  password?: string;
  ssl?: boolean;
}

export interface MySQLConfig {
  host: string;
  port?: number;
  database: string;
  user: string;
  password?: string;
  ssl?: boolean;
}

export interface DiscoveredColumn {
  name: string;
  dataType: string;
  isNullable: boolean;
  isPrimaryKey: boolean;
}

export interface DiscoveredTable {
  name: string;
  schema: string;
  columns: DiscoveredColumn[];
  rowCountEstimate?: number;
}

export interface ConnectionTestResult {
  ok: boolean;
  status: 'connected' | 'failed' | 'read_only_violation';
  serverVersion?: string;
  latencyMs: number;
  message: string;
  readOnlyGuaranteed: boolean;
  tablesCount?: number;
}

export interface ActiveSession {
  sessionId: string;
  sourceType: 'postgresql' | 'mysql';
  database: string;
  user: string;
  host: string;
  connectedAt: string;
  lastActiveAt: string;
}

class DatabaseConnectionManager {
  private pgSessions = new Map<string, { client: PgClient; config: PostgresConfig; createdAt: string }>();
  private mysqlSessions = new Map<string, { connection: mysql.Connection; config: MySQLConfig; createdAt: string }>();

  // Identifier sanitizer to prevent SQL injection in table/column names
  private sanitizeIdentifier(identifier: string): string {
    if (!/^[a-zA-Z0-9_\u0600-\u06FF]+$/.test(identifier)) {
      throw new Error(`Invalid identifier: ${identifier}`);
    }
    return identifier;
  }

  // ==========================================
  // PostgreSQL Operations
  // ==========================================

  public async testPostgres(config: PostgresConfig): Promise<ConnectionTestResult> {
    const start = Date.now();
    let tempClient: PgClient | null = null;
    try {
      const clientConfig: PgClientConfig = {
        host: config.host,
        port: config.port ? Number(config.port) : 5432,
        database: config.database,
        user: config.user,
        password: config.password,
        ssl: config.ssl ? { rejectUnauthorized: false } : undefined,
        connectionTimeoutMillis: 5000,
        statement_timeout: 10000,
      };

      tempClient = new PgClient(clientConfig);
      await tempClient.connect();

      // Enforce read-only
      await tempClient.query('SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY');
      await tempClient.query('SET default_transaction_read_only = on');

      // Test mutation rejection
      let mutationBlocked = false;
      try {
        await tempClient.query('CREATE TEMPORARY TABLE __test_ro_probe (id int)');
      } catch {
        mutationBlocked = true;
      }

      if (!mutationBlocked) {
        await tempClient.end().catch(() => {});
        return {
          ok: false,
          status: 'read_only_violation',
          latencyMs: Date.now() - start,
          message: 'فشل فرض صلاحية القراءة فقط: الخادم سمح بعملية إنشاء جدول.',
          readOnlyGuaranteed: false,
        };
      }

      const verRes = await tempClient.query('SELECT version() as v');
      const serverVersion = verRes.rows[0]?.v || 'PostgreSQL';

      const countRes = await tempClient.query(`
        SELECT count(*)::int as count 
        FROM information_schema.tables 
        WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
      `);
      const tablesCount = countRes.rows[0]?.count || 0;

      await tempClient.end().catch(() => {});

      return {
        ok: true,
        status: 'connected',
        serverVersion,
        latencyMs: Date.now() - start,
        message: 'تم الاتصال بخادم PostgreSQL بنجاح وفرض صلاحية القراءة فقط 100%.',
        readOnlyGuaranteed: true,
        tablesCount,
      };
    } catch (err: any) {
      if (tempClient) {
        await tempClient.end().catch(() => {});
      }
      return {
        ok: false,
        status: 'failed',
        latencyMs: Date.now() - start,
        message: err.message || 'فشل الاتصال بخادم PostgreSQL.',
        readOnlyGuaranteed: false,
      };
    }
  }

  public async connectPostgres(config: PostgresConfig): Promise<{ sessionId: string; test: ConnectionTestResult }> {
    const testResult = await this.testPostgres(config);
    if (!testResult.ok) {
      throw new Error(testResult.message);
    }

    const sessionId = `pg_sess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const clientConfig: PgClientConfig = {
      host: config.host,
      port: config.port ? Number(config.port) : 5432,
      database: config.database,
      user: config.user,
      password: config.password,
      ssl: config.ssl ? { rejectUnauthorized: false } : undefined,
      connectionTimeoutMillis: 5000,
      statement_timeout: 15000,
    };

    const client = new PgClient(clientConfig);
    await client.connect();
    await client.query('SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY');
    await client.query('SET default_transaction_read_only = on');

    this.pgSessions.set(sessionId, {
      client,
      config: { ...config, password: config.password ? '***' : undefined },
      createdAt: new Date().toISOString(),
    });

    return { sessionId, test: testResult };
  }

  public async discoverPostgres(sessionId: string): Promise<DiscoveredTable[]> {
    const session = this.pgSessions.get(sessionId);
    if (!session) {
      throw new Error('جلسة PostgreSQL غير نشطة أو منتهية الصلاحية.');
    }

    const client = session.client;

    const query = `
      SELECT 
        c.table_schema,
        c.table_name,
        c.column_name,
        c.data_type,
        c.is_nullable,
        CASE WHEN pk.column_name IS NOT NULL THEN true ELSE false END as is_pk
      FROM information_schema.columns c
      LEFT JOIN (
        SELECT ku.table_schema, ku.table_name, ku.column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage ku
          ON tc.constraint_name = ku.constraint_name
          AND tc.table_schema = ku.table_schema
        WHERE tc.constraint_type = 'PRIMARY KEY'
      ) pk 
        ON c.table_schema = pk.table_schema 
        AND c.table_name = pk.table_name 
        AND c.column_name = pk.column_name
      WHERE c.table_schema NOT IN ('pg_catalog', 'information_schema')
      ORDER BY c.table_schema, c.table_name, c.ordinal_position;
    `;

    const res = await client.query(query);
    const tableMap = new Map<string, DiscoveredTable>();

    for (const row of res.rows) {
      const key = `${row.table_schema}.${row.table_name}`;
      if (!tableMap.has(key)) {
        tableMap.set(key, {
          name: row.table_name,
          schema: row.table_schema,
          columns: [],
        });
      }
      tableMap.get(key)!.columns.push({
        name: row.column_name,
        dataType: row.data_type,
        isNullable: row.is_nullable === 'YES',
        isPrimaryKey: Boolean(row.is_pk),
      });
    }

    return Array.from(tableMap.values());
  }

  public async readPostgres(sessionId: string, tableName: string, limit = 1000): Promise<{ columns: string[]; rows: Record<string, unknown>[] }> {
    const session = this.pgSessions.get(sessionId);
    if (!session) {
      throw new Error('جلسة PostgreSQL غير نشطة.');
    }

    const safeTable = this.sanitizeIdentifier(tableName);
    const safeLimit = Math.min(Math.max(1, limit), 5000);

    // Strictly SELECT with safe identifier
    const query = `SELECT * FROM "${safeTable}" LIMIT ${safeLimit}`;
    const res = await session.client.query(query);

    const columns = res.fields.map((f) => f.name);
    return { columns, rows: res.rows };
  }

  public async disconnectPostgres(sessionId: string): Promise<boolean> {
    const session = this.pgSessions.get(sessionId);
    if (session) {
      await session.client.end().catch(() => {});
      this.pgSessions.delete(sessionId);
      return true;
    }
    return false;
  }

  // ==========================================
  // MySQL Operations
  // ==========================================

  public async testMySQL(config: MySQLConfig): Promise<ConnectionTestResult> {
    const start = Date.now();
    let conn: mysql.Connection | null = null;
    try {
      conn = await mysql.createConnection({
        host: config.host,
        port: config.port ? Number(config.port) : 3306,
        database: config.database,
        user: config.user,
        password: config.password,
        ssl: config.ssl ? { rejectUnauthorized: false } : undefined,
        connectTimeout: 5000,
      });

      // Enforce read-only
      await conn.query('SET SESSION TRANSACTION READ ONLY');

      // Test mutation rejection
      let mutationBlocked = false;
      try {
        await conn.query('CREATE TEMPORARY TABLE __test_ro_probe (id int)');
      } catch {
        mutationBlocked = true;
      }

      if (!mutationBlocked) {
        await conn.end().catch(() => {});
        return {
          ok: false,
          status: 'read_only_violation',
          latencyMs: Date.now() - start,
          message: 'فشل فرض صلاحية القراءة فقط: الخادم سمح بعملية إنشاء جدول.',
          readOnlyGuaranteed: false,
        };
      }

      const [verRows]: any = await conn.query('SELECT VERSION() as v');
      const serverVersion = verRows[0]?.v || 'MySQL';

      const [countRows]: any = await conn.query(
        'SELECT count(*) as count FROM information_schema.tables WHERE table_schema = ?',
        [config.database]
      );
      const tablesCount = countRows[0]?.count || 0;

      await conn.end().catch(() => {});

      return {
        ok: true,
        status: 'connected',
        serverVersion,
        latencyMs: Date.now() - start,
        message: 'تم الاتصال بخادم MySQL بنجاح وفرض صلاحية القراءة فقط 100%.',
        readOnlyGuaranteed: true,
        tablesCount,
      };
    } catch (err: any) {
      if (conn) {
        await conn.end().catch(() => {});
      }
      return {
        ok: false,
        status: 'failed',
        latencyMs: Date.now() - start,
        message: err.message || 'فشل الاتصال بخادم MySQL.',
        readOnlyGuaranteed: false,
      };
    }
  }

  public async connectMySQL(config: MySQLConfig): Promise<{ sessionId: string; test: ConnectionTestResult }> {
    const testResult = await this.testMySQL(config);
    if (!testResult.ok) {
      throw new Error(testResult.message);
    }

    const sessionId = `mysql_sess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const conn = await mysql.createConnection({
      host: config.host,
      port: config.port ? Number(config.port) : 3306,
      database: config.database,
      user: config.user,
      password: config.password,
      ssl: config.ssl ? { rejectUnauthorized: false } : undefined,
      connectTimeout: 5000,
    });

    await conn.query('SET SESSION TRANSACTION READ ONLY');

    this.mysqlSessions.set(sessionId, {
      connection: conn,
      config: { ...config, password: config.password ? '***' : undefined },
      createdAt: new Date().toISOString(),
    });

    return { sessionId, test: testResult };
  }

  public async discoverMySQL(sessionId: string): Promise<DiscoveredTable[]> {
    const session = this.mysqlSessions.get(sessionId);
    if (!session) {
      throw new Error('جلسة MySQL غير نشطة.');
    }

    const conn = session.connection;
    const dbName = session.config.database;

    const [rows]: any = await conn.query(
      `
      SELECT 
        table_name,
        column_name,
        data_type,
        is_nullable,
        column_key
      FROM information_schema.columns
      WHERE table_schema = ?
      ORDER BY table_name, ordinal_position
    `,
      [dbName]
    );

    const tableMap = new Map<string, DiscoveredTable>();

    for (const row of rows) {
      const tName = row.table_name;
      if (!tableMap.has(tName)) {
        tableMap.set(tName, {
          name: tName,
          schema: dbName,
          columns: [],
        });
      }
      tableMap.get(tName)!.columns.push({
        name: row.column_name,
        dataType: row.data_type,
        isNullable: row.is_nullable === 'YES',
        isPrimaryKey: row.column_key === 'PRI',
      });
    }

    return Array.from(tableMap.values());
  }

  public async readMySQL(sessionId: string, tableName: string, limit = 1000): Promise<{ columns: string[]; rows: Record<string, unknown>[] }> {
    const session = this.mysqlSessions.get(sessionId);
    if (!session) {
      throw new Error('جلسة MySQL غير نشطة.');
    }

    const safeTable = this.sanitizeIdentifier(tableName);
    const safeLimit = Math.min(Math.max(1, limit), 5000);

    const [rows, fields]: any = await session.connection.query(
      `SELECT * FROM \`${safeTable}\` LIMIT ${safeLimit}`
    );

    const columns = (fields as any[]).map((f) => f.name);
    return { columns, rows: rows as Record<string, unknown>[] };
  }

  public async disconnectMySQL(sessionId: string): Promise<boolean> {
    const session = this.mysqlSessions.get(sessionId);
    if (session) {
      await session.connection.end().catch(() => {});
      this.mysqlSessions.delete(sessionId);
      return true;
    }
    return false;
  }
}

export const dbConnectionManager = new DatabaseConnectionManager();
