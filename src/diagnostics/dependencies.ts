/**
 * M4.5 — Metric Dependency Graph & Cascade Evaluator
 * Tracks metric dependencies to determine validity, block unverified downstream calculations,
 * and isolate the exact First Failure Point.
 */

import { CalculationDiagnostic, MetricDependencyNode } from './types';

export const METRIC_DEPENDENCY_TREE: Record<string, { displayNameAr: string; dependencies: string[] }> = {
  revenue: {
    displayNameAr: 'الإيرادات / المبيعات',
    dependencies: [],
  },
  costs: {
    displayNameAr: 'تكلفة المبيعات (COGS)',
    dependencies: [],
  },
  operating_expenses: {
    displayNameAr: 'المصروفات التشغيلية',
    dependencies: [],
  },
  gross_profit: {
    displayNameAr: 'إجمالي الربح',
    dependencies: ['revenue', 'costs'],
  },
  gross_margin: {
    displayNameAr: 'هامش الربح الإجمالي',
    dependencies: ['gross_profit', 'revenue'],
  },
  net_profit: {
    displayNameAr: 'صافي الربح',
    dependencies: ['gross_profit', 'operating_expenses'],
  },
  net_margin: {
    displayNameAr: 'هامش صافي الربح',
    dependencies: ['net_profit', 'revenue'],
  },
  collections: {
    displayNameAr: 'التحصيلات النقدية',
    dependencies: [],
  },
  receivables: {
    displayNameAr: 'الذمم المدينة',
    dependencies: ['revenue', 'collections'],
  },
  cashflow: {
    displayNameAr: 'صافي التدفق النقدي التشغيلي',
    dependencies: ['collections', 'operating_expenses'],
  },
};

export class DependencyGraphEvaluator {
  private nodes: Map<string, MetricDependencyNode> = new Map();
  private calculationDiagnostics: CalculationDiagnostic[] = [];
  private firstFailure: string | null = null;
  private rootCause: string | null = null;

  constructor() {
    this.reset();
  }

  public reset(): void {
    this.nodes.clear();
    this.calculationDiagnostics = [];
    this.firstFailure = null;
    this.rootCause = null;

    for (const [key, def] of Object.entries(METRIC_DEPENDENCY_TREE)) {
      this.nodes.set(key, {
        metricKey: key,
        displayNameAr: def.displayNameAr,
        dependencies: def.dependencies,
        isValid: false,
        isCalculated: false,
        isBlocked: false,
      });
    }
  }

  /**
   * Registers the evaluation of a base or computed metric.
   */
  public registerMetricResult(
    metricKey: string,
    result: {
      value: number | null | undefined;
      isValid: boolean;
      evidenceId?: string;
      stage?: string;
      failureReason?: string;
    }
  ): CalculationDiagnostic {
    const node = this.nodes.get(metricKey);
    const deps = node ? node.dependencies : [];
    const stage = result.stage || `${metricKey}_calculation`;

    // Check if any upstream dependencies failed
    const failedDep = deps.find((depKey) => {
      const depNode = this.nodes.get(depKey);
      return !depNode || !depNode.isValid || depNode.isBlocked;
    });

    if (failedDep) {
      // Cascading Block
      if (node) {
        node.isBlocked = true;
        node.isValid = false;
        node.blockReason = `محظور بسبب فشل أو غياب الاعتماد المسبق: ${METRIC_DEPENDENCY_TREE[failedDep]?.displayNameAr || failedDep}`;
      }

      if (!this.firstFailure) {
        this.firstFailure = failedDep;
        this.rootCause = `فشل حساب الاعتماد المسبق [${failedDep}] أدى إلى حظر [${metricKey}]`;
      }

      const diag: CalculationDiagnostic = {
        calculation_type: metricKey,
        input_dependencies: deps,
        calculation_stage: stage,
        status: 'BLOCKED',
        failure_reason: `الاعتماد المسبق [${failedDep}] غير صالح أو غير متوفر.`,
        evidence_status: 'BLOCKED',
        evidence_id: result.evidenceId,
        dependent_metric: metricKey,
        action: 'BLOCK_RESULT',
      };
      this.calculationDiagnostics.push(diag);
      return diag;
    }

    // Direct result evaluation
    if (result.isValid && result.value !== null && result.value !== undefined && !Number.isNaN(result.value)) {
      if (node) {
        node.isValid = true;
        node.isCalculated = true;
        node.isBlocked = false;
        node.value = result.value;
      }

      const diag: CalculationDiagnostic = {
        calculation_type: metricKey,
        input_dependencies: deps,
        calculation_stage: stage,
        status: 'SUCCESS',
        evidence_status: result.evidenceId ? 'VERIFIED' : 'PARTIAL',
        evidence_id: result.evidenceId,
        dependent_metric: metricKey,
        action: 'ALLOW_RESULT',
      };
      this.calculationDiagnostics.push(diag);
      return diag;
    } else {
      // Direct calculation failure
      if (node) {
        node.isValid = false;
        node.isCalculated = false;
        node.isBlocked = true;
        node.blockReason = result.failureReason || `بيانات ${METRIC_DEPENDENCY_TREE[metricKey]?.displayNameAr || metricKey} غير مكتملة أو غير صالحة.`;
      }

      if (!this.firstFailure) {
        this.firstFailure = metricKey;
        this.rootCause = result.failureReason || `غياب أو نقص البيانات المطلوبة لاحتساب [${metricKey}]`;
      }

      const diag: CalculationDiagnostic = {
        calculation_type: metricKey,
        input_dependencies: deps,
        calculation_stage: stage,
        status: 'FAILED',
        failure_reason: result.failureReason || 'البيانات غير مكتملة أو غير متوفرة',
        evidence_status: 'INSUFFICIENT',
        evidence_id: result.evidenceId,
        dependent_metric: metricKey,
        action: 'BLOCK_RESULT',
      };
      this.calculationDiagnostics.push(diag);
      return diag;
    }
  }

  public getFirstFailure(): string | null {
    return this.firstFailure;
  }

  public getRootCause(): string | null {
    return this.rootCause;
  }

  public getCalculationDiagnostics(): CalculationDiagnostic[] {
    return this.calculationDiagnostics;
  }

  public getNode(metricKey: string): MetricDependencyNode | undefined {
    return this.nodes.get(metricKey);
  }

  public getAllNodes(): MetricDependencyNode[] {
    return Array.from(this.nodes.values());
  }

  public isMetricAllowed(metricKey: string): boolean {
    const node = this.nodes.get(metricKey);
    return Boolean(node && node.isValid && !node.isBlocked);
  }
}
