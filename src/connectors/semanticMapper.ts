/**
 * Semantic Mapping Engine
 * Translates arbitrary technical source schemas (Arabic/English) into canonical business concepts.
 */

export interface CanonicalConceptMapping {
  concept: 'sales' | 'products' | 'customers' | 'expenses' | 'payments' | 'inventory';
  matchedTable: string;
  fieldMappings: Record<string, string>;
  confidence: number;
}

export const SYNONYM_DICTIONARY = {
  sales: [
    'sales',
    'orders',
    'invoices',
    'revenue',
    'transactions',
    'sale_items',
    'order_items',
    'order_details',
    'فاتورة',
    'فواتير',
    'مبيعات',
    'المبيعات',
    'طلبات',
    'الطلبات',
    'إيرادات',
    'الايرادات',
  ],
  customers: [
    'customers',
    'clients',
    'accounts',
    'buyers',
    'users',
    'members',
    'عملاء',
    'العملاء',
    'عميل',
    'العميل',
    'زبائن',
    'الزبائن',
    'زبون',
  ],
  products: [
    'products',
    'items',
    'goods',
    'articles',
    'services',
    'materials',
    'منتجات',
    'المنتجات',
    'منتج',
    'المنتج',
    'أصناف',
    'الاصناف',
    'صنف',
    'خدمات',
    'سلع',
  ],
  expenses: [
    'expenses',
    'costs',
    'purchases',
    'overheads',
    'bills',
    'مصروفات',
    'المصروفات',
    'مصاريف',
    'المصاريف',
    'نفقات',
    'مشتريات',
    'المشتريات',
    'تكاليف_تشغيل',
  ],
  payments: [
    'payments',
    'receipts',
    'transactions',
    'collections',
    'مدفوعات',
    'المدفوعات',
    'تحصيلات',
    'التحصيلات',
    'سندات_قبض',
    'سداد',
  ],
};

export const FIELD_SYNONYMS = {
  cost: ['cost_price', 'buy_price', 'purchase_price', 'cost', 'cogs', 'سعر_التكلفة', 'سعر_الشراء', 'تكلفة', 'التكلفة'],
  amount: ['total_amount', 'subtotal', 'total', 'amount', 'selling_price', 'price', 'value', 'إجمالي', 'اجمالي', 'مبلغ', 'المبلغ', 'قيمة', 'سعر'],
  quantity: ['quantity', 'qty', 'count', 'units', 'كمية', 'الكمية', 'عدد', 'العدد', 'وحدات'],
  date: ['order_date', 'invoice_date', 'created_at', 'timestamp', 'date', 'تاريخ_الطلب', 'تاريخ_الفاتورة', 'تاريخ', 'التاريخ'],
  customer: ['customer_id', 'client_id', 'customer_name', 'customer', 'client', 'buyer', 'اسم_العميل', 'رقم_العميل', 'عميل', 'العميل'],
  paymentMethod: ['payment_method', 'pay_type', 'method', 'type', 'طريقة_الدفع', 'وسيلة_الدفع', 'قناة_الدفع'],
  stock: ['stock_quantity', 'inventory', 'available', 'stock', 'رصيد_المخزن', 'الكمية_المتاحة', 'مخزون', 'المخزون'],
  id: ['id', 'code', 'number', 'no', 'num', 'ref', 'كود', 'رقم', 'معرف'],
  name: ['name', 'title', 'label', 'description', 'desc', 'اسم', 'الاسم', 'عنوان', 'وصف', 'بيان'],
};

/**
 * Maps a column name to a standard canonical field name
 */
export function mapColumnToCanonical(columnName: string): string | null {
  const norm = columnName.trim().toLowerCase().replace(/[\s\-_]+/g, '_');

  // Phase 1: Exact match
  for (const [canonicalField, synonyms] of Object.entries(FIELD_SYNONYMS)) {
    for (const syn of synonyms) {
      if (norm === syn) {
        return canonicalField;
      }
    }
  }

  // Phase 2: Substring match (longest synonym first)
  for (const [canonicalField, synonyms] of Object.entries(FIELD_SYNONYMS)) {
    for (const syn of synonyms) {
      if (norm.includes(syn)) {
        return canonicalField;
      }
    }
  }

  return null;
}

/**
 * Evaluates tables to find the best match for a business concept
 */
export function mapTablesToBusinessConcepts(tables: string[]): Record<string, string> {
  const result: Record<string, string> = {};

  for (const table of tables) {
    const norm = table.trim().toLowerCase().replace(/[\s\-_]+/g, '_');

    for (const [concept, synonyms] of Object.entries(SYNONYM_DICTIONARY)) {
      if (!result[concept]) {
        for (const syn of synonyms) {
          if (norm === syn || norm.includes(syn)) {
            result[concept] = table;
            break;
          }
        }
      }
    }
  }

  return result;
}
