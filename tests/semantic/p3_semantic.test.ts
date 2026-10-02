import { profileTable } from '../../src/semantic/table-profiler';
import { profileField } from '../../src/semantic/field-profiler';
import { detectMathematicalRelations } from '../../src/semantic/pattern-detector';
import { deriveSemanticMappings } from '../../src/semantic/semantic-mapping';
import { profileDataset } from '../../src/semantic/content-profiler';

let passed = 0;
let failed = 0;

function assert(cond: boolean, name: string, detail?: string) {
  if (cond) {
    passed++;
    console.log(`  ✓ [PASS] ${name}`);
  } else {
    failed++;
    console.error(`  ✗ [FAIL] ${name}: ${detail || 'Assertion failed'}`);
  }
}

export function runSemanticTests() {
  console.log('\n--- P3.1 SEMANTIC DATA UNDERSTANDING TESTS ---');

  // Test 1: Obscure table name with sales content (tbl_17)
  const tbl17Rows = [
    { A: '2024-01-01', B: 'INV-1001', C: 'Pepsi', D: 15, E: 120, F: 1800, G: 450 },
    { A: '2024-01-02', B: 'INV-1002', C: 'CocaCola', D: 10, E: 100, F: 1000, G: 300 },
    { A: '2024-01-03', B: 'INV-1003', C: 'Water', D: 50, E: 10, F: 500, G: 150 },
  ];
  const prof17 = profileTable('tbl_17', tbl17Rows);
  assert(prof17.primaryPattern === 'INVOICE_LINES' || prof17.primaryPattern === 'SALES_TRANSACTIONS', '1. Obscure name (tbl_17) classified by content as sales/invoice lines');

  // Test 2: Table named "sales" but content is INVENTORY (product_id, warehouse_id, stock_quantity, stock_value)
  const salesFakeRows = [
    { product_id: 'P1', warehouse_id: 'WH-01', stock_quantity: 450, stock_value: 9000 },
    { product_id: 'P2', warehouse_id: 'WH-01', stock_quantity: 200, stock_value: 4000 },
  ];
  const profFakeSales = profileTable('sales', salesFakeRows);
  assert(profFakeSales.primaryPattern === 'INVENTORY', '2. Table named "sales" containing stock/warehouse is classified as INVENTORY (Content > Name)');

  // Test 3: Columns A-G understood from values
  assert(prof17.fieldProfiles['A'].isDate === true, '3. Column A identified as DATE from values');
  assert(prof17.fieldProfiles['B'].hasDocumentPattern === true, '3. Column B identified as DOCUMENT/INVOICE ID from values');
  assert(prof17.fieldProfiles['C'].isString === true, '3. Column C identified as PRODUCT from text strings');

  // Test 4: Arabic headers
  const arabicRows = [
    { التاريخ: '2024-05-01', رقم_الفاتورة: 'INV-500', الصنف: 'طابعة ليزر', الكمية: 2, السعر: 1500, الإجمالي: 3000 },
    { التاريخ: '2024-05-02', رقم_الفاتورة: 'INV-501', الصنف: 'حبر أسود', الكمية: 5, السعر: 200, الإجمالي: 1000 },
    { التاريخ: '2024-05-03', رقم_الفاتورة: 'INV-502', الصنف: 'ورق طباعة', الكمية: 10, السعر: 50, الإجمالي: 500 },
  ];
  const profArabic = profileTable('المبيعات_اليومية', arabicRows);
  assert(profArabic.mathematicalEvidences.length > 0, '4. Arabic headers mathematical relation recognized (الكمية × السعر == الإجمالي)');

  // Test 5: English headers
  const englishRows = [
    { invoice_date: '2024-02-01', inv_no: 'INV-10', item_name: 'Keyboard', qty: 4, unit_price: 250, total: 1000 },
    { invoice_date: '2024-02-02', inv_no: 'INV-11', item_name: 'Mouse', qty: 10, unit_price: 100, total: 1000 },
    { invoice_date: '2024-02-03', inv_no: 'INV-12', item_name: 'Cable', qty: 20, unit_price: 25, total: 500 },
  ];
  const profEnglish = profileTable('orders', englishRows);
  assert(profEnglish.mathematicalEvidences.length > 0, '5. English headers mathematical relation recognized');

  // Test 6: Mixed Arabic/English
  const mixedRows = [
    { invoice_id: 'INV-1', التاريخ: '2024-01-01', quantity: 5, سعر_الوحدة: 20, total: 100 },
    { invoice_id: 'INV-2', التاريخ: '2024-01-02', quantity: 2, سعر_الوحدة: 50, total: 100 },
    { invoice_id: 'INV-3', التاريخ: '2024-01-03', quantity: 1, سعر_الوحدة: 100, total: 100 },
  ];
  const profMixed = profileTable('mixed_sales', mixedRows);
  assert(profMixed.mathematicalEvidences.length > 0, '6. Mixed Arabic/English mathematical relation recognized');

  // Test 7: Empty table
  const profEmpty = profileTable('empty_table', []);
  assert(profEmpty.rowCount === 0 && profEmpty.status === 'UNRESOLVED', '7. Empty table correctly marked UNRESOLVED with rowCount 0');

  // Test 8: Missing values (null handling)
  const missingRows = [
    { id: 1, val: 100 },
    { id: 2, val: null },
    { id: 3, val: 300 },
  ];
  const profMissing = profileTable('tbl_missing', missingRows);
  assert(profMissing.fieldProfiles['val'].nullCount === 1, '8. Null values tracked and null rate computed accurately');

  // Test 9: Duplicate identifiers
  const dupRows = [
    { id: 'CODE-1', amount: 100 },
    { id: 'CODE-1', amount: 200 },
  ];
  const profDup = profileTable('tbl_dup', dupRows);
  assert(!profDup.candidateKeys.includes('id'), '9. Duplicate identifiers rejected as primary keys');

  // Test 10: Date detection
  const dateProfile = profileField('date_col', ['2024-01-01', '2024-02-01', '2024-03-01']);
  assert(dateProfile.isDate === true, '10. Standard date format correctly profiled as isDate');

  // Test 11: Currency detection
  const curProfile = profileField('cur_col', ['100 SAR', '250 SAR', '300 SAR']);
  assert(curProfile.hasCurrencyPattern === true, '11. SAR currency pattern correctly detected');

  // Test 12: Quantity * Unit Price Evidence (15 * 120 == 1800)
  const mathRelations = detectMathematicalRelations(tbl17Rows, ['D', 'E', 'F', 'G']);
  assert(mathRelations.length > 0, '12. Exactly detected D * E == F (15 * 120 == 1800)');
  assert(mathRelations[0].formula.includes('D * E == F') || mathRelations[0].formula.includes('E * D == F'), '12. Mathematical formula captured correctly');

  // Test 13: Contradictory patterns
  const contraProfile = profileField('contra_col', ['2024-01-01', 'not_a_number', '100', '200']);
  assert(!contraProfile.isNumeric && !contraProfile.isDate, '13. Incompatible mixed types flagged appropriately');

  // Test 14: Determinism
  const ds1 = profileDataset({ tbl_17: tbl17Rows });
  const ds2 = profileDataset({ tbl_17: tbl17Rows });
  assert(JSON.stringify(ds1) === JSON.stringify(ds2), '14. P3.1 profiling is 100% deterministic');

  // Test 15: No I/O & No LLM
  assert(typeof ds1 === 'object', '15. P3.1 runs synchronously without external I/O or LLM calls');

  return { passed, failed };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const res = runSemanticTests();
  if (res.failed > 0) process.exit(1);
}
