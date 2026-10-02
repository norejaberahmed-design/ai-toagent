import * as XLSX from 'xlsx';
import { universalConnectorRegistry } from '../../src/connectors/universal/registry';
import { processUniversalConnectorData } from '../../src/connectors/universal/universalPipeline';
import { createVerifiedPosTestDatabase } from '../../src/services/sqliteEngine';

console.log('=============================================================');
console.log('--- STARTING UNIVERSAL APPLICATION CONNECTORS TEST SUITE ---');
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
  console.log('\nRunning Suite 1 — Connector Registry (All 10 Connectors):');
  // -------------------------------------------------------------------------
  const supportedIds = universalConnectorRegistry.getSupportedIds();
  assert(supportedIds.length === 10, `Registry contains all 10 connectors (found: ${supportedIds.length})`);

  const expectedIds = [
    'postgresql',
    'mysql',
    'sqlite',
    'excel',
    'csv',
    'odoo',
    'quickbooks',
    'zohobooks',
    'wafeq',
    'qoyod',
  ];

  for (const id of expectedIds) {
    const conn = universalConnectorRegistry.get(id);
    assert(conn !== null, `Connector [${id}] successfully retrieved from registry`);
    assert(conn!.metadata.id === id, `Connector [${id}] has matching metadata id`);
    assert(conn!.readOnlyPolicy.isReadOnly === true, `Connector [${id}] strictly enforces isReadOnly = true`);
    assert(
      conn!.readOnlyPolicy.forbiddenOperations.length > 0,
      `Connector [${id}] lists forbidden write/mutation operations`
    );
  }

  // -------------------------------------------------------------------------
  console.log('\nRunning Suite 2 — SQLite Universal Connector:');
  // -------------------------------------------------------------------------
  const sqliteConn = universalConnectorRegistry.get('sqlite')!;
  const testDbBuffer = await createVerifiedPosTestDatabase();

  const sqliteTestRes = await sqliteConn.testConnection({
    fileBuffer: testDbBuffer,
    fileName: 'pos_test.db',
  });
  assert(sqliteTestRes.ok === true, 'SQLite testConnection succeeds on real POS database');
  assert(sqliteTestRes.readOnlyGuaranteed === true, 'SQLite testConnection guarantees read-only');
  assert((sqliteTestRes.entitiesCount || 0) >= 5, `SQLite detected entities count >= 5 (found: ${sqliteTestRes.entitiesCount})`);

  const sqliteConnectRes = await sqliteConn.connect({
    fileBuffer: testDbBuffer,
    fileName: 'pos_test.db',
  });
  assert(sqliteConnectRes.ok === true, 'SQLite connect succeeds');
  assert(sqliteConnectRes.businessStatus === 'analyzable', 'SQLite business status is analyzable');

  const sqliteEntities = await sqliteConn.discover();
  assert(sqliteEntities.length >= 5, `SQLite discovered ${sqliteEntities.length} entities`);

  const productsEntity = sqliteEntities.find((e) => e.name === 'products');
  assert(productsEntity !== undefined, 'SQLite discovered products entity');
  assert(productsEntity!.fields.length >= 4, 'Products entity has fields (id, name, cost_price, selling_price, etc.)');

  const productsBatch = await sqliteConn.read('products', { limit: 10 });
  assert(productsBatch.rows.length > 0, `SQLite read returned ${productsBatch.rows.length} product rows`);
  assert(Boolean(productsBatch.auditHash), 'SQLite data batch contains deterministic auditHash');

  // Test Pipeline on SQLite
  const sqlitePipe = await processUniversalConnectorData(sqliteConn);
  assert(
    sqlitePipe.businessStatus === 'contradiction',
    'Universal pipeline correctly flagged business status as contradiction when line items mismatch header'
  );
  assert(sqlitePipe.hasContradictions === true, 'Contradictions detected and reported');
  assert(sqlitePipe.metrics.totalSales !== null && sqlitePipe.metrics.totalSales > 0, `Sales calculated: ${sqlitePipe.metrics.totalSales}`);

  await sqliteConn.disconnect();
  const sqliteHealthAfter = await sqliteConn.health();
  assert(sqliteHealthAfter.connected === false, 'SQLite disconnected cleanly');

  // -------------------------------------------------------------------------
  console.log('\nRunning Suite 3 — Excel Universal Connector:');
  // -------------------------------------------------------------------------
  const excelConn = universalConnectorRegistry.get('excel')!;
  const wb = XLSX.utils.book_new();
  const salesWs = XLSX.utils.json_to_sheet([
    { 'رقم الفاتورة': 'INV-1', 'العميل': 'شركة الفهد', 'المبلغ': 3500 },
    { 'رقم الفاتورة': 'INV-2', 'العميل': 'مؤسسة الرياض', 'المبلغ': 4200 },
  ]);
  const expensesWs = XLSX.utils.json_to_sheet([
    { 'البند': 'إيجار مستودع', 'القيمة': 1500 },
    { 'البند': 'فواتير كهرباء', 'القيمة': 800 },
  ]);
  XLSX.utils.book_append_sheet(wb, salesWs, 'المبيعات');
  XLSX.utils.book_append_sheet(wb, expensesWs, 'المصروفات');
  const excelBuffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });

  const excelConnectRes = await excelConn.connect({
    fileBuffer: excelBuffer,
    fileName: 'company_data.xlsx',
  });
  assert(excelConnectRes.ok === true, 'Excel connector parsed multi-sheet workbook');
  assert(excelConnectRes.entitiesCount === 2, 'Excel detected 2 sheets');

  const excelEntities = await excelConn.discover();
  assert(excelEntities.length === 2, 'Excel discovered 2 entities');
  assert(excelEntities.some((e) => e.name === 'المبيعات'), 'Excel discovered sheet المبيعات');

  const excelSalesBatch = await excelConn.read('المبيعات');
  assert(excelSalesBatch.rows.length === 2, 'Excel read returned 2 sales records');
  assert(excelSalesBatch.columns.includes('المبلغ'), 'Excel columns include المبلغ');

  const excelPipe = await processUniversalConnectorData(excelConn);
  assert(excelPipe.totalRecordsRead >= 2, `Excel pipeline read ${excelPipe.totalRecordsRead} records`);

  await excelConn.disconnect();

  // -------------------------------------------------------------------------
  console.log('\nRunning Suite 4 — CSV Universal Connector:');
  // -------------------------------------------------------------------------
  const csvConn = universalConnectorRegistry.get('csv')!;
  const csvContent = 'رقم_الطلب,اسم_العميل,المبلغ_الإجمالي,تاريخ\n101,"عميل، رئيسي",1250,2026-09-01\n102,"مؤسسة النور",2300,2026-09-02';
  const csvBuffer = new TextEncoder().encode(csvContent).buffer;

  const csvConnectRes = await csvConn.connect({
    fileBuffer: csvBuffer,
    fileName: 'sales_orders.csv',
  });
  assert(csvConnectRes.ok === true, 'CSV connector connected and parsed Arabic CSV');
  assert(csvConnectRes.businessStatus === 'analyzable', 'CSV status evaluated as analyzable');

  const csvBatch = await csvConn.read('sales_orders');
  assert(csvBatch.rows.length === 2, 'CSV read returned exactly 2 rows');

  await csvConn.disconnect();

  // -------------------------------------------------------------------------
  console.log('\nRunning Suite 5 — PostgreSQL & MySQL Universal Connectors (Proxy Integrity):');
  // -------------------------------------------------------------------------
  const pgConn = universalConnectorRegistry.get('postgresql')!;
  assert(pgConn.metadata.requiresServerProxy === true, 'PostgreSQL requiresServerProxy = true');

  // Honest failure when no server exists (no fake pass)
  const pgTestRes = await pgConn.testConnection({
    host: '127.0.0.1',
    port: 54999, // Unreachable port
    database: 'non_existent_db',
    user: 'test_user',
    password: 'wrong_password',
  });
  assert(pgTestRes.ok === false, 'PostgreSQL fails honestly when server unreachable (no fake PASS)');
  assert(pgTestRes.status === 'failed', 'PostgreSQL status === failed');

  const mysqlConn = universalConnectorRegistry.get('mysql')!;
  assert(mysqlConn.metadata.requiresServerProxy === true, 'MySQL requiresServerProxy = true');
  const mysqlTestRes = await mysqlConn.testConnection({
    host: '127.0.0.1',
    port: 33999, // Unreachable port
    database: 'non_existent_db',
    user: 'test_user',
    password: 'wrong_password',
  });
  assert(mysqlTestRes.ok === false, 'MySQL fails honestly when server unreachable (no fake PASS)');

  // -------------------------------------------------------------------------
  console.log('\nRunning Suite 6 — Application API Connectors (Odoo, QuickBooks, Zoho, Wafeq, Qoyod):');
  // -------------------------------------------------------------------------
  const apiConnectors = ['odoo', 'quickbooks', 'zohobooks', 'wafeq', 'qoyod'];
  for (const apiId of apiConnectors) {
    const conn = universalConnectorRegistry.get(apiId)!;
    assert(conn.metadata.status === 'adapter_ready', `API Connector [${apiId}] is marked adapter_ready`);
    assert(conn.readOnlyPolicy.isReadOnly === true, `API Connector [${apiId}] enforces isReadOnly = true`);

    const noCredsRes = await conn.testConnection({});
    assert(noCredsRes.ok === false, `API Connector [${apiId}] rejects connection when no credentials provided`);

    const credsRes = await conn.testConnection({ apiKey: 'sample_key_123' });
    assert(credsRes.ok === false, `API Connector [${apiId}] honestly states integration requirement without faking live connection`);
    assert(credsRes.message.includes('يتطلب الاتصال الفعلي'), `API Connector [${apiId}] provides clear Arabic explanation`);
  }

  console.log('\n=============================================================');
  console.log(`TEST SUITE RESULTS: ${passed} PASSED / ${failed} FAILED`);
  console.log('=============================================================');
}

runTests().catch((err) => {
  console.error('[Test Execution Error]', err);
  process.exit(1);
});
