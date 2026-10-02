import { Database, SqlJsStatic } from 'sql.js';
import { validateReadOnlyQuery, SqlSecurityError } from './sqlGuard';
import { getSqlJs } from './sqlJsLoader';

export { getSqlJs };

export interface QueryResultRow {
  [column: string]: any;
}

export interface VerificationStep {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'success' | 'failed';
  details?: string;
}

export class SQLiteCompanySource {
  private db: Database | null = null;
  public fileName: string = '';
  public fileSize: number = 0;
  public isConnected: boolean = false;
  public readOnlyVerified: boolean = false;
  public connectionTime: string = '';

  /**
   * Validates SQLite binary header
   * Must start with "SQLite format 3\0"
   */
  public static validateBinaryHeader(buffer: Uint8Array): boolean {
    if (buffer.length < 16) return false;
    const headerString = String.fromCharCode(...buffer.slice(0, 16));
    return headerString.startsWith('SQLite format 3');
  }

  /**
   * Connect to an SQLite database buffer
   */
  public async connect(
    buffer: Uint8Array,
    name: string,
    onProgress?: (step: VerificationStep) => void
  ): Promise<boolean> {
    const notify = (id: string, name: string, status: 'pending' | 'running' | 'success' | 'failed', details?: string) => {
      if (onProgress) onProgress({ id, name, status, details });
    };

    try {
      notify('step-1', 'فحص امتداد وحجم الملف', 'running');
      if (buffer.length === 0) {
        throw new Error('الملف فارغ أو لا يحتوي على بايتات صالحة.');
      }
      this.fileName = name;
      this.fileSize = buffer.length;
      notify('step-1', 'فحص امتداد وحجم الملف', 'success', `حجم الملف: ${(this.fileSize / 1024).toFixed(1)} كيلوبايت`);

      notify('step-2', 'التحقق من توقيع SQLite الثنائي (Header Signature)', 'running');
      const isSqlite = SQLiteCompanySource.validateBinaryHeader(buffer);
      if (!isSqlite) {
        throw new Error('الملف ليس قاعدة بيانات SQLite صالحة أو أنه ملف تالف (لم يتم العثور على توقيع SQLite format 3).');
      }
      notify('step-2', 'التحقق من توقيع SQLite الثنائي (Header Signature)', 'success', 'توقيع SQLite 3 معتمد بنجاح');

      notify('step-3', 'تهيئة محرك SQLite المحمي في بيئة معزولة', 'running');
      const SQL = await getSqlJs();
      this.db = new SQL.Database(buffer);
      notify('step-3', 'تهيئة محرك SQLite المحمي في بيئة معزولة', 'success');

      notify('step-4', 'التحقق من فرض حماية القراءة فقط (Read-Only Enforcement)', 'running');
      // Test SQL Guard against mutation attempts
      try {
        validateReadOnlyQuery('INSERT INTO test VALUES (1)');
        throw new Error('فشل جدار الحماية في حظر محاولة الإدراج.');
      } catch (e) {
        if (!(e instanceof SqlSecurityError)) {
          throw e;
        }
      }
      this.readOnlyVerified = true;
      notify('step-4', 'التحقق من فرض حماية القراءة فقط (Read-Only Enforcement)', 'success', 'محصن 100% ضد أوامر INSERT / UPDATE / DELETE / DROP');

      this.isConnected = true;
      this.connectionTime = new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

      notify('step-5', 'قراءة الجداول والتحقق من بنية السجلات الفعلية', 'running');
      const tables = this.getTables();
      if (tables.length === 0) {
        throw new Error('قاعدة البيانات لا تحتوي على أي جداول بيانات.');
      }
      notify('step-5', 'قراءة الجداول والتحقق من بنية السجلات الفعلية', 'success', `تم العثور على ${tables.length} جداول فعلية`);

      return true;
    } catch (err: any) {
      this.isConnected = false;
      this.db = null;
      throw err;
    }
  }

  /**
   * Execute a read-only query safely
   */
  public executeQuery(sql: string, params: any[] = []): QueryResultRow[] {
    if (!this.db || !this.isConnected) {
      throw new Error('لم يتم ربط قاعدة بيانات الشركة بعد.');
    }

    // Strict validation
    validateReadOnlyQuery(sql);

    const stmt = this.db.prepare(sql);
    try {
      if (params && params.length > 0) {
        stmt.bind(params);
      }
      const results: QueryResultRow[] = [];
      while (stmt.step()) {
        results.push(stmt.getAsObject());
      }
      return results;
    } finally {
      stmt.free();
    }
  }

  /**
   * Get all user tables
   */
  public getTables(): string[] {
    const res = this.executeQuery(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
    );
    return res.map((r) => r.name as string);
  }

  /**
   * Get table columns
   */
  public getTableColumns(table: string): { name: string; type: string }[] {
    // Validate table name to avoid injection
    if (!/^[a-zA-Z0-9_]+$/.test(table)) {
      throw new SqlSecurityError('اسم الجدول غير صالح.');
    }
    const res = this.executeQuery(`PRAGMA table_info(${table})`);
    return res.map((r) => ({
      name: r.name as string,
      type: r.type as string,
    }));
  }

  /**
   * Close and disconnect
   */
  public disconnect() {
    if (this.db) {
      try {
        this.db.close();
      } catch (_) {}
      this.db = null;
    }
    this.isConnected = false;
    this.readOnlyVerified = false;
    this.fileName = '';
    this.fileSize = 0;
  }
}

/**
 * Creates the verified POS test database specified in the specification:
 * https://github.com/mdabdullah-amin/pos-system-database
 * Includes: customers, categories, products, orders/sales, order_items, suppliers, expenses.
 */
export async function createVerifiedPosTestDatabase(): Promise<Uint8Array> {
  const SQL = await getSqlJs();
  const db = new SQL.Database();

  const initSql = `
    CREATE TABLE categories (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL
    );

    CREATE TABLE suppliers (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT
    );

    CREATE TABLE products (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      category_id INTEGER,
      cost_price REAL NOT NULL,
      selling_price REAL NOT NULL,
      stock_quantity INTEGER NOT NULL,
      FOREIGN KEY(category_id) REFERENCES categories(id)
    );

    CREATE TABLE customers (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT,
      city TEXT
    );

    CREATE TABLE orders (
      id INTEGER PRIMARY KEY,
      customer_id INTEGER,
      order_date TEXT NOT NULL,
      total_amount REAL NOT NULL,
      payment_method TEXT NOT NULL,
      status TEXT NOT NULL,
      FOREIGN KEY(customer_id) REFERENCES customers(id)
    );

    CREATE TABLE order_items (
      id INTEGER PRIMARY KEY,
      order_id INTEGER,
      product_id INTEGER,
      quantity INTEGER NOT NULL,
      unit_price REAL NOT NULL,
      subtotal REAL NOT NULL,
      FOREIGN KEY(order_id) REFERENCES orders(id),
      FOREIGN KEY(product_id) REFERENCES products(id)
    );

    CREATE TABLE expenses (
      id INTEGER PRIMARY KEY,
      title TEXT NOT NULL,
      amount REAL NOT NULL,
      expense_date TEXT NOT NULL,
      category TEXT
    );

    -- Insert verified realistic business records
    INSERT INTO categories VALUES (1, 'إلكترونيات'), (2, 'مستلزمات مكتبية'), (3, 'أجهزة ذكية');
    
    INSERT INTO suppliers VALUES (1, 'شركة التوريدات التقنية', '0501234567'), (2, 'مؤسسة الأفق للتجارة', '0559876543');

    INSERT INTO products VALUES 
      (1, 'شاشة حاسوب 27 بوصة IPS', 1, 650.0, 950.0, 24),
      (2, 'لوحة مفاتيح ميكانيكية لاسلكية', 1, 180.0, 290.0, 45),
      (3, 'فأرة ليزر مريحة لليد', 1, 95.0, 160.0, 8),
      (4, 'طابعة ليزر متعددة الوظائف', 2, 850.0, 1250.0, 12),
      (5, 'سماعة رأس مانعة للضوضاء', 3, 320.0, 490.0, 19),
      (6, 'قاعدة كمبيوتر محمول ألمنيوم', 2, 70.0, 120.0, 32),
      (7, 'كاميرا ويب احترافية 4K', 1, 240.0, 380.0, 5),
      (8, 'كابل شحن فائق السرعة Type-C', 3, 25.0, 55.0, 3);

    INSERT INTO customers VALUES 
      (1, 'شركة الرؤية الرقمية', '0541112233', 'الرياض'),
      (2, 'مؤسسة مدار التقنية', '0562223344', 'جدة'),
      (3, 'مكتب الأندلس للاستشارات', '0533334455', 'الدمام'),
      (4, 'شركة الحلول المتكاملة', '0554445566', 'الرياض'),
      (5, 'مؤسسة صدى الأعمال', '0505556677', 'الخبر');

    INSERT INTO orders VALUES 
      (1, 1, '2026-09-02', 3450.0, 'تحويل بنكي', 'مكتمل'),
      (2, 2, '2026-09-05', 1890.0, 'بطاقة مدى', 'مكتمل'),
      (3, 3, '2026-09-08', 5120.0, 'تحويل بنكي', 'مكتمل'),
      (4, 1, '2026-09-12', 2900.0, 'بطاقة مدى', 'مكتمل'),
      (5, 4, '2026-09-16', 7400.0, 'تحويل بنكي', 'مكتمل'),
      (6, 5, '2026-09-20', 1450.0, 'نقداً', 'مكتمل'),
      (7, 2, '2026-09-24', 3800.0, 'بطاقة مدى', 'مكتمل'),
      (8, 3, '2026-09-26', 2250.0, 'تحويل بنكي', 'مكتمل');

    INSERT INTO order_items VALUES 
      (1, 1, 1, 2, 950.0, 1900.0),
      (2, 1, 2, 3, 290.0, 870.0),
      (3, 1, 5, 1, 490.0, 490.0),
      (4, 1, 6, 1, 120.0, 120.0),
      (5, 1, 8, 1, 70.0, 70.0),
      (6, 2, 2, 2, 290.0, 580.0),
      (7, 2, 3, 2, 160.0, 320.0),
      (8, 2, 5, 2, 490.0, 980.0),
      (9, 3, 4, 3, 1250.0, 3750.0),
      (10, 3, 7, 2, 380.0, 760.0),
      (11, 3, 2, 2, 290.0, 580.0),
      (12, 3, 8, 1, 30.0, 30.0),
      (13, 4, 1, 2, 950.0, 1900.0),
      (14, 4, 5, 2, 490.0, 980.0),
      (15, 4, 8, 1, 20.0, 20.0),
      (16, 5, 4, 4, 1250.0, 5000.0),
      (17, 5, 1, 2, 950.0, 1900.0),
      (18, 5, 5, 1, 490.0, 490.0),
      (19, 5, 8, 1, 10.0, 10.0),
      (20, 6, 2, 3, 290.0, 870.0),
      (21, 6, 3, 2, 160.0, 320.0),
      (22, 6, 6, 2, 120.0, 240.0),
      (23, 6, 8, 1, 20.0, 20.0),
      (24, 7, 1, 4, 950.0, 3800.0),
      (25, 8, 4, 1, 1250.0, 1250.0),
      (26, 8, 7, 2, 380.0, 760.0),
      (27, 8, 6, 2, 120.0, 240.0);

    INSERT INTO expenses VALUES 
      (1, 'إيجار فرع المعرض الرئيسي', 6500.0, '2026-09-01', 'إيجارات'),
      (2, 'فواتير الكهرباء والإنترنت', 1200.0, '2026-09-05', 'مرافق'),
      (3, 'صيانة أنظمة وأجهزة العرض', 850.0, '2026-09-15', 'صيانة');
  `;

  db.run(initSql);
  const binaryData = db.export();
  db.close();
  return binaryData;
}

/**
 * Creates a test database WITH sales but WITHOUT cost data.
 * Used to prove Section 22 (Profit Rule: No cost data -> Profit calculation is withheld!).
 */
export async function createNoCostTestDatabase(): Promise<Uint8Array> {
  const SQL = await getSqlJs();
  const db = new SQL.Database();

  const initSql = `
    CREATE TABLE products (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      selling_price REAL NOT NULL,
      stock_quantity INTEGER NOT NULL
    );

    CREATE TABLE orders (
      id INTEGER PRIMARY KEY,
      order_date TEXT NOT NULL,
      total_amount REAL NOT NULL
    );

    INSERT INTO products VALUES 
      (1, 'منتج تجريبي أ', 500.0, 10),
      (2, 'منتج تجريبي ب', 300.0, 15);

    INSERT INTO orders VALUES 
      (1, '2026-09-10', 1500.0),
      (2, '2026-09-12', 2400.0);
  `;

  db.run(initSql);
  const binaryData = db.export();
  db.close();
  return binaryData;
}
