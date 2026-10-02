import { evaluateRelationshipEvidence } from './relationship-evidence';
import { RelationshipEvidence } from './types';

export function detectRelationships(
  tablesData: Record<string, Record<string, unknown>[]>
): RelationshipEvidence[] {
  const relationships: RelationshipEvidence[] = [];
  const tableNames = Object.keys(tablesData).sort();

  for (let i = 0; i < tableNames.length; i++) {
    for (let j = 0; j < tableNames.length; j++) {
      if (i === j) continue;

      const sourceTable = tableNames[i];
      const targetTable = tableNames[j];

      const sourceRows = tablesData[sourceTable] || [];
      const targetRows = tablesData[targetTable] || [];

      if (sourceRows.length === 0 || targetRows.length === 0) continue;

      const sourceCols = Object.keys(sourceRows[0] || {}).sort();
      const targetCols = Object.keys(targetRows[0] || {}).sort();

      for (const sCol of sourceCols) {
        for (const tCol of targetCols) {
          const sVals = sourceRows.map((r) => r[sCol]);
          const tVals = targetRows.map((r) => r[tCol]);

          const rel = evaluateRelationshipEvidence(
            sourceTable,
            sCol,
            sVals,
            targetTable,
            tCol,
            tVals
          );

          if (rel) {
            relationships.push(rel);
          }
        }
      }
    }
  }

  // Deduplicate and sort deterministically
  relationships.sort((a, b) => {
    if (b.confidence !== a.confidence) return b.confidence - a.confidence;
    return `${a.sourceTable}.${a.sourceColumn}`.localeCompare(`${b.sourceTable}.${b.sourceColumn}`);
  });

  return relationships;
}
