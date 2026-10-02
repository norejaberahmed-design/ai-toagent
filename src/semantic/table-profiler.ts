import { profileField } from './field-profiler';
import { detectMathematicalRelations } from './pattern-detector';
import { detectFieldConceptCandidates } from './concept-candidates';
import {
  TableProfile,
  TablePatternType,
  TablePatternCandidate,
  VerificationStatus,
} from './types';

export function profileTable(
  tableName: string,
  rows: Record<string, unknown>[]
): TableProfile {
  const rowCount = rows.length;
  if (rowCount === 0) {
    return {
      tableName,
      rowCount: 0,
      fieldProfiles: {},
      fieldCandidates: {},
      primaryPattern: 'UNKNOWN',
      patternCandidates: [],
      mathematicalEvidences: [],
      candidateKeys: [],
      confidence: 0,
      status: 'UNRESOLVED',
    };
  }

  // 1. Extract all column names deterministically
  const columnSet = new Set<string>();
  for (const r of rows) {
    for (const k of Object.keys(r)) {
      columnSet.add(k);
    }
  }
  const columns = Array.from(columnSet).sort();

  // 2. Profile each field
  const fieldProfiles: Record<string, any> = {};
  const numericFields: string[] = [];

  for (const col of columns) {
    const values = rows.map((r) => r[col]);
    const p = profileField(col, values);
    fieldProfiles[col] = p;
    if (p.isNumeric) {
      numericFields.push(col);
    }
  }

  // 3. Mathematical relation detection (e.g. Qty * Price == Total)
  const mathematicalEvidences = detectMathematicalRelations(rows, numericFields);

  // 4. Detect field concept candidates
  const fieldCandidates: Record<string, any> = {};
  for (const col of columns) {
    fieldCandidates[col] = detectFieldConceptCandidates(
      fieldProfiles[col],
      mathematicalEvidences
    );
  }

  // 5. Candidate Keys detection (100% unique, 0% null)
  const candidateKeys: string[] = [];
  for (const col of columns) {
    const prof = fieldProfiles[col];
    if (prof.nullCount === 0 && prof.uniqueCount === rowCount && rowCount > 1) {
      candidateKeys.push(col);
    }
  }

  // 6. Detect Table Pattern ("Content > Relationships > Evidence > Names")
  const patternCandidates: TablePatternCandidate[] = [];

  // Check inventory content first (prompt rule: table named 'sales' with warehouse & stock is INVENTORY!)
  let hasStockField = false;
  let hasWarehouseOrInventory = false;
  for (const col of columns) {
    const colLower = col.toLowerCase();
    if (colLower.includes('stock') || colLower.includes('مخزون') || colLower.includes('رصيد')) {
      hasStockField = true;
    }
    if (colLower.includes('warehouse') || colLower.includes('مستودع') || colLower.includes('inventory')) {
      hasWarehouseOrInventory = true;
    }
  }

  if (hasStockField && (hasWarehouseOrInventory || !mathematicalEvidences.length)) {
    patternCandidates.push({
      pattern: 'INVENTORY',
      confidence: 0.92,
      evidence: ['المحتوى يحتوي على كميات المخزون وأرصدة المستودعات الفعلية'],
      contradictions: [],
    });
  }

  // Check Sales / Invoice Lines
  const hasMath = mathematicalEvidences.length > 0;
  const hasDate = columns.some((c) => fieldProfiles[c].isDate || fieldProfiles[c].isDateTime);
  const hasDocId = columns.some((c) => fieldProfiles[c].hasDocumentPattern);

  if (hasMath && (hasDate || hasDocId)) {
    patternCandidates.push({
      pattern: 'INVOICE_LINES',
      confidence: 0.95,
      evidence: [
        'إثبات رياضي لعلاقة الكمية وسعر الوحدة والإجمالي',
        'وجود معرّفات مستندات وتواريخ المعاملات',
      ],
      contradictions: [],
    });
    patternCandidates.push({
      pattern: 'SALES_TRANSACTIONS',
      confidence: 0.9,
      evidence: ['حركات مبيعات وفواتير مؤكدة رياضياً'],
      contradictions: [],
    });
  } else if (hasDate && numericFields.length >= 1) {
    // General sales or expense
    patternCandidates.push({
      pattern: 'SALES_TRANSACTIONS',
      confidence: 0.7,
      evidence: ['جدول زمني يحتوي على مبالغ مالية وتواريخ'],
      contradictions: [],
    });
  }

  // Check Master Data (Product or Customer)
  if (candidateKeys.length > 0 && !hasDate && rowCount > 0) {
    let hasNameCol = false;
    for (const c of columns) {
      if (c.toLowerCase().includes('name') || c.toLowerCase().includes('اسم')) {
        hasNameCol = true;
      }
    }
    if (hasNameCol) {
      patternCandidates.push({
        pattern: 'PRODUCT_MASTER',
        confidence: 0.65,
        evidence: ['جدول رئيسي ببيانات تعريفية فريدة وأسماء'],
        contradictions: [],
      });
    }
  }

  // Sort pattern candidates
  patternCandidates.sort((a, b) => b.confidence - a.confidence);

  const primary = patternCandidates[0] || {
    pattern: 'UNKNOWN' as TablePatternType,
    confidence: 0.2,
    evidence: ['لم تتوفر أدلة محتوى كافية لتصنيف نمط الجدول'],
    contradictions: [],
  };

  let status: VerificationStatus = 'UNRESOLVED';
  if (primary.confidence >= 0.85) status = 'HIGH_CONFIDENCE';
  else if (primary.confidence >= 0.6) status = 'PARTIAL';

  return {
    tableName,
    rowCount,
    fieldProfiles,
    fieldCandidates,
    primaryPattern: primary.pattern,
    patternCandidates,
    mathematicalEvidences,
    candidateKeys,
    primaryKeyCandidate: candidateKeys[0],
    confidence: primary.confidence,
    status,
  };
}
