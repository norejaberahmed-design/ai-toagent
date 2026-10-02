/**
 * Universal Data Ingestion & Processing Pipeline
 * Principle: الحقيقة قبل الذكاء (Truth Before Intelligence)
 *
 * Steps:
 * 1. Discover actual entities from the Connector.
 * 2. Read bounded batches safely without mutation.
 * 3. Send data to existing Semantic, Relationship, and Discovery engines.
 * 4. Build UnifiedBusinessSnapshot & CompanyMetrics.
 * 5. Determine business readiness status:
 *    - متصل (Connected)
 *    - البيانات قابلة للتحليل (Analyzable)
 *    - بيانات ناقصة (Partial Data)
 *    - تعارض يحتاج مراجعة (Contradiction Needs Review)
 */

import { ConnectorInterface, BusinessReadinessStatus } from './types';
import { mapTablesToBusinessConcepts } from '../semanticMapper';
import { buildUnifiedDataset, calculateMetricsFromUnified } from '../unifiedModel';
import { detectRelationships } from '../../relationships/relationship-detector';
import { reconstructBusinessEntities } from '../../relationships/reconstruction-engine';
import { CompanyMetrics } from '../../services/metricsEngine';
import { DataDiscoveryResult } from '../../services/discoveryEngine';

export interface PipelineExecutionResult {
  connectorId: string;
  sourceDisplayName: string;
  businessStatus: BusinessReadinessStatus;
  statusMessageAr: string;
  tablesDiscoveredCount: number;
  totalRecordsRead: number;
  metrics: CompanyMetrics;
  discovery: DataDiscoveryResult;
  hasContradictions: boolean;
  contradictionDetails?: string[];
  readAt: string;
}

export async function processUniversalConnectorData(
  connector: ConnectorInterface,
  companyName = 'المنشأة'
): Promise<PipelineExecutionResult> {
  const readAt = new Date().toISOString();
  const entities = await connector.discover();

  if (entities.length === 0) {
    return {
      connectorId: connector.metadata.id,
      sourceDisplayName: connector.metadata.displayNameAr,
      businessStatus: 'disconnected',
      statusMessageAr: 'لم يتم العثور على أي جداول في المصدر المربوط.',
      tablesDiscoveredCount: 0,
      totalRecordsRead: 0,
      metrics: {
        totalSales: null,
        transactionCount: 0,
        averageTransaction: null,
        grossProfit: null,
        profitMarginPercent: null,
        totalExpenses: null,
        netProfit: null,
        profitStatusMessage: 'لا توجد بيانات متاحة لحساب الأرباح.',
        provenanceRecords: [],
        topProducts: [],
        topCustomers: [],
        paymentMethods: [],
        inventoryItems: [],
        slowMovingProducts: [],
      },
      discovery: {
        tablesFound: [],
        capabilities: {
          salesSupported: false,
          profitSupported: false,
          customersSupported: false,
          expensesSupported: false,
          inventorySupported: false,
          productsSupported: false,
          costSupported: false,
          paymentsSupported: false,
        },
        entities: {},
        recordCounts: {},
      },
      hasContradictions: false,
      readAt,
    };
  }

  // 1. Read data from all entities
  const tablesData: Record<string, Record<string, unknown>[]> = {};
  const recordCounts: Record<string, number> = {};
  let totalRecords = 0;

  for (const entity of entities) {
    try {
      const batch = await connector.read(entity.name, { limit: 1000 });
      tablesData[entity.name] = batch.rows;
      recordCounts[entity.name] = batch.rows.length;
      totalRecords += batch.rows.length;
    } catch {
      tablesData[entity.name] = [];
      recordCounts[entity.name] = 0;
    }
  }

  // 2. Discover business concepts dynamically without hardcoded table names
  const tableNames = Object.keys(tablesData);
  const conceptMappings = mapTablesToBusinessConcepts(tableNames);

  // 3. Detect relationships and entity reconstruction
  const relationships = detectRelationships(tablesData);
  const reconstructed = reconstructBusinessEntities(tablesData, relationships);

  // 4. Build Unified Dataset and Calculate Deterministic Metrics
  const unifiedDataset = buildUnifiedDataset(tablesData, conceptMappings);
  const metrics = calculateMetricsFromUnified(
    unifiedDataset,
    connector.metadata.displayNameAr
  );

  const hasSales = metrics.totalSales !== null && metrics.totalSales > 0;
  const hasCost = metrics.grossProfit !== null;
  const hasExpenses = metrics.totalExpenses !== null;
  const hasInventory = metrics.inventoryItems.length > 0;
  const hasCustomers = metrics.topCustomers.length > 0;

  const discovery: DataDiscoveryResult = {
    tablesFound: entities.map((e) => e.name),
    capabilities: {
      salesSupported: hasSales,
      profitSupported: hasCost,
      customersSupported: hasCustomers,
      expensesSupported: hasExpenses,
      inventorySupported: hasInventory,
      productsSupported: metrics.topProducts.length > 0,
      costSupported: hasCost,
      paymentsSupported: metrics.paymentMethods.length > 0,
      profitExplanation: hasCost ? undefined : 'لا تتوفر بيانات تكلفة لحساب الربح',
    },
    entities: {
      salesTable: conceptMappings.sales,
      productsTable: conceptMappings.products,
      customersTable: conceptMappings.customers,
      expensesTable: conceptMappings.expenses,
    },
    recordCounts,
  };

  // 6. Check contradictions
  const hasContradictions = reconstructed.contradictionsCount > 0;
  const contradictionDetails: string[] = [];
  if (hasContradictions) {
    for (const inv of reconstructed.invoices) {
      if (inv.hasContradiction && inv.contradictionReason) {
        contradictionDetails.push(inv.contradictionReason);
      }
    }
  }

  // 7. Evaluate Business Status
  let businessStatus: BusinessReadinessStatus = 'analyzable';
  let statusMessageAr = 'البيانات قابلة للتحليل وتكفي لإنشاء مؤشرات دقيقة ومثبتة.';

  if (hasContradictions) {
    businessStatus = 'contradiction';
    statusMessageAr = 'يوجد تعارض في بعض سجلات الفواتير يحتاج إلى مراجعة وتدقيق.';
  } else if (!hasSales) {
    businessStatus = 'disconnected';
    statusMessageAr = 'لم يتم العثور على سجلات مبيعات كافية لاحتساب النشاط التجاري.';
  } else if (!hasCost || !hasExpenses) {
    businessStatus = 'partial';
    statusMessageAr = 'البيانات جزئية (المبيعات متوفرة لكن تغيب بيانات التكلفة أو المصروفات).';
  }

  return {
    connectorId: connector.metadata.id,
    sourceDisplayName: connector.metadata.displayNameAr,
    businessStatus,
    statusMessageAr,
    tablesDiscoveredCount: entities.length,
    totalRecordsRead: totalRecords,
    metrics,
    discovery,
    hasContradictions,
    contradictionDetails,
    readAt,
  };
}
