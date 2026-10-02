import { VerificationStatus } from '../semantic/types';

export type Cardinality = '1:1' | '1:N' | 'N:1' | 'N:N';

export type KeyType = 'PRIMARY_KEY' | 'FOREIGN_KEY' | 'CANDIDATE_KEY' | 'COMPOSITE_KEY' | 'BUSINESS_KEY';

export interface KeyCandidate {
  tableName: string;
  columnNames: string[];
  keyType: KeyType;
  uniquenessRatio: number;
  nullRate: number;
  confidence: number;
  evidence: string[];
}

export interface RelationshipEvidence {
  sourceTable: string;
  sourceColumn: string;
  targetTable: string;
  targetColumn: string;
  cardinality: Cardinality;
  matchedValuesCount: number;
  unmatchedValuesCount: number;
  matchRatio: number;
  matchingRule: string;
  contradictions: string[];
  evidence: string[];
  confidence: number;
  status: VerificationStatus;
}

export interface GraphNode {
  tableName: string;
  entityType: string;
  primaryKey?: string;
  rowCount: number;
}

export interface GraphEdge {
  id: string;
  sourceTable: string;
  sourceColumn: string;
  targetTable: string;
  targetColumn: string;
  cardinality: Cardinality;
  confidence: number;
  status: VerificationStatus;
}

export interface EntityRelationshipGraph {
  nodes: Record<string, GraphNode>;
  edges: GraphEdge[];
}

export interface ReconstructedInvoiceLine {
  productId?: string;
  productName?: string;
  quantity: number;
  unitPrice: number;
  total: number;
  cost?: number;
}

export interface ReconstructedInvoice {
  invoiceId: string;
  date?: string;
  customerId?: string;
  customerName?: string;
  lines: ReconstructedInvoiceLine[];
  recordedTotal?: number;
  computedLinesTotal: number;
  costTotal?: number;
  payments: Array<{ paymentId?: string; amount: number; method?: string }>;
  collectedTotal: number;
  hasContradiction: boolean;
  contradictionReason?: string;
}

export interface ReconstructedProduct {
  productId: string;
  productName: string;
  totalSoldQuantity: number;
  totalRevenue: number;
  totalCost?: number;
  stockQuantity?: number;
}

export interface ReconstructedCustomer {
  customerId: string;
  customerName: string;
  invoiceCount: number;
  totalSpent: number;
  totalCollected: number;
}

export interface ReconstructedBusinessEntities {
  invoices: ReconstructedInvoice[];
  products: ReconstructedProduct[];
  customers: ReconstructedCustomer[];
  contradictionsCount: number;
}
