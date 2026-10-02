import {
  ReconstructedBusinessEntities,
  ReconstructedInvoice,
  ReconstructedInvoiceLine,
  ReconstructedProduct,
  ReconstructedCustomer,
  RelationshipEvidence,
} from './types';
import { checkInvoiceTotalConsistency } from './consistency-checker';

export function reconstructBusinessEntities(
  tablesData: Record<string, Record<string, unknown>[]>,
  relationships: RelationshipEvidence[]
): ReconstructedBusinessEntities {
  const invoicesMap = new Map<string, ReconstructedInvoice>();
  const productsMap = new Map<string, ReconstructedProduct>();
  const customersMap = new Map<string, ReconstructedCustomer>();

  // Identify key tables from table profiles or names
  const tableNames = Object.keys(tablesData);

  // Find invoice header table (e.g. contains invoice_id / date / total)
  let invoiceHeaderTable: string | null = null;
  let invoiceLinesTable: string | null = null;
  let paymentsTable: string | null = null;
  let productsTable: string | null = null;
  let customersTable: string | null = null;

  for (const t of tableNames) {
    const tLower = t.toLowerCase();
    if (tLower.includes('line') || tLower.includes('detail') || tLower.includes('تفاصيل') || tLower.includes('بنود')) {
      invoiceLinesTable = t;
    } else if (tLower.includes('inv') || tLower.includes('order') || tLower.includes('فاتورة') || tLower.includes('طلب') || tLower.includes('sales')) {
      invoiceHeaderTable = t;
    } else if (tLower.includes('pay') || tLower.includes('receipt') || tLower.includes('سداد') || tLower.includes('تحصيل')) {
      paymentsTable = t;
    } else if (tLower.includes('prod') || tLower.includes('item') || tLower.includes('صنف') || tLower.includes('منتج')) {
      productsTable = t;
    } else if (tLower.includes('cust') || tLower.includes('client') || tLower.includes('عميل')) {
      customersTable = t;
    }
  }

  // Fallback: If only 1 table exists with transactions
  if (!invoiceHeaderTable && tableNames.length === 1) {
    invoiceHeaderTable = tableNames[0];
  }

  // 1. Process Invoice Headers
  if (invoiceHeaderTable && tablesData[invoiceHeaderTable]) {
    for (const r of tablesData[invoiceHeaderTable]) {
      const invId = String(r['invoice_id'] || r['id'] || r['inv_no'] || r['رقم_الفاتورة'] || r['doc_no'] || Math.random());
      const date = String(r['date'] || r['invoice_date'] || r['تاريخ'] || '');
      const custId = String(r['customer_id'] || r['client_id'] || r['رقم_العميل'] || '');
      const custName = String(r['customer_name'] || r['customer'] || r['اسم_العميل'] || custId);
      const recordedTotal = Number(r['total_amount'] || r['total'] || r['المبلغ'] || r['الإجمالي']);

      invoicesMap.set(invId, {
        invoiceId: invId,
        date: date || undefined,
        customerId: custId || undefined,
        customerName: custName || undefined,
        lines: [],
        recordedTotal: isNaN(recordedTotal) ? undefined : recordedTotal,
        computedLinesTotal: 0,
        payments: [],
        collectedTotal: 0,
        hasContradiction: false,
      });

      // Register customer
      if (custId || custName) {
        const cKey = custId || custName;
        const existingC = customersMap.get(cKey) || {
          customerId: custId || cKey,
          customerName: custName || cKey,
          invoiceCount: 0,
          totalSpent: 0,
          totalCollected: 0,
        };
        existingC.invoiceCount++;
        if (!isNaN(recordedTotal)) {
          existingC.totalSpent += recordedTotal;
        }
        customersMap.set(cKey, existingC);
      }
    }
  }

  // 2. Process Invoice Lines
  const linesSource = invoiceLinesTable ? tablesData[invoiceLinesTable] : (invoiceHeaderTable ? tablesData[invoiceHeaderTable] : []);
  if (linesSource) {
    for (const r of linesSource) {
      const invId = String(r['invoice_id'] || r['inv_no'] || r['رقم_الفاتورة'] || r['id'] || '');
      const prodId = String(r['product_id'] || r['item_id'] || r['كود_المنتج'] || r['id'] || 'PRD');
      const prodName = String(r['product_name'] || r['product'] || r['اسم_المنتج'] || r['item'] || prodId);
      const qty = Number(r['quantity'] || r['qty'] || r['الكمية'] || 1);
      const unitPrice = Number(r['unit_price'] || r['price'] || r['سعر_الوحدة'] || 0);
      let lineTotal = Number(r['total'] || r['sales_amount'] || r['المبلغ'] || 0);

      if (lineTotal === 0 && qty > 0 && unitPrice > 0) {
        lineTotal = qty * unitPrice;
      }

      const cost = Number(r['cost'] || r['cost_price'] || r['التكلفة'] || 0);

      const line: ReconstructedInvoiceLine = {
        productId: prodId,
        productName: prodName,
        quantity: isNaN(qty) ? 1 : qty,
        unitPrice: isNaN(unitPrice) ? 0 : unitPrice,
        total: isNaN(lineTotal) ? 0 : lineTotal,
        cost: isNaN(cost) || cost === 0 ? undefined : cost,
      };

      // Attach to invoice
      const invoice = invoicesMap.get(invId);
      if (invoice) {
        invoice.lines.push(line);
        invoice.computedLinesTotal += line.total;
        if (line.cost) {
          invoice.costTotal = (invoice.costTotal || 0) + line.cost;
        }
      }

      // Update product stats
      const pKey = prodId || prodName;
      const existingP = productsMap.get(pKey) || {
        productId: prodId,
        productName: prodName,
        totalSoldQuantity: 0,
        totalRevenue: 0,
      };
      existingP.totalSoldQuantity += line.quantity;
      existingP.totalRevenue += line.total;
      if (line.cost) {
        existingP.totalCost = (existingP.totalCost || 0) + line.cost;
      }
      productsMap.set(pKey, existingP);
    }
  }

  // 3. Process Payments
  if (paymentsTable && tablesData[paymentsTable]) {
    for (const r of tablesData[paymentsTable]) {
      const invId = String(r['invoice_id'] || r['رقم_الفاتورة'] || '');
      const amount = Number(r['amount'] || r['paid_amount'] || r['المبلغ'] || 0);
      const method = String(r['method'] || r['payment_method'] || r['طريقة_الدفع'] || '');

      const invoice = invoicesMap.get(invId);
      if (invoice && !isNaN(amount)) {
        invoice.payments.push({ amount, method });
        invoice.collectedTotal += amount;
      }
    }
  }

  // 4. Run Consistency Checks across all invoices
  let contradictionsCount = 0;
  for (const inv of invoicesMap.values()) {
    if (inv.recordedTotal !== undefined && inv.lines.length > 0) {
      const diff = Math.abs(inv.recordedTotal - inv.computedLinesTotal);
      if (diff > 0.05) {
        inv.hasContradiction = true;
        inv.contradictionReason = `القيمة المسجلة في الفاتورة (${inv.recordedTotal}) لا تتوافق مع مجموع تفاصيلها (${inv.computedLinesTotal}).`;
        contradictionsCount++;
      }
    }
  }

  return {
    invoices: Array.from(invoicesMap.values()).sort((a, b) => a.invoiceId.localeCompare(b.invoiceId)),
    products: Array.from(productsMap.values()).sort((a, b) => b.totalRevenue - a.totalRevenue),
    customers: Array.from(customersMap.values()).sort((a, b) => b.totalSpent - a.totalSpent),
    contradictionsCount,
  };
}
