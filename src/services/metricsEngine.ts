import { SQLiteCompanySource } from './sqliteEngine';
import { DataDiscoveryResult } from './discoveryEngine';

export interface MetricProvenance {
  metricKey: string;
  metricLabel: string;
  sourceTable: string;
  sqlQuery: string;
  calculatedValue: any;
  validationStatus: 'VALIDATED' | 'WITHHELD';
  reason?: string;
  timestamp: string;
  provenanceId: string;
}

export interface CompanyMetrics {
  totalSales: number | null;
  transactionCount: number | null;
  averageTransaction: number | null;
  totalExpenses: number | null;
  grossProfit: number | null;
  netProfit: number | null;
  profitMarginPercent: number | null;
  profitStatusMessage: string;
  topProducts: Array<{ id: number; name: string; soldQuantity: number; totalRevenue: number }>;
  slowMovingProducts: Array<{ id: number; name: string; stock: number; soldQuantity: number }>;
  topCustomers: Array<{ id: number; name: string; orderCount: number; totalSpent: number }>;
  paymentMethods: Array<{ method: string; count: number; totalAmount: number; percentage: number }>;
  inventoryItems: Array<{ id: number; name: string; stock: number; status: 'critical' | 'low' | 'normal' }>;
  provenanceRecords: MetricProvenance[];
}

export function calculateDeterministicMetrics(
  source: SQLiteCompanySource,
  discovery: DataDiscoveryResult
): CompanyMetrics {
  const now = new Date().toISOString();
  const provenance: MetricProvenance[] = [];

  const addProvenance = (
    key: string,
    label: string,
    table: string,
    query: string,
    val: any,
    status: 'VALIDATED' | 'WITHHELD' = 'VALIDATED',
    reason?: string
  ) => {
    const provId = `prov-${key}-${Math.random().toString(36).substring(2, 8)}`;
    provenance.push({
      metricKey: key,
      metricLabel: label,
      sourceTable: table,
      sqlQuery: query,
      calculatedValue: val,
      validationStatus: status,
      reason,
      timestamp: now,
      provenanceId: provId,
    });
  };

  let totalSales: number | null = null;
  let transactionCount: number | null = null;
  let averageTransaction: number | null = null;
  let totalExpenses: number | null = null;
  let grossProfit: number | null = null;
  let netProfit: number | null = null;
  let profitMarginPercent: number | null = null;
  let profitStatusMessage = discovery.capabilities.profitExplanation || '';

  // 1. Calculate Sales
  if (discovery.capabilities.salesSupported && discovery.entities.salesTable) {
    const table = discovery.entities.salesTable;
    const query = `SELECT SUM(total_amount) as total, COUNT(*) as cnt FROM ${table}`;
    const res = source.executeQuery(query);
    if (res.length > 0) {
      totalSales = Number(res[0].total) || 0;
      transactionCount = Number(res[0].cnt) || 0;
      averageTransaction = transactionCount > 0 ? totalSales / transactionCount : 0;

      addProvenance('totalSales', 'إجمالي المبيعات', table, query, totalSales);
      addProvenance('transactionCount', 'عدد المعاملات', table, query, transactionCount);
      addProvenance('averageTransaction', 'متوسط قيمة المعاملة', table, 'totalSales / transactionCount', averageTransaction);
    }
  }

  // 2. Calculate Expenses
  if (discovery.capabilities.expensesSupported && discovery.entities.expensesTable) {
    const table = discovery.entities.expensesTable;
    const query = `SELECT SUM(amount) as total FROM ${table}`;
    const res = source.executeQuery(query);
    if (res.length > 0 && res[0].total !== null) {
      totalExpenses = Number(res[0].total) || 0;
      addProvenance('totalExpenses', 'المصروفات', table, query, totalExpenses);
    }
  }

  // 3. Calculate Profitability ONLY when cost data exists
  if (discovery.capabilities.profitSupported && totalSales !== null) {
    // If order_items and products with cost_price exist
    if (discovery.entities.orderItemsTable && discovery.entities.productsTable) {
      const q = `
        SELECT 
          SUM(oi.quantity * p.cost_price) as total_cogs
        FROM ${discovery.entities.orderItemsTable} oi
        JOIN ${discovery.entities.productsTable} p ON oi.product_id = p.id
      `;
      const res = source.executeQuery(q);
      const totalCogs = Number(res[0]?.total_cogs) || 0;

      grossProfit = totalSales - totalCogs;
      profitMarginPercent = totalSales > 0 ? (grossProfit / totalSales) * 100 : 0;
      netProfit = totalExpenses !== null ? grossProfit - totalExpenses : grossProfit;

      addProvenance('grossProfit', 'إجمالي الربح', `${discovery.entities.orderItemsTable}, ${discovery.entities.productsTable}`, q, grossProfit);
      addProvenance('profitMargin', 'هامش الربح', 'حساب قطعي', 'grossProfit / totalSales * 100', profitMarginPercent);
    }
  } else {
    // Strictly withheld per Rule 22
    addProvenance(
      'profit',
      'الربح',
      'none',
      'withheld',
      null,
      'WITHHELD',
      'لا تتوفر بيانات تكلفة كافية لحساب الربح بدقة.'
    );
  }

  // 4. Calculate Top Products & Slow Moving Products
  const topProducts: CompanyMetrics['topProducts'] = [];
  const slowMovingProducts: CompanyMetrics['slowMovingProducts'] = [];

  if (discovery.capabilities.productsSupported && discovery.entities.productsTable) {
    const pTable = discovery.entities.productsTable;
    if (discovery.entities.orderItemsTable) {
      const oiTable = discovery.entities.orderItemsTable;
      const qTop = `
        SELECT 
          p.id,
          p.name,
          COALESCE(SUM(oi.quantity), 0) as soldQuantity,
          COALESCE(SUM(oi.subtotal), 0) as totalRevenue
        FROM ${pTable} p
        LEFT JOIN ${oiTable} oi ON p.id = oi.product_id
        GROUP BY p.id, p.name
        ORDER BY totalRevenue DESC
      `;
      const pRes = source.executeQuery(qTop);
      pRes.forEach((row: any) => {
        topProducts.push({
          id: Number(row.id),
          name: String(row.name),
          soldQuantity: Number(row.soldQuantity),
          totalRevenue: Number(row.totalRevenue),
        });
      });

      // Slow moving: least sold or low revenue
      const qSlow = `
        SELECT 
          p.id,
          p.name,
          p.stock_quantity as stock,
          COALESCE(SUM(oi.quantity), 0) as soldQuantity
        FROM ${pTable} p
        LEFT JOIN ${oiTable} oi ON p.id = oi.product_id
        GROUP BY p.id, p.name, p.stock_quantity
        ORDER BY soldQuantity ASC, p.stock_quantity DESC
        LIMIT 5
      `;
      const slowRes = source.executeQuery(qSlow);
      slowRes.forEach((row: any) => {
        slowMovingProducts.push({
          id: Number(row.id),
          name: String(row.name),
          stock: Number(row.stock),
          soldQuantity: Number(row.soldQuantity),
        });
      });
    }
  }

  // 5. Calculate Top Customers
  const topCustomers: CompanyMetrics['topCustomers'] = [];
  if (discovery.capabilities.customersSupported && discovery.entities.customersTable && discovery.entities.salesTable) {
    const cTable = discovery.entities.customersTable;
    const oTable = discovery.entities.salesTable;
    const qCust = `
      SELECT 
        c.id,
        c.name,
        COUNT(o.id) as orderCount,
        COALESCE(SUM(o.total_amount), 0) as totalSpent
      FROM ${cTable} c
      JOIN ${oTable} o ON c.id = o.customer_id
      GROUP BY c.id, c.name
      ORDER BY totalSpent DESC
      LIMIT 5
    `;
    const custRes = source.executeQuery(qCust);
    custRes.forEach((row: any) => {
      topCustomers.push({
        id: Number(row.id),
        name: String(row.name),
        orderCount: Number(row.orderCount),
        totalSpent: Number(row.totalSpent),
      });
    });
  }

  // 6. Calculate Payment Methods Breakdown
  const paymentMethods: CompanyMetrics['paymentMethods'] = [];
  if (discovery.capabilities.paymentsSupported && discovery.entities.salesTable) {
    const oTable = discovery.entities.salesTable;
    const qPay = `
      SELECT 
        payment_method as method,
        COUNT(*) as count,
        SUM(total_amount) as totalAmount
      FROM ${oTable}
      GROUP BY payment_method
      ORDER BY totalAmount DESC
    `;
    const payRes = source.executeQuery(qPay);
    const overallTotal = totalSales || 1;
    payRes.forEach((row: any) => {
      const amt = Number(row.totalAmount) || 0;
      paymentMethods.push({
        method: String(row.method || 'أخرى'),
        count: Number(row.count) || 0,
        totalAmount: amt,
        percentage: (amt / overallTotal) * 100,
      });
    });
  }

  // 7. Inventory Items status
  const inventoryItems: CompanyMetrics['inventoryItems'] = [];
  if (discovery.capabilities.inventorySupported && discovery.entities.productsTable) {
    const pTable = discovery.entities.productsTable;
    const qInv = `SELECT id, name, stock_quantity as stock FROM ${pTable} ORDER BY stock_quantity ASC`;
    const invRes = source.executeQuery(qInv);
    invRes.forEach((row: any) => {
      const stock = Number(row.stock);
      let status: 'critical' | 'low' | 'normal' = 'normal';
      if (stock <= 5) status = 'critical';
      else if (stock <= 15) status = 'low';

      inventoryItems.push({
        id: Number(row.id),
        name: String(row.name),
        stock,
        status,
      });
    });
  }

  return {
    totalSales,
    transactionCount,
    averageTransaction,
    totalExpenses,
    grossProfit,
    netProfit,
    profitMarginPercent,
    profitStatusMessage,
    topProducts,
    slowMovingProducts,
    topCustomers,
    paymentMethods,
    inventoryItems,
    provenanceRecords: provenance,
  };
}
