import { VerificationStatus } from './types';

export interface EvidenceScore {
  finalConfidence: number;
  status: VerificationStatus;
  evidenceItems: string[];
  contradictionItems: string[];
}

export function scoreEvidence(
  baseConfidence: number,
  evidence: string[],
  contradictions: string[]
): EvidenceScore {
  let score = baseConfidence;

  // Each verified evidence adds positive weight
  score += Math.min(evidence.length * 0.05, 0.2);

  // Each contradiction heavily penalizes score
  if (contradictions.length > 0) {
    score -= contradictions.length * 0.35;
  }

  score = Math.max(0, Math.min(1, Number(score.toFixed(2))));

  let status: VerificationStatus = 'UNRESOLVED';
  if (contradictions.length > 0 && score < 0.5) {
    status = 'CONTRADICTED';
  } else if (score >= 0.85) {
    status = 'CONFIRMED';
  } else if (score >= 0.65) {
    status = 'HIGH_CONFIDENCE';
  } else if (score >= 0.4) {
    status = 'PARTIAL';
  }

  return {
    finalConfidence: score,
    status,
    evidenceItems: [...evidence],
    contradictionItems: [...contradictions],
  };
}
