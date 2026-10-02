import { describe, it } from 'node:test';
import * as XLSX from 'xlsx';
import {
  MultiTenantManager,
  TenantIsolationViolationError,
  PostgresAdapter,
  SQLiteAdapter,
  CSVAdapter,
  ExcelAdapter,
  adapterRegistry,
  MultiSourcePipeline,
} from '../../src/adapters';
import { createVerifiedPosTestDatabase } from '../../src/services/sqliteEngine';
import { DataPeriod } from '../../src/connectors/types';

const period2026: DataPeriod = {
  from: '2026-01-01T00:00:00Z',
  to: '2026-12-31T23:59:59Z',
  tz: 'Asia/Riyadh',
};

console.log('=============================================================');
console.log('--- STARTING P3.5 MULTI-TENANT & MULTI-SOURCE ADAPTERS TEST SUITE ---');
console.log('=============================================================');

async function runTests() {
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, message: string) {
    if (condition) {
      console.log(`  ✓ [PASS] ${message}`);
      passed++;
    } else {
      console.error(`  ✗ [FAIL] ${message}`);
      failed++;
      throw new Error(`Assertion failed: ${message}`);
    }
  }

  // -------------------------------------------------------------------------
  console.log('\nRunning Suite 1 — Multi-Tenant Isolation:');
  // -------------------------------------------------------------------------
  const manager = new MultiTenantManager();

  const tenantA = manager.createTenant({
    id: 'tenant_alnoor',
    name: 'مجموعة النور التجارية',
    code: 'ALN-01',
    currency: 'SAR',
  });

  const tenantB = manager.createTenant({
    id: 'tenant_alfajr',
    name: 'شركة الفجر للاستيراد',
    code: 'FJR-02',
    currency: 'SAR',
  });

  assert(tenantA.id === 'tenant_alnoor', 'Tenant A created with ID tenant_alnoor');
  assert(tenantB.id === 'tenant_alfajr', 'Tenant B created with ID tenant_alfajr');

  // Register source to Tenant A
  const posDbBuffer = await createVerifiedPosTestDatabase();
  const sourceA1 = await manager.registerTenantSource('tenant_alnoor', {
    sourceId: 'src_alnoor_pos',
    displayName: 'نقاط بيع النور - الفرع الرئيسي',
    adapterType: 'sqlite',
    category: 'file',
    credentials: {
      fileBuffer: posDbBuffer,
      fileName: 'alnoor_pos.sqlite',
    },
  });

  assert(sourceA1.sourceId === 'src_alnoor_pos', 'Source registered under Tenant A');
  assert(sourceA1.tenantId === 'tenant_alnoor', 'Source strictly bound to Tenant A');

  // Verify Tenant A can fetch its own source
  const sourceFetch = manager.getTenantSource('tenant_alnoor', 'src_alnoor_pos');
  assert(sourceFetch.sourceId === 'src_alnoor_pos', 'Tenant A can retrieve its own source');

  // Strict Isolation: Tenant B attempting to access Tenant A's source MUST throw
  let isolationViolationCaught = false;
  try {
    manager.getTenantSource('tenant_alfajr', 'src_alnoor_pos');
  } catch (err) {
    if (err instanceof TenantIsolationViolationError) {
      isolationViolationCaught = true;
    }
  }
  assert(isolationViolationCaught, 'Tenant B blocked from accessing Tenant A source with TenantIsolationViolationError');

  // Register source under Tenant B
  const csvData = 'رقم_الطلب,العميل,المبلغ,التاريخ\nORD-101,سعد,3200,2026-05-01\nORD-102,خالد,1800,2026-05-03';
  const sourceB1 = await manager.registerTenantSource('tenant_alfajr', {
    sourceId: 'src_alfajr_csv',
    displayName: 'سجلات مبيعات الفجر',
    adapterType: 'csv',
    category: 'file',
    credentials: {
      csvString: csvData,
      fileName: 'fajr_sales.csv',
    },
  });

  assert(sourceB1.sourceId === 'src_alfajr_csv', 'Source registered under Tenant B');

  // Isolation: Tenant A cannot access Tenant B's CSV source
  let isolationViolationB = false;
  try {
    manager.getTenantSource('tenant_alnoor', 'src_alfajr_csv');
  } catch (err) {
    if (err instanceof TenantIsolationViolationError) {
      isolationViolationB = true;
    }
  }
  assert(isolationViolationB, 'Tenant A blocked from accessing Tenant B source with TenantIsolationViolationError');

  // -------------------------------------------------------------------------
  console.log('\nRunning Suite 2 — SQLite Adapter:');
  // -------------------------------------------------------------------------
  const sqliteAdapter = new SQLiteAdapter('test_sqlite', 'tenant_alnoor');
  const sqliteConnState = await sqliteAdapter.connect({
    fileBuffer: posDbBuffer,
    fileName: 'pos_test.sqlite',
  });
  assert(sqliteConnState === 'CONNECTED', 'SQLite adapter connected to real database buffer');

  const sqliteTestRes = await sqliteAdapter.testConnection();
  assert(sqliteTestRes.ok === true, 'SQLite testConnection is ok');
  assert((sqliteTestRes.discoveredTablesCount || 0) >= 5, 'SQLite discovered real tables count >= 5');

  // Read-only check
  const sqliteRoReport = await sqliteAdapter.readOnlyCheck();
  assert(sqliteRoReport.isReadOnly === true, 'SQLite readOnlyCheck guarantees isReadOnly = true');
  assert(sqliteRoReport.enforcementActive === true, 'SQLite readOnlyCheck guarantees enforcementActive = true');

  // Discover schema
  const sqliteSchema = await sqliteAdapter.discover();
  assert(sqliteSchema.tables.length > 0, 'SQLite discovered tables');
  assert(typeof sqliteSchema.hash === 'string' && sqliteSchema.hash.length === 16, 'SQLite computed 16-char deterministic hash');

  // Determinism test: discovering again yields 100% byte-for-byte identical hash
  const sqliteSchemaAgain = await sqliteAdapter.discover();
  assert(sqliteSchema.hash === sqliteSchemaAgain.hash, 'SQLite schema hash is 100% deterministic');

  // Bounded fetch
  const sqliteSalesBatch = await sqliteAdapter.fetch('sales', period2026);
  assert(sqliteSalesBatch.concept === 'sales', 'SQLite fetch returns sales concept');
  assert(sqliteSalesBatch.actualRowCount > 0, 'SQLite fetch returns actual rows');
  assert(sqliteSalesBatch.provenance.source_id === 'test_sqlite', 'SQLite batch provenance records source_id');
  assert(sqliteSalesBatch.provenance.connector_id === 'sqlite', 'SQLite batch provenance records connector_id');

  // -------------------------------------------------------------------------
  console.log('\nRunning Suite 3 — CSV Adapter (Arabic, Quoting, Missing Values):');
  // -------------------------------------------------------------------------
  const csvAdapter = new CSVAdapter('test_csv', 'tenant_alnoor');

  // Complex CSV with Arabic text, quotes with commas, escaped quotes, missing values
  const richArabicCsv = [
    'رقم_الفاتورة,العميل,المنتج,الكمية,السعر,الإجمالي,ملاحظات',
    'INV-001,شركة "الأمل والريادة",شاشة 27 بوصة,2,1200,2400,تسليم فوري',
    'INV-002,"مؤسسة الأفق, للتجارة",طابعة ليزر,1,850,850,"عرض خاص ""مخفض"""',
    'INV-003,عميل نقدي,كابل توصيل,5,25,125,',
  ].join('\n');

  const csvConnState = await csvAdapter.connect({
    csvString: richArabicCsv,
    fileName: 'arabic_invoices.csv',
  });

  assert(csvConnState === 'CONNECTED', 'CSV adapter parsed Arabic CSV content successfully');

  const csvTestRes = await csvAdapter.testConnection();
  assert(csvTestRes.ok === true, 'CSV testConnection is ok');

  const csvRoReport = await csvAdapter.readOnlyCheck();
  assert(csvRoReport.isReadOnly === true, 'CSV adapter is strictly read-only');

  const csvSchema = await csvAdapter.discover();
  assert(csvSchema.tables[0].columns.length === 7, 'CSV discovered all 7 columns including Arabic headers');
  assert(csvSchema.tables[0].rowCountEstimate === 3, 'CSV detected exactly 3 rows');
  assert(typeof csvSchema.hash === 'string' && csvSchema.hash.length === 16, 'CSV computed 16-char deterministic hash');

  const csvBatch = await csvAdapter.fetch('sales', period2026);
  assert(csvBatch.actualRowCount === 3, 'CSV fetch returned exactly 3 rows');
  assert(csvBatch.rows[1]['العميل'] === 'مؤسسة الأفق, للتجارة', 'CSV handled comma inside quoted field');
  assert(csvBatch.rows[1]['ملاحظات'] === 'عرض خاص "مخفض"', 'CSV handled escaped quotes correctly');

  // -------------------------------------------------------------------------
  console.log('\nRunning Suite 4 — Excel Adapter (Multi-Sheet, Formulas, Types):');
  // -------------------------------------------------------------------------
  // Generate real Excel workbook in memory using SheetJS
  const wb = XLSX.utils.book_new();

  const salesSheetData = [
    { 'رقم_الطلب': 'SO-1001', 'العميل': 'شركة التقنية', 'المبلغ': 5000, 'الربح': 1500 },
    { 'رقم_الطلب': 'SO-1002', 'العميل': 'مكتب الرياض', 'المبلغ': 3200, 'الربح': 960 },
  ];
  const ws1 = XLSX.utils.json_to_sheet(salesSheetData);
  XLSX.utils.book_append_sheet(wb, ws1, 'المبيعات');

  const expensesSheetData = [
    { 'البند': 'إيجار المكتب', 'المبلغ': 4000, 'الجهة': 'المالك' },
    { 'البند': 'كهرباء ومياه', 'المبلغ': 650, 'الجهة': 'شركة الكهرباء' },
  ];
  const ws2 = XLSX.utils.json_to_sheet(expensesSheetData);
  XLSX.utils.book_append_sheet(wb, ws2, 'المصروفات');

  const excelBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

  const excelAdapter = new ExcelAdapter('test_excel', 'tenant_alnoor');
  const excelConnState = await excelAdapter.connect({
    fileBuffer: new Uint8Array(excelBuffer),
    fileName: 'company_accounts.xlsx',
  });
  assert(excelConnState === 'CONNECTED', 'Excel adapter connected and parsed multi-sheet workbook');

  const excelTestRes = await excelAdapter.testConnection();
  assert(excelTestRes.ok === true, 'Excel testConnection is ok');
  assert(excelTestRes.discoveredTablesCount === 2, 'Excel discovered 2 worksheets (المبيعات والمصروفات)');

  const excelSchema = await excelAdapter.discover();
  assert(excelSchema.tables.length === 2, 'Excel discovered 2 tables corresponding to sheets');
  assert(excelSchema.tables.some((t) => t.name === 'المبيعات'), 'Excel discovered sheet المبيعات');
  assert(excelSchema.tables.some((t) => t.name === 'المصروفات'), 'Excel discovered sheet المصروفات');
  assert(typeof excelSchema.hash === 'string' && excelSchema.hash.length === 16, 'Excel computed deterministic schema hash');

  const excelBatch = await excelAdapter.fetch('sales', period2026);
  assert(excelBatch.actualRowCount === 2, 'Excel fetch returned 2 sales rows');
  assert(excelBatch.rows[0]['المبلغ'] === 5000, 'Excel retrieved numeric cell value 5000');

  // -------------------------------------------------------------------------
  console.log('\nRunning Suite 5 — PostgreSQL Adapter (Read-Only Enforcement & BLOCKED_NO_ENV):');
  // -------------------------------------------------------------------------
  const pgAdapter = new PostgresAdapter('test_postgres', 'tenant_alnoor');

  // Honest handling: when connecting to non-existent postgres port, must return BLOCKED_NO_ENV or UNREACHABLE (never fake PASS)
  const pgConn = await pgAdapter.connect({
    host: '127.0.0.1',
    port: 54329, // port where no postgres runs
    database: 'fictional_db',
    user: 'test_user',
    password: 'password',
    connectionTimeoutMillis: 500,
  });

  assert(
    pgConn === 'BLOCKED_NO_ENV' || pgConn === 'UNREACHABLE',
    `Postgres adapter honestly returns ${pgConn} when no real server exists (no fake PASS)`
  );

  const pgTestRes = await pgAdapter.testConnection();
  assert(pgTestRes.ok === false, 'Postgres testConnection fails honestly when server is unreachable');
  assert(
    pgTestRes.message?.includes('BLOCKED_NO_ENV') || pgTestRes.errorCode === 'SOURCE_UNREACHABLE',
    'Postgres testConnection returns clear error message without faking connection'
  );

  // Read-only check on Postgres: tests that SQL Guard blocks write commands
  const pgRoReport = await pgAdapter.readOnlyCheck();
  assert(pgRoReport.checks.some((c) => c.passed && c.name.includes('SQL Guard')), 'Postgres SQL Guard blocks mutations');

  // -------------------------------------------------------------------------
  console.log('\nRunning Suite 6 — Unified Adapter Contract (All 9 Methods Conformance):');
  // -------------------------------------------------------------------------
  const allAdapters = [sqliteAdapter, csvAdapter, excelAdapter, pgAdapter];
  const requiredMethods = [
    'meta',
    'connect',
    'testConnection',
    'discover',
    'map',
    'readOnlyCheck',
    'fetch',
    'health',
    'revoke',
  ] as const;

  for (const adapter of allAdapters) {
    const meta = adapter.meta();
    for (const m of requiredMethods) {
      assert(typeof (adapter as any)[m] === 'function', `Adapter [${meta.id}] implements method ${m}()`);
    }
    const health = await adapter.health();
    assert(typeof health.state === 'string', `Adapter [${meta.id}] health() returns state (${health.state})`);
  }

  // -------------------------------------------------------------------------
  console.log('\nRunning Suite 7 — Extensible Registry:');
  // -------------------------------------------------------------------------
  assert(adapterRegistry.hasAdapter('postgresql'), 'Registry has postgresql');
  assert(adapterRegistry.hasAdapter('sqlite'), 'Registry has sqlite');
  assert(adapterRegistry.hasAdapter('csv'), 'Registry has csv');
  assert(adapterRegistry.hasAdapter('excel'), 'Registry has excel');
  assert(adapterRegistry.hasAdapter('odoo'), 'Registry has extensible placeholder for odoo');
  assert(adapterRegistry.hasAdapter('quickbooks'), 'Registry has extensible placeholder for quickbooks');

  // Placeholder adapter behavior
  const odooConnector = adapterRegistry.createAdapter('odoo', 'test_odoo', 'tenant_alnoor');
  assert(odooConnector.meta().status === 'UNIMPLEMENTED', 'Placeholder adapter reports UNIMPLEMENTED status');
  const odooConn = await odooConnector.connect({});
  assert(odooConn === 'BLOCKED_NO_ENV', 'Placeholder connector connect returns BLOCKED_NO_ENV');

  // -------------------------------------------------------------------------
  console.log('\nRunning Suite 8 — End-to-End Multi-Source Tenant Pipeline:');
  // -------------------------------------------------------------------------
  // Tenant with multiple simultaneous data sources (SQLite POS + CSV + Excel)
  const enterpriseTenant = manager.createTenant({
    id: 'tenant_alriyadh_corp',
    name: 'مؤسسة الرياض المتحدة',
    currency: 'SAR',
  });

  await manager.registerTenantSource('tenant_alriyadh_corp', {
    sourceId: 'src_pos',
    displayName: 'نقاط البيع',
    adapterType: 'sqlite',
    category: 'file',
    credentials: { fileBuffer: posDbBuffer, fileName: 'pos.sqlite' },
  });

  await manager.registerTenantSource('tenant_alriyadh_corp', {
    sourceId: 'src_csv',
    displayName: 'سجلات المبيعات الملحقة',
    adapterType: 'csv',
    category: 'file',
    credentials: {
      csvString: 'رقم_الفاتورة,المبلغ,التاريخ\nINV-901,4500,2026-06-10\nINV-902,5500,2026-06-12',
      fileName: 'extra_sales.csv',
    },
  });

  const pipeline = new MultiSourcePipeline(manager);
  const bundle = await pipeline.executeTenantPipeline('tenant_alriyadh_corp', period2026);

  assert(bundle.tenant.id === 'tenant_alriyadh_corp', 'Pipeline executed for correct tenant');
  assert(bundle.sourcesUsed.length === 2, 'Pipeline ingested from 2 authorized tenant sources');
  assert(bundle.rawBatches.length > 0, 'Pipeline collected verified DataBatches');
  assert(bundle.unifiedSnapshot.currency === 'SAR', 'Pipeline unified snapshot preserves tenant currency');
  assert(bundle.financialStatements.incomeStatement !== undefined, 'Pipeline generated P3.3 Income Statement');
  assert(bundle.financialStatements.balanceSheet !== undefined, 'Pipeline generated P3.3 Balance Sheet');
  assert(bundle.financialAnalysis.status !== undefined, 'Pipeline generated P3.3 Financial Analysis');

  console.log('=============================================================');
  console.log(`TEST SUITE RESULTS: ${passed} PASSED / ${failed} FAILED`);
  console.log('=============================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal error running tests:', err);
  process.exit(1);
});
