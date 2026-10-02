import {
  BusinessConcept,
  DataPeriod,
  ProvenancedValue,
} from '../connectors/types';
import { UnifiedBusinessSnapshot } from '../model/unified';

/**
 * DiscoveryValue alias conforming to frozen P2 ProvenancedValue contract
 */
export type DiscoveryValue<T = unknown> = ProvenancedValue<T>;

/**
 * Severity levels
 */
export enum Severity {
  CRITICAL = 'critical',
  WARNING = 'warning',
  INFO = 'info',
  OPPORTUNITY = 'opportunity',
}

/**
 * Signal types for deterministic discovery
 */
export enum SignalType {
  TREND = 'TREND',
  ANOMALY = 'ANOMALY',
  CONCENTRATION = 'CONCENTRATION',
  DIVERGENCE = 'DIVERGENCE',
  MARGIN_EROSION = 'MARGIN_EROSION',
  CASHFLOW_RISK = 'CASHFLOW_RISK',
  INVENTORY_MISMATCH = 'INVENTORY_MISMATCH',
  RECEIVABLE_AGING = 'RECEIVABLE_AGING',
  OPPORTUNITY = 'OPPORTUNITY',
}

/**
 * Deterministic Signal Interface
 */
export interface Signal {
  readonly id: string;
  readonly type: SignalType;
  readonly severity: Severity;

  readonly title_ar: string;
  readonly explanation_ar: string;

  readonly evidence: readonly DiscoveryValue<unknown>[];

  readonly related_concepts: readonly BusinessConcept[];

  readonly detected_at: string;

  readonly run_id: string;
}

/**
 * Optional breakdown item for concentration / inventory mismatch
 */
export interface BreakdownItem {
  readonly name: string;
  readonly share: number;
  readonly value?: number;
}

/**
 * Configurable thresholds for all detectors
 */
export interface Thresholds {
  readonly trend_slope_min: number;
  readonly anomaly_z_warning: number;
  readonly anomaly_z_critical: number;

  readonly concentration_hhi_warning: number;
  readonly concentration_hhi_critical: number;
  readonly concentration_top1_warning: number;

  readonly divergence_min: number;
  readonly margin_erosion_min: number;

  readonly receivables_to_revenue_warning: number;
  readonly receivables_to_revenue_critical: number;

  readonly cashflow_negative_critical: boolean;
}

/**
 * Default threshold values specified in Master Prompt
 */
export const DEFAULT_THRESHOLDS: Thresholds = {
  trend_slope_min: 0.05,
  anomaly_z_warning: 2.5,
  anomaly_z_critical: 3.5,

  concentration_hhi_warning: 0.25,
  concentration_hhi_critical: 0.40,
  concentration_top1_warning: 0.30,

  divergence_min: 0.10,
  margin_erosion_min: 0.05,

  receivables_to_revenue_warning: 0.5,
  receivables_to_revenue_critical: 1.0,

  cashflow_negative_critical: true,
};

/**
 * Discovery Engine Configuration
 */
export interface DiscoveryConfig {
  readonly thresholds?: Partial<Thresholds>;
  readonly tenant_id: string;
  /**
   * Optional breakdowns supplied alongside snapshots
   */
  readonly breakdowns?: {
    readonly customers?: readonly BreakdownItem[];
    readonly products?: readonly BreakdownItem[];
    readonly inventoryStock?: readonly BreakdownItem[];
  };
}

/**
 * Pure, deterministic SHA-256 calculation (FIPS 180-4 compliant).
 * 100% synchronous, zero external packages, compatible with both Browser and Node.js.
 */
export function computeSha256(data: string): string {
  const bytes = new TextEncoder().encode(data);
  const K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];

  let H0 = 0x6a09e667;
  let H1 = 0xbb67ae85;
  let H2 = 0x3c6ef372;
  let H3 = 0xa54ff53a;
  let H4 = 0x510e527f;
  let H5 = 0x9b05688c;
  let H6 = 0x1f83d9ab;
  let H7 = 0x5be0cd19;

  const bitLen = bytes.length * 8;
  const newLen = (((bytes.length + 8) >> 6) + 1) << 6;
  const padded = new Uint8Array(newLen);
  padded.set(bytes);
  padded[bytes.length] = 0x80;

  const view = new DataView(padded.buffer);
  view.setUint32(newLen - 4, bitLen >>> 0, false);
  view.setUint32(newLen - 8, Math.floor(bitLen / 0x100000000), false);

  const W = new Uint32Array(64);

  for (let i = 0; i < newLen; i += 64) {
    for (let t = 0; t < 16; t++) {
      W[t] = view.getUint32(i + t * 4, false);
    }
    for (let t = 16; t < 64; t++) {
      const s0 =
        ((W[t - 15] >>> 7) | (W[t - 15] << 25)) ^
        ((W[t - 15] >>> 18) | (W[t - 15] << 14)) ^
        (W[t - 15] >>> 3);
      const s1 =
        ((W[t - 2] >>> 17) | (W[t - 2] << 15)) ^
        ((W[t - 2] >>> 19) | (W[t - 2] << 13)) ^
        (W[t - 2] >>> 10);
      W[t] = (W[t - 16] + s0 + W[t - 7] + s1) | 0;
    }

    let a = H0;
    let b = H1;
    let c = H2;
    let d = H3;
    let e = H4;
    let f = H5;
    let g = H6;
    let h = H7;

    for (let t = 0; t < 64; t++) {
      const S1 =
        ((e >>> 6) | (e << 26)) ^
        ((e >>> 11) | (e << 21)) ^
        ((e >>> 25) | (e << 7));
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + K[t] + W[t]) | 0;
      const S0 =
        ((a >>> 2) | (a << 30)) ^
        ((a >>> 13) | (a << 19)) ^
        ((a >>> 22) | (a << 10));
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) | 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) | 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) | 0;
    }

    H0 = (H0 + a) | 0;
    H1 = (H1 + b) | 0;
    H2 = (H2 + c) | 0;
    H3 = (H3 + d) | 0;
    H4 = (H4 + e) | 0;
    H5 = (H5 + f) | 0;
    H6 = (H6 + g) | 0;
    H7 = (H7 + h) | 0;
  }

  return [H0, H1, H2, H3, H4, H5, H6, H7]
    .map((val) => (val >>> 0).toString(16).padStart(8, '0'))
    .join('');
}

/**
 * Computes deterministic Signal ID:
 * SHA-256(type + sorted(evidence provenance/query hashes) + detected_at)
 */
export function computeSignalId(
  type: SignalType,
  evidence: readonly DiscoveryValue<unknown>[],
  detectedAt: string
): string {
  const hashes = evidence
    .map((e) => {
      const p = e.provenance;
      if (!p) return 'no_provenance';
      return `${p.source_id}:${p.connector_id}:${p.query_hash}`;
    })
    .sort();

  const payload = `${type}:${hashes.join(',')}:${detectedAt}`;
  return computeSha256(payload);
}

/**
 * Computes deterministic run_id:
 * SHA-256(sorted(signal_ids))
 */
export function computeRunId(signalIds: readonly string[]): string {
  if (signalIds.length === 0) {
    return computeSha256('empty_discovery_run');
  }
  const sorted = [...signalIds].sort();
  return computeSha256(sorted.join(':'));
}

/**
 * Extracts maximum reliable fetched_at timestamp from evidence.
 * If any evidence lacks valid provenance or timestamp, returns null (cannot create Signal).
 */
export function extractLatestDetectedAt(
  evidence: readonly DiscoveryValue<unknown>[]
): string | null {
  if (evidence.length === 0) return null;

  let maxTime: string | null = null;
  for (const ev of evidence) {
    if (!ev || !ev.provenance || !ev.provenance.fetched_at) {
      return null;
    }
    const ts = ev.provenance.fetched_at;
    if (typeof ts !== 'string' || ts.trim() === '') {
      return null;
    }
    if (maxTime === null || ts > maxTime) {
      maxTime = ts;
    }
  }

  return maxTime;
}

/**
 * Validates currency consistency: all evidence must share identical currency
 */
export function validateCurrencyConsistency(
  evidence: readonly DiscoveryValue<unknown>[]
): { valid: boolean; currency: string | null } {
  if (evidence.length === 0) return { valid: false, currency: null };

  const baseCurrency = evidence[0].currency;
  for (let i = 1; i < evidence.length; i++) {
    if (evidence[i].currency !== baseCurrency) {
      return { valid: false, currency: null };
    }
  }

  return { valid: true, currency: baseCurrency };
}
