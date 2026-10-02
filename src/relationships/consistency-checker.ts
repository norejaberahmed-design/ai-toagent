export interface CrossTableContradiction {
  type: 'TOTAL_MISMATCH' | 'ORPHAN_RECORD' | 'INCOMPATIBLE_DATA';
  parentTable: string;
  parentId: string;
  parentRecordedValue: number;
  childTable: string;
  childComputedValue: number;
  difference: number;
  explanation: string;
}

export function checkInvoiceTotalConsistency(
  invoices: Array<{ id: string; recordedTotal?: number }>,
  linesByInvoice: Map<string, Array<{ lineTotal: number }>>
): CrossTableContradiction[] {
  const contradictions: CrossTableContradiction[] = [];

  for (const inv of invoices) {
    if (inv.recordedTotal === undefined || inv.recordedTotal === null) continue;

    const lines = linesByInvoice.get(inv.id) || [];
    if (lines.length === 0) continue;

    const sumLines = lines.reduce((acc, l) => acc + l.lineTotal, 0);

    // Tolerance check for float rounding
    const diff = Math.abs(inv.recordedTotal - sumLines);
    if (diff > 0.05) {
      contradictions.push({
        type: 'TOTAL_MISMATCH',
        parentTable: 'invoices',
        parentId: inv.id,
        parentRecordedValue: inv.recordedTotal,
        childTable: 'invoice_lines',
        childComputedValue: sumLines,
        difference: Number(diff.toFixed(2)),
        explanation: `القيمة المسجلة في الفاتورة (${inv.recordedTotal}) لا تتوافق مع مجموع تفاصيل بنودها (${sumLines}).`,
      });
    }
  }

  return contradictions;
}
