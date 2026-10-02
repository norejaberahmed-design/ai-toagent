import { DatasetProfile } from './content-profiler';
import { SemanticMappingResult, DetectedSemanticType, VerificationStatus } from './types';

export function deriveSemanticMappings(datasetProfile: DatasetProfile): SemanticMappingResult {
  const verifiedMappings: SemanticMappingResult['verifiedMappings'] = [];

  for (const [tableName, tProf] of Object.entries(datasetProfile.tables)) {
    for (const [fieldName, candidates] of Object.entries(tProf.fieldCandidates)) {
      if (candidates.length > 0) {
        const top = candidates[0];
        if (top.confidence >= 0.5 && top.status !== 'CONTRADICTED') {
          verifiedMappings.push({
            tableName,
            fieldName,
            concept: top.type,
            confidence: top.confidence,
            status: top.status,
            evidence: top.evidence,
          });
        }
      }
    }
  }

  // Sort deterministically
  verifiedMappings.sort((a, b) => {
    if (a.tableName !== b.tableName) return a.tableName.localeCompare(b.tableName);
    return a.fieldName.localeCompare(b.fieldName);
  });

  return {
    tableProfiles: datasetProfile.tables,
    verifiedMappings,
  };
}
