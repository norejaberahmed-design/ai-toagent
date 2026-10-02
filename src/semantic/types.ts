import { DataBatch, SafeTransform } from '../connectors/types';

export type PrimitiveType = 'string' | 'number' | 'boolean' | 'date' | 'null' | 'undefined';

export type DetectedSemanticType =
  | 'DATE'
  | 'DATETIME'
  | 'DOCUMENT_ID'
  | 'INVOICE_ID'
  | 'ORDER_ID'
  | 'TRANSACTION_ID'
  | 'PRODUCT_ID'
  | 'PRODUCT_NAME'
  | 'CUSTOMER_ID'
  | 'CUSTOMER_NAME'
  | 'SUPPLIER_ID'
  | 'SUPPLIER_NAME'
  | 'QUANTITY'
  | 'UNIT_PRICE'
  | 'SALES_VALUE'
  | 'REVENUE_VALUE'
  | 'DISCOUNT'
  | 'TAX'
  | 'COST_VALUE'
  | 'EXPENSE_VALUE'
  | 'COLLECTION_VALUE'
  | 'PAYMENT_VALUE'
  | 'RECEIVABLE_VALUE'
  | 'INVENTORY_QUANTITY'
  | 'INVENTORY_VALUE'
  | 'PURCHASE_VALUE'
  | 'CASH_IN'
  | 'CASH_OUT'
  | 'UNKNOWN';

export type VerificationStatus =
  | 'CONFIRMED'
  | 'HIGH_CONFIDENCE'
  | 'PARTIAL'
  | 'UNRESOLVED'
  | 'CONTRADICTED';

export interface FieldProfile {
  fieldName: string;
  primitiveType: PrimitiveType;
  isNumeric: boolean;
  isInteger: boolean;
  isDecimal: boolean;
  isDate: boolean;
  isDateTime: boolean;
  isBoolean: boolean;
  isString: boolean;

  totalCount: number;
  sampleSize: number;
  nullCount: number;
  nullRate: number;
  uniqueCount: number;
  uniqueRatio: number;

  minNumeric?: number;
  maxNumeric?: number;
  avgNumeric?: number;
  positiveCount: number;
  negativeCount: number;
  zeroCount: number;
  decimalPrecisionMax: number;

  minStringLength?: number;
  maxStringLength?: number;

  // Pattern detection flags
  hasIdentifierPattern: boolean;
  hasDatePattern: boolean;
  hasCurrencyPattern: boolean;
  hasPercentagePattern: boolean;
  hasQuantityPattern: boolean;
  hasDocumentPattern: boolean;

  sampleValues: unknown[];
  sampleBased: boolean;
}

export interface ConceptCandidate {
  type: DetectedSemanticType;
  confidence: number;
  evidence: string[];
  contradictions: string[];
  status: VerificationStatus;
}

export interface MathematicalVerification {
  formula: string; // e.g., "quantity * unit_price == total"
  factorA: string;
  factorB: string;
  resultField: string;
  matchedCount: number;
  mismatchCount: number;
  tolerance: number;
  verified: boolean;
}

export type TablePatternType =
  | 'SALES_TRANSACTIONS'
  | 'INVOICE_TRANSACTIONS'
  | 'INVOICE_LINES'
  | 'PRODUCT_MASTER'
  | 'CUSTOMER_MASTER'
  | 'SUPPLIER_MASTER'
  | 'INVENTORY'
  | 'PURCHASES'
  | 'EXPENSES'
  | 'COLLECTIONS'
  | 'RECEIVABLES'
  | 'PAYMENTS'
  | 'CASHFLOW'
  | 'GENERAL_LEDGER'
  | 'JOURNAL'
  | 'ACCOUNT_MASTER'
  | 'UNKNOWN';

export interface TablePatternCandidate {
  pattern: TablePatternType;
  confidence: number;
  evidence: string[];
  contradictions: string[];
}

export interface TableProfile {
  tableName: string;
  rowCount: number;
  fieldProfiles: Record<string, FieldProfile>;
  fieldCandidates: Record<string, ConceptCandidate[]>;
  primaryPattern: TablePatternType;
  patternCandidates: TablePatternCandidate[];
  mathematicalEvidences: MathematicalVerification[];
  candidateKeys: string[];
  primaryKeyCandidate?: string;
  confidence: number;
  status: VerificationStatus;
}

export interface SemanticMappingResult {
  tableProfiles: Record<string, TableProfile>;
  verifiedMappings: Array<{
    tableName: string;
    fieldName: string;
    concept: DetectedSemanticType;
    confidence: number;
    status: VerificationStatus;
    evidence: string[];
  }>;
}
