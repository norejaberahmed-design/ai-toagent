import { Provenance, SafeTransform } from '../connectors/types';

export function createFinancialProvenance(params: {
  sourceId: string;
  connectorId: string;
  sourceRef: string;
  queryHash: string;
  fetchedAt: string;
  formula: string;
  confidence: number;
}): Provenance {
  return {
    source_id: params.sourceId,
    connector_id: params.connectorId,
    source_ref: `${params.sourceRef} [${params.formula}]`,
    query_hash: params.queryHash,
    fetched_at: params.fetchedAt,
    transformation_chain: ['SUM'],
    confidence: params.confidence,
    is_complete: true,
  };
}
