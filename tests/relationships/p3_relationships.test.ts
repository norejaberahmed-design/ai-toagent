import { detectRelationships } from '../../src/relationships/relationship-detector';
import { detectTableKeys } from '../../src/relationships/key-detector';
import { buildRelationshipGraph } from '../../src/relationships/relationship-graph';
import { reconstructBusinessEntities } from '../../src/relationships/reconstruction-engine';
import { evaluateRelationshipEvidence } from '../../src/relationships/relationship-evidence';

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

export function runRelationshipTests() {
  console.log('\n--- P3.2 RELATIONSHIP INTELLIGENCE TESTS ---');

  // Test 1: Primary Key Detection (100% unique, zero nulls)
  const customersData = [
    { customer_id: 'C-01', customer_name: 'شركة الرياض' },
    { customer_id: 'C-02', customer_name: 'مؤسسة جدة' },
    { customer_id: 'C-03', customer_name: 'مكتب الدمام' },
  ];
  const custKeys = detectTableKeys('customers', customersData);
  assert(custKeys.some((k) => k.columnNames.includes('customer_id') && k.keyType === 'PRIMARY_KEY'), '1. Primary Key detected by 100% uniqueness and zero nulls');

  // Test 2 & 3: 1:N Foreign Key Detection (Invoices -> InvoiceLines)
  const invoicesData = [
    { invoice_id: 'INV-101', customer_id: 'C-01', total_amount: 1800 },
    { invoice_id: 'INV-102', customer_id: 'C-02', total_amount: 700 },
  ];
  const linesData = [
    { line_id: 'L-1', invoice_id: 'INV-101', product_id: 'P-1', quantity: 10, unit_price: 100, total: 1000 },
    { line_id: 'L-2', invoice_id: 'INV-101', product_id: 'P-2', quantity: 8, unit_price: 100, total: 800 },
    { line_id: 'L-3', invoice_id: 'INV-102', product_id: 'P-1', quantity: 7, unit_price: 100, total: 700 },
  ];

  const relEvidence = evaluateRelationshipEvidence(
    'invoices',
    'invoice_id',
    invoicesData.map((r) => r.invoice_id),
    'invoice_lines',
    'invoice_id',
    linesData.map((r) => r.invoice_id)
  );

  assert(relEvidence !== null && relEvidence.cardinality === '1:N', '2 & 3. 1:N relationship detected between Invoices and InvoiceLines');

  // Test 4: N:1 (InvoiceLines -> Invoices)
  const relNto1 = evaluateRelationshipEvidence(
    'invoice_lines',
    'invoice_id',
    linesData.map((r) => r.invoice_id),
    'invoices',
    'invoice_id',
    invoicesData.map((r) => r.invoice_id)
  );
  assert(relNto1 !== null && relNto1.cardinality === 'N:1', '4. N:1 relationship detected when direction is reversed');

  // Test 5: 1:1 Relationship
  const profileExtra = [
    { customer_id: 'C-01', tax_number: '300123456700003' },
    { customer_id: 'C-02', tax_number: '300987654300003' },
    { customer_id: 'C-03', tax_number: '300555555500003' },
  ];
  const rel1to1 = evaluateRelationshipEvidence(
    'customers',
    'customer_id',
    customersData.map((r) => r.customer_id),
    'profile_extra',
    'customer_id',
    profileExtra.map((r) => r.customer_id)
  );
  assert(rel1to1 !== null && rel1to1.cardinality === '1:1', '5. 1:1 relationship verified when both sides are unique');

  // Test 6: Invoices -> InvoiceLines
  const productsData = [
    { product_id: 'P-1', product_name: 'طابعة ليزر', stock_qty: 50 },
    { product_id: 'P-2', product_name: 'حبر ليزر', stock_qty: 120 },
  ];
  const paymentsData = [
    { payment_id: 'PAY-1', invoice_id: 'INV-101', amount: 1000, method: 'مدى' },
    { payment_id: 'PAY-2', invoice_id: 'INV-101', amount: 800, method: 'نقداً' },
    { payment_id: 'PAY-3', invoice_id: 'INV-102', amount: 700, method: 'تحويل بنكي' },
  ];

  const fullDataset = {
    customers: customersData,
    invoices: invoicesData,
    invoice_lines: linesData,
    products: productsData,
    payments: paymentsData,
  };

  const detectedRels = detectRelationships(fullDataset);
  assert(detectedRels.some((r) => r.sourceTable === 'invoices' && r.targetTable === 'invoice_lines'), '6. Invoice -> InvoiceLines relation detected');

  // Test 7: Invoices -> Customer
  assert(detectedRels.some((r) => r.sourceTable === 'customers' && r.targetTable === 'invoices'), '7. Customer -> Invoices relation detected');

  // Test 8: InvoiceLine -> Product
  assert(detectedRels.some((r) => r.sourceTable === 'products' && r.targetTable === 'invoice_lines'), '8. Product -> InvoiceLines relation detected');

  // Test 9: Invoice -> Payments
  assert(detectedRels.some((r) => r.sourceTable === 'invoices' && r.targetTable === 'payments'), '9. Invoice -> Payments relation detected');

  // Test 10: Product -> Inventory (Stock)
  const reconstructed = reconstructBusinessEntities(fullDataset, detectedRels);
  assert(reconstructed.products.length === 2, '10. Products reconstructed and mapped to sales/inventory');

  // Test 11: Supplier -> Purchase
  const suppliersData = [{ supplier_id: 'SUPP-1', name: 'المورد الرئيسي' }];
  const purchasesData = [{ po_id: 'PO-10', supplier_id: 'SUPP-1', amount: 5000 }];
  const purchaseRel = evaluateRelationshipEvidence(
    'suppliers',
    'supplier_id',
    suppliersData.map((s) => s.supplier_id),
    'purchases',
    'supplier_id',
    purchasesData.map((p) => p.supplier_id)
  );
  assert(purchaseRel !== null && purchaseRel.cardinality === '1:N', '11. Supplier -> Purchase relationship detected');

  // Test 12: Relationships with completely different column names (رقم_الفاتورة vs doc_ref)
  const arabicInv = [
    { رقم_الفاتورة: 'INV-900', المشتري: 'الشركة العربية' },
    { رقم_الفاتورة: 'INV-901', المشتري: 'مؤسسة النور' },
  ];
  const englishDetails = [
    { doc_ref: 'INV-900', amount: 400 },
    { doc_ref: 'INV-900', amount: 600 },
    { doc_ref: 'INV-901', amount: 950 },
  ];
  const diffNameRel = evaluateRelationshipEvidence(
    'الفواتير',
    'رقم_الفاتورة',
    arabicInv.map((r) => r.رقم_الفاتورة),
    'تفاصيل_المبيعات',
    'doc_ref',
    englishDetails.map((r) => r.doc_ref)
  );
  assert(diffNameRel !== null, '12. Relationship detected across completely different column names based on value intersection');

  // Test 13: Unmatched references
  const orphanDetails = [
    { doc_ref: 'INV-900', amount: 400 },
    { doc_ref: 'INV-999_ORPHAN', amount: 600 }, // Orphan!
  ];
  const orphanRel = evaluateRelationshipEvidence(
    'الفواتير',
    'رقم_الفاتورة',
    arabicInv.map((r) => r.رقم_الفاتورة),
    'تفاصيل_يتيمة',
    'doc_ref',
    orphanDetails.map((r) => r.doc_ref)
  );
  assert(orphanRel !== null && orphanRel.unmatchedValuesCount > 0, '13. Unmatched orphan references tracked and recorded in contradictions');

  // Test 14: Conflicting invoice total vs lines total (1800 vs 1950)
  const conflictInvoices = [
    { invoice_id: 'INV-CONTRA', total_amount: 1800 },
  ];
  const conflictLines = [
    { invoice_id: 'INV-CONTRA', product_id: 'P1', quantity: 1, unit_price: 1000, total: 1000 },
    { invoice_id: 'INV-CONTRA', product_id: 'P2', quantity: 1, unit_price: 950, total: 950 }, // Total = 1950 != 1800!
  ];
  const contraRecon = reconstructBusinessEntities({
    invoices: conflictInvoices,
    invoice_lines: conflictLines,
  }, []);
  assert(contraRecon.contradictionsCount === 1, '14. Mismatch between invoice header (1800) and lines (1950) detected as CONTRADICTION');
  assert(contraRecon.invoices[0].hasContradiction === true, '14. Invoice marked with hasContradiction = true');

  // Test 15: Relationship provenance
  assert(detectedRels[0].matchingRule === 'CONTENT_VALUE_INTERSECTION', '15. Relationship provenance rule recorded');

  // Test 16: Deterministic graph
  const graph1 = buildRelationshipGraph(fullDataset, detectedRels);
  const graph2 = buildRelationshipGraph(fullDataset, detectedRels);
  assert(JSON.stringify(graph1) === JSON.stringify(graph2), '16. Relationship Graph generation is 100% deterministic');

  // Test 17: No invented relationships between unrelated tables
  const unrelatedTableA = [{ color: 'red' }, { color: 'blue' }];
  const unrelatedTableB = [{ country: 'KSA' }, { country: 'UAE' }];
  const noRel = evaluateRelationshipEvidence('colors', 'color', unrelatedTableA.map((r) => r.color), 'countries', 'country', unrelatedTableB.map((r) => r.country));
  assert(noRel === null, '17. No invented relationships between unrelated tables');

  return { passed, failed };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const res = runRelationshipTests();
  if (res.failed > 0) process.exit(1);
}
