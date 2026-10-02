import {
  FieldProfile,
  ConceptCandidate,
  DetectedSemanticType,
  MathematicalVerification,
  VerificationStatus,
} from './types';

// Arabic and English auxiliary name patterns
const NAME_PATTERNS: Record<DetectedSemanticType, RegExp[]> = {
  DATE: [/date/i, /created/i, /timestamp/i, /تاريخ/i, /وقت/i],
  DATETIME: [/datetime/i, /timestamp/i, /تاريخ_ووقت/i],
  DOCUMENT_ID: [/doc/i, /document/i, /ref/i, /رقم_المستند/i, /مرجع/i],
  INVOICE_ID: [/inv/i, /invoice/i, /فاتورة/i, /رقم_الفاتورة/i],
  ORDER_ID: [/order/i, /طلب/i, /رقم_الطلب/i],
  TRANSACTION_ID: [/tx/i, /trx/i, /trans/i, /حركة/i, /معاملة/i],
  PRODUCT_ID: [/prod.*id/i, /item.*id/i, /sku/i, /كود_المنتج/i, /رقم_الصنف/i],
  PRODUCT_NAME: [/prod.*name/i, /item.*name/i, /item/i, /description/i, /اسم_المنتج/i, /الصنف/i, /البيان/i],
  CUSTOMER_ID: [/cust.*id/i, /client.*id/i, /رقم_العميل/i],
  CUSTOMER_NAME: [/cust.*name/i, /client.*name/i, /customer/i, /اسم_العميل/i, /العميل/i],
  SUPPLIER_ID: [/supp.*id/i, /vendor.*id/i, /رقم_المورد/i],
  SUPPLIER_NAME: [/supp.*name/i, /vendor/i, /اسم_المورد/i, /المورد/i],
  QUANTITY: [/qty/i, /quantity/i, /count/i, /الكمية/i, /العدد/i],
  UNIT_PRICE: [/unit.*price/i, /price/i, /rate/i, /سعر_الوحدة/i, /السعر/i],
  SALES_VALUE: [/sales/i, /total/i, /amount/i, /المبيعات/i, /الإجمالي/i, /المبلغ/i],
  REVENUE_VALUE: [/rev/i, /revenue/i, /الإيراد/i],
  DISCOUNT: [/disc/i, /discount/i, /الخصم/i],
  TAX: [/tax/i, /vat/i, /الضريبة/i],
  COST_VALUE: [/cost/i, /cogs/i, /التكلفة/i, /سعر_التكلفة/i],
  EXPENSE_VALUE: [/exp/i, /expense/i, /المصروف/i, /نفقات/i],
  COLLECTION_VALUE: [/collect/i, /paid/i, /receipt/i, /المحصل/i, /المدفوع/i],
  PAYMENT_VALUE: [/payment/i, /سداد/i],
  RECEIVABLE_VALUE: [/receivable/i, /balance/i, /due/i, /الذمم/i, /المتبقي/i],
  INVENTORY_QUANTITY: [/stock/i, /inventory/i, /on_hand/i, /المخزون/i, /الرصيد/i],
  INVENTORY_VALUE: [/stock_val/i, /inventory_val/i, /قيمة_المخزون/i],
  PURCHASE_VALUE: [/purch/i, /po_total/i, /المشتريات/i],
  CASH_IN: [/cash_in/i, /قبض/i],
  CASH_OUT: [/cash_out/i, /صرف/i],
  UNKNOWN: [],
};

function hasNameMatch(fieldName: string, type: DetectedSemanticType): boolean {
  const patterns = NAME_PATTERNS[type];
  if (!patterns) return false;
  return patterns.some((p) => p.test(fieldName));
}

export function detectFieldConceptCandidates(
  profile: FieldProfile,
  mathVerifications: MathematicalVerification[] = []
): ConceptCandidate[] {
  const candidates: ConceptCandidate[] = [];

  // Helper to add candidate
  const addCandidate = (
    type: DetectedSemanticType,
    baseConfidence: number,
    evidence: string[],
    contradictions: string[]
  ) => {
    let conf = baseConfidence;
    // Auxiliary Name boost (Max +0.15)
    if (hasNameMatch(profile.fieldName, type)) {
      conf = Math.min(conf + 0.15, 0.98);
      evidence.push(`اسم الحقل (${profile.fieldName}) يتطابق مع النمط المساعد`);
    }

    // Status derivation
    let status: VerificationStatus = 'UNRESOLVED';
    if (contradictions.length > 0) {
      status = 'CONTRADICTED';
      conf = Math.max(conf - 0.3, 0.1);
    } else if (conf >= 0.85) {
      status = 'HIGH_CONFIDENCE';
    } else if (conf >= 0.6) {
      status = 'PARTIAL';
    }

    candidates.push({
      type,
      confidence: Number(conf.toFixed(2)),
      evidence,
      contradictions,
      status,
    });
  };

  // 1. DATE / DATETIME
  if (profile.isDateTime) {
    addCandidate('DATETIME', 0.85, ['أنماط التاريخ والوقت متوفرة في أكثر من 70% من العينات'], []);
  } else if (profile.isDate) {
    addCandidate('DATE', 0.8, ['أنماط التقويم والتاريخ صالحة في معظم الصفوف'], []);
  }

  // 2. DOCUMENT_ID / INVOICE_ID
  if (profile.hasDocumentPattern) {
    addCandidate('INVOICE_ID', 0.75, ['تنسيق معرّفات المستندات والفواتير واضح (مثل INV-XXXX)'], []);
    addCandidate('DOCUMENT_ID', 0.7, ['قيم معرفية فريدة لمستندات'], []);
  } else if (profile.hasIdentifierPattern && profile.uniqueRatio > 0.9) {
    addCandidate('DOCUMENT_ID', 0.6, ['معدل تفرد عالي > 90% يشير إلى معرّف'], []);
  }

  // 3. Mathematical corroboration checks
  let isFactorA = false;
  let isFactorB = false;
  let isResultField = false;

  for (const m of mathVerifications) {
    if (m.factorA === profile.fieldName) isFactorA = true;
    if (m.factorB === profile.fieldName) isFactorB = true;
    if (m.resultField === profile.fieldName) isResultField = true;
  }

  // 4. QUANTITY
  if (profile.isInteger && profile.positiveCount === profile.totalCount - profile.nullCount && profile.totalCount > profile.nullCount) {
    if (profile.maxNumeric && profile.maxNumeric < 50000) {
      const ev: string[] = ['أعداد صحيحة موجبة في نطاق كميات معتاد'];
      let baseConf = 0.55;
      if (isFactorA || isFactorB) {
        baseConf = 0.88;
        ev.push('إثبات رياضي: هذا الحقل طرف في معادلة الضرب (كمية × سعر = إجمالي)');
      }
      addCandidate('QUANTITY', baseConf, ev, []);
    }
  }

  // 5. UNIT_PRICE
  if (profile.isNumeric && profile.positiveCount > 0 && profile.negativeCount === 0) {
    if (isFactorA || isFactorB) {
      addCandidate(
        'UNIT_PRICE',
        0.85,
        ['إثبات رياضي: الحقل يشكل سعر الوحدة في معادلة الضرب مع الكمية'],
        []
      );
    }
  }

  // 6. SALES_VALUE / TRANSACTION_VALUE
  if (profile.isNumeric && profile.positiveCount > 0) {
    if (isResultField) {
      addCandidate(
        'SALES_VALUE',
        0.92,
        ['إثبات قطعي: الحقل يطابق ناتج ضرب الكمية في سعر الوحدة بدقة متناهية'],
        []
      );
    } else if (profile.avgNumeric && profile.avgNumeric > 10) {
      addCandidate('SALES_VALUE', 0.5, ['قيم نقدية رقمية موجبة'], []);
      addCandidate('COST_VALUE', 0.45, ['قيم نقدية مرشحة لتكاليف'], []);
    }
  }

  // 7. PRODUCT_NAME / CUSTOMER_NAME
  if (profile.isString && !profile.isDate && !profile.isDateTime && !profile.hasDocumentPattern) {
    if (profile.uniqueRatio > 0.1 && profile.uniqueRatio < 0.95) {
      addCandidate('PRODUCT_NAME', 0.55, ['سلاسل نصية متكررة تشير إلى منتجات أو أصناف'], []);
      addCandidate('CUSTOMER_NAME', 0.5, ['سلاسل نصية مرشحة لأسماء عملاء'], []);
    }
  }

  // Sort candidates by confidence descending
  candidates.sort((a, b) => b.confidence - a.confidence);

  return candidates;
}
