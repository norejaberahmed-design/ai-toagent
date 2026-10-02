/**
 * Multi-Source Ingestion & Enterprise Financial Pipeline
 * Principle: الحقيقة قبل الذكاء (Truth Before Intelligence)
 *
 * Coordinates:
 * Tenant -> Authorized Sources -> Adapters -> DataBatches -> P2 Merge -> P3 Financial Intelligence
 */

import {
  Tenant,
  TenantAuthorizedSource,
  DataBatch,
  DataPeriod,
  BusinessConcept,
} from './types';
import { tenantManager, MultiTenantManager } from './tenant-manager';
import { runDeterministicEngine, DeterministicEngineConfig } from '../engine/deterministic';
import { UnifiedBusinessSnapshot } from '../model/unified';
import { compileFinancialStatements, FinancialStatementsBundle } from '../financial/statements';
import { runCompanyFinancialAnalysis } from '../financial/financial-model';
import { FinancialAnswer } from '../financial/types';

export interface TenantFinancialIntelligenceBundle {
  tenant: Tenant;
  period: DataPeriod;
  sourcesUsed: Array<{
    sourceId: string;
    adapterType: string;
    displayName: string;
    batchesContributed: number;
  }>;
  rawBatches: DataBatch[];
  unifiedSnapshot: UnifiedBusinessSnapshot;
  financialStatements: FinancialStatementsBundle;
  financialAnalysis: FinancialAnswer;
  executedAt: string;
}

export class MultiSourcePipeline {
  private manager: MultiTenantManager;

  constructor(manager: MultiTenantManager = tenantManager) {
    this.manager = manager;
  }

  /**
   * Runs the complete analytical pipeline for a tenant across all its authorized sources
   */
  public async executeTenantPipeline(
    tenantId: string,
    period: DataPeriod,
    conceptsToFetch: BusinessConcept[] = [
      'sales',
      'revenue',
      'product',
      'customer',
      'cost',
      'expense',
      'collection',
      'receivable',
      'inventory',
      'purchase',
      'cashflow',
    ]
  ): Promise<TenantFinancialIntelligenceBundle> {
    const tenant = this.manager.getTenant(tenantId);
    const authorizedSources = this.manager.getTenantSources(tenantId);

    const allBatches: DataBatch[] = [];
    const sourceContributions: Record<string, number> = {};

    // 1. Fetch batches across all authorized sources with tenant isolation
    for (const source of authorizedSources) {
      sourceContributions[source.sourceId] = 0;
      for (const concept of conceptsToFetch) {
        try {
          const batch = await source.adapter.fetch(concept, period);
          if (batch && batch.rows && batch.rows.length > 0) {
            allBatches.push(batch);
            sourceContributions[source.sourceId]++;
          }
        } catch (_) {
          // Source does not have this concept, or is unreachable - continue safely
        }
      }
    }

    // 2. Pass batches to P2 Deterministic BI Engine with Merge & Conflict Resolution
    const engineConfig: DeterministicEngineConfig = {
      tenantCurrency: tenant.currency,
      targetPeriod: period,
      tenantId: tenant.id,
    };

    const unifiedSnapshot = runDeterministicEngine(allBatches, engineConfig);

    // 3. Extract verified financial values (never assuming missing -> 0)
    const revenueVal = unifiedSnapshot.revenue?.value ?? unifiedSnapshot.sales?.value ?? null;
    const costVal = unifiedSnapshot.cost?.value ?? null;
    const expenseVal = unifiedSnapshot.expense?.value ?? null;
    const cashVal = unifiedSnapshot.cashflow?.value ?? null;
    const receivablesVal = unifiedSnapshot.receivable?.value ?? null;
    const inventoryVal = unifiedSnapshot.inventory?.value ?? null;

    // 4. Compile P3.3 Financial Statements Bundle
    const financialStatements = compileFinancialStatements({
      period,
      currency: tenant.currency,
      revenue: revenueVal,
      costOfSales: costVal,
      operatingExpenses: expenseVal,
      cash: cashVal,
      receivables: receivablesVal,
      inventory: inventoryVal,
      payables: null,
      capital: null,
      retainedEarnings: null,
      operatingCashFlow: cashVal,
      openingEquity: null,
    });

    // 5. Generate P3.3 Financial Analysis & Ratio Evaluation
    const financialAnalysis = runCompanyFinancialAnalysis({
      period,
      currency: tenant.currency,
      snapshot: unifiedSnapshot,
      provenanceList: allBatches.map((b) => b.provenance),
    });

    return {
      tenant,
      period,
      sourcesUsed: authorizedSources.map((s) => ({
        sourceId: s.sourceId,
        adapterType: s.adapterType,
        displayName: s.displayName,
        batchesContributed: sourceContributions[s.sourceId] || 0,
      })),
      rawBatches: allBatches,
      unifiedSnapshot,
      financialStatements,
      financialAnalysis,
      executedAt: new Date().toISOString(),
    };
  }
}

export const multiSourcePipeline = new MultiSourcePipeline();
