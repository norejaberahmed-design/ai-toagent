import { SQLiteCompanySource } from './sqliteEngine';

export interface BusinessCapabilities {
  salesSupported: boolean;
  productsSupported: boolean;
  customersSupported: boolean;
  expensesSupported: boolean;
  costSupported: boolean;
  profitSupported: boolean;
  profitExplanation?: string;
  paymentsSupported: boolean;
  inventorySupported: boolean;
}

export interface DiscoveredEntities {
  salesTable?: string;
  orderItemsTable?: string;
  productsTable?: string;
  customersTable?: string;
  expensesTable?: string;
  categoriesTable?: string;
}

export interface DataDiscoveryResult {
  tablesFound: string[];
  capabilities: BusinessCapabilities;
  entities: DiscoveredEntities;
  recordCounts: Record<string, number>;
}

export function discoverBusinessData(source: SQLiteCompanySource): DataDiscoveryResult {
  const tables = source.getTables();
  const lowerTables = tables.map((t) => t.toLowerCase());

  const entities: DiscoveredEntities = {};
  const recordCounts: Record<string, number> = {};

  // Detect tables
  for (const table of tables) {
    const lower = table.toLowerCase();
    const countRes = source.executeQuery(`SELECT COUNT(*) as cnt FROM ${table}`);
    recordCounts[table] = (countRes[0]?.cnt as number) || 0;

    if (!entities.salesTable && (lower === 'orders' || lower === 'sales' || lower === 'invoices')) {
      entities.salesTable = table;
    }
    if (!entities.orderItemsTable && (lower === 'order_items' || lower === 'sale_items' || lower === 'invoice_items')) {
      entities.orderItemsTable = table;
    }
    if (!entities.productsTable && (lower === 'products' || lower === 'items' || lower === 'goods')) {
      entities.productsTable = table;
    }
    if (!entities.customersTable && (lower === 'customers' || lower === 'clients' || lower === 'users')) {
      entities.customersTable = table;
    }
    if (!entities.expensesTable && (lower === 'expenses' || lower === 'costs' || lower === 'purchases')) {
      entities.expensesTable = table;
    }
    if (!entities.categoriesTable && (lower === 'categories' || lower === 'departments')) {
      entities.categoriesTable = table;
    }
  }

  // Check columns in products or order_items for cost
  let hasCostData = false;
  if (entities.productsTable) {
    const cols = source.getTableColumns(entities.productsTable).map((c) => c.name.toLowerCase());
    if (cols.some((c) => c.includes('cost') || c.includes('buy_price') || c.includes('purchase_price'))) {
      hasCostData = true;
    }
  }

  // Check if payments column or table exists
  let hasPayments = false;
  if (entities.salesTable) {
    const cols = source.getTableColumns(entities.salesTable).map((c) => c.name.toLowerCase());
    if (cols.some((c) => c.includes('payment') || c.includes('method') || c.includes('pay_type'))) {
      hasPayments = true;
    }
  }

  // Determine capabilities
  const salesSupported = !!entities.salesTable && (recordCounts[entities.salesTable] || 0) > 0;
  const productsSupported = !!entities.productsTable && (recordCounts[entities.productsTable] || 0) > 0;
  const customersSupported = !!entities.customersTable && (recordCounts[entities.customersTable] || 0) > 0;
  const expensesSupported = !!entities.expensesTable && (recordCounts[entities.expensesTable] || 0) > 0;
  const inventorySupported = productsSupported;

  // Strict Profit Rule (Section 22 of Master Spec):
  // Sales do NOT equal profit. Profit requires appropriate cost information.
  // If cost information is unavailable: say "لا تتوفر بيانات تكلفة كافية لحساب الربح بدقة."
  const profitSupported = salesSupported && hasCostData;
  const profitExplanation = profitSupported
    ? 'بيانات التكلفة متوفرة بدقة ويمكن احتساب إجمالي الربح وهامش الربح.'
    : 'لا تتوفر بيانات تكلفة كافية لحساب الربح بدقة.';

  return {
    tablesFound: tables,
    capabilities: {
      salesSupported,
      productsSupported,
      customersSupported,
      expensesSupported,
      costSupported: hasCostData,
      profitSupported,
      profitExplanation,
      paymentsSupported: hasPayments,
      inventorySupported,
    },
    entities,
    recordCounts,
  };
}
