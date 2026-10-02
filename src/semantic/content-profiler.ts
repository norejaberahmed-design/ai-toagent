import { DataBatch } from '../connectors/types';
import { profileTable } from './table-profiler';
import { TableProfile } from './types';

export interface DatasetProfile {
  tables: Record<string, TableProfile>;
  totalRows: number;
  totalTables: number;
  analyzedAt: string;
}

/**
 * Pure Content Profiler
 * Analyzes tabular data batches purely based on values and patterns.
 * Zero I/O, zero Date.now() / Math.random().
 */
export function profileDataset(
  tablesData: Record<string, Record<string, unknown>[]>
): DatasetProfile {
  const tableProfiles: Record<string, TableProfile> = {};
  let totalRows = 0;

  const tableNames = Object.keys(tablesData).sort();

  for (const name of tableNames) {
    const rows = tablesData[name] || [];
    const prof = profileTable(name, rows);
    tableProfiles[name] = prof;
    totalRows += rows.length;
  }

  return {
    tables: tableProfiles,
    totalRows,
    totalTables: tableNames.length,
    analyzedAt: '1970-01-01T00:00:00Z',
  };
}

/**
 * Profiles from DataBatch array.
 */
export function profileFromBatches(batches: DataBatch[]): DatasetProfile {
  const tablesData: Record<string, Record<string, unknown>[]> = {};

  for (const b of batches) {
    const tableName = b.provenance.source_ref || String(b.concept);
    const existing = tablesData[tableName] || [];
    tablesData[tableName] = existing.concat(b.rows);
  }

  return profileDataset(tablesData);
}
