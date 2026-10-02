import { EntityRelationshipGraph, GraphNode, GraphEdge, RelationshipEvidence } from './types';

export function buildRelationshipGraph(
  tablesData: Record<string, Record<string, unknown>[]>,
  relationships: RelationshipEvidence[]
): EntityRelationshipGraph {
  const nodes: Record<string, GraphNode> = {};

  const tableNames = Object.keys(tablesData).sort();
  for (const t of tableNames) {
    const rows = tablesData[t] || [];
    nodes[t] = {
      tableName: t,
      entityType: t,
      rowCount: rows.length,
    };
  }

  const edges: GraphEdge[] = relationships.map((rel, idx) => ({
    id: `edge_${rel.sourceTable}_${rel.sourceColumn}_to_${rel.targetTable}_${rel.targetColumn}`,
    sourceTable: rel.sourceTable,
    sourceColumn: rel.sourceColumn,
    targetTable: rel.targetTable,
    targetColumn: rel.targetColumn,
    cardinality: rel.cardinality,
    confidence: rel.confidence,
    status: rel.status,
  }));

  // Sort edges deterministically
  edges.sort((a, b) => a.id.localeCompare(b.id));

  return { nodes, edges };
}
