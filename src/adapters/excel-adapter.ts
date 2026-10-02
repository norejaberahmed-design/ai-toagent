/**
 * Excel Adapter Implementation
 * Principle: الحقيقة قبل الذكاء (Truth Before Intelligence)
 *
 * Real Excel Processing via SheetJS:
 * - Multi-sheet workbook parsing (.xlsx, .xls)
 * - Exact formula value extraction (.v property preservation)
 * - Empty sheet resilient handling
 * - Accurate cell data typing (numbers, strings, dates, booleans)
 * - Deterministic schema snapshot & hash across all worksheets
 * - Bounded fetch producing DataBatch with provenance
 */

import * as XLSX from 'xlsx';
import { BaseAdapter } from './base-adapter';
import {
  ConnectorMeta,
  ConnectionState,
  Credentials,
  TestResult,
  SchemaSnapshot,
  SemanticMapping,
  ROReport,
  DataPeriod,
  DataBatch,
  BusinessConcept,
  BoundedFetchOptions,
} from './types';
import { deterministicContentHash } from '../engine/hash';
import { mapTablesToBusinessConcepts } from '../connectors/semanticMapper';

export interface ExcelCredentials extends Credentials {
  fileBuffer?: Uint8Array;
  fileName?: string;
  selectedSheet?: string;
}

export class ExcelAdapter extends BaseAdapter {
  private sheetsData: Record<string, Array<Record<string, unknown>>> = {};
  private sheetHeaders: Record<string, string[]> = {};
  private fileName: string = 'data.xlsx';

  public meta(): ConnectorMeta {
    return {
      id: 'excel',
      category: 'file',
      displayNameAr: 'جداول مصنفات Excel (.xlsx / .xls)',
      displayNameEn: 'Excel Workbook Sheets',
      requiresOAuth: false,
      readOnlySupported: true,
      status: 'IMPLEMENTED',
      supportedFormats: ['.xlsx', '.xls', '.xlsm'],
    };
  }

  public async connect(creds: Credentials): Promise<ConnectionState> {
    const excelCreds = creds as ExcelCredentials;
    this.credentials = excelCreds;
    this.fileName = excelCreds.fileName || 'data.xlsx';

    if (!excelCreds.fileBuffer || excelCreds.fileBuffer.length === 0) {
      this.state = 'DISCONNECTED';
      return this.state;
    }

    try {
      const workbook = XLSX.read(excelCreds.fileBuffer, {
        type: 'array',
        cellDates: true,
        cellNF: false,
        cellText: false,
      });

      if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
        throw new Error('مصنف Excel لا يحتوي على أي صفحات عمل صالحة.');
      }

      this.sheetsData = {};
      this.sheetHeaders = {};

      for (const sheetName of workbook.SheetNames) {
        const worksheet = workbook.Sheets[sheetName];
        if (!worksheet) continue;

        // sheet_to_json with defval: null extracts calculated formula values
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
          defval: null,
          raw: true, // retrieves the evaluated primitive values
        });

        if (rows && rows.length > 0) {
          this.sheetsData[sheetName] = rows;
          const firstRow = rows[0] || {};
          this.sheetHeaders[sheetName] = Object.keys(firstRow);
        }
      }

      const activeSheets = Object.keys(this.sheetsData);
      if (activeSheets.length === 0) {
        throw new Error('جميع صفحات مصنف Excel فارغة أو لا تحتوي على صفوف بيانات.');
      }

      this.state = 'CONNECTED';
      this.lastVerifiedAt = new Date().toISOString();
      return this.state;
    } catch (err: any) {
      this.state = 'DISCONNECTED';
      this.sheetsData = {};
      this.sheetHeaders = {};
      throw err;
    }
  }

  public async testConnection(): Promise<TestResult> {
    const startTime = Date.now();
    const sheetCount = Object.keys(this.sheetsData).length;

    if (this.state !== 'CONNECTED' || sheetCount === 0) {
      return {
        ok: false,
        latencyMs: 0,
        verifiedAt: new Date().toISOString(),
        errorCode: 'NO_SOURCE',
        message: 'مصنف Excel غير متصل أو لا يحتوي على صفحات عمل صالحة.',
      };
    }

    return {
      ok: true,
      latencyMs: Date.now() - startTime,
      verifiedAt: new Date().toISOString(),
      discoveredTablesCount: sheetCount,
      readOnlyGuaranteed: true,
    };
  }

  public async readOnlyCheck(): Promise<ROReport> {
    return {
      isReadOnly: true,
      enforcementActive: true,
      checks: [
        {
          name: 'Memory-Isolated Buffer Safety',
          passed: true,
          detail: 'مصنف Excel مفحوص في ذاكرة القراءة فقط، محصن ضد أي تعديل على الملف المصدر.',
        },
      ],
    };
  }

  public async discover(): Promise<SchemaSnapshot> {
    if (this.state !== 'CONNECTED') {
      throw new Error('مصنف Excel غير متصل.');
    }

    const tables: SchemaSnapshot['tables'] = [];

    for (const [sheetName, rows] of Object.entries(this.sheetsData)) {
      const sample = rows[0] || {};
      const columns = Object.keys(sample).map((key) => {
        const val = sample[key];
        let type = 'TEXT';
        if (typeof val === 'number') type = 'NUMBER';
        else if (typeof val === 'boolean') type = 'BOOLEAN';
        else if (val instanceof Date) type = 'DATE';

        return {
          name: key,
          type,
          nullable: true,
        };
      });

      tables.push({
        name: sheetName,
        columns,
        rowCountEstimate: rows.length,
      });
    }

    const hash = this.computeSchemaHash(tables);
    const snapshot: SchemaSnapshot = {
      capturedAt: new Date().toISOString(),
      tables,
      hash,
    };

    this.lastSchemaSnapshot = snapshot;
    return snapshot;
  }

  public async map(schema: SchemaSnapshot): Promise<SemanticMapping> {
    const tableNames = schema.tables.map((t) => t.name);
    const conceptMap = mapTablesToBusinessConcepts(tableNames);

    const fields: SemanticMapping['fields'] = [];

    for (const table of schema.tables) {
      for (const col of table.columns) {
        let concept: BusinessConcept | null = null;
        if (conceptMap.sales === table.name) concept = 'sales';
        else if (conceptMap.products === table.name) concept = 'product';
        else if (conceptMap.customers === table.name) concept = 'customer';
        else if (conceptMap.expenses === table.name) concept = 'expense';

        if (concept) {
          fields.push({
            businessConcept: concept,
            sourceTable: table.name,
            sourceColumn: col.name,
            transform: 'NONE',
            confidence: 0.85,
          });
        }
      }
    }

    return {
      version: '1.0.0',
      approvedBy: 'ExcelAdapter.SemanticMapper',
      fields,
    };
  }

  public async fetch(
    concept: BusinessConcept,
    period: DataPeriod,
    options?: BoundedFetchOptions
  ): Promise<DataBatch> {
    if (this.state !== 'CONNECTED') {
      throw new Error('مصنف Excel غير متصل.');
    }

    const limit = Math.min(Math.max(options?.limit ?? 1000, 1), 50000);
    const offset = Math.max(options?.offset ?? 0, 0);

    const schema = this.lastSchemaSnapshot || (await this.discover());
    const mapping = await this.map(schema);
    const targetField = mapping.fields.find((f) => f.businessConcept === concept);
    const targetSheet = targetField ? targetField.sourceTable : Object.keys(this.sheetsData)[0];

    const rows = this.sheetsData[targetSheet] || [];
    const sliced = rows.slice(offset, offset + limit);

    const queryHash = deterministicContentHash({
      fileName: this.fileName,
      sheet: targetSheet,
      limit,
      offset,
      totalRows: rows.length,
    });

    return {
      concept,
      period,
      rows: sliced,
      actualRowCount: sliced.length,
      provenance: this.createProvenance({
        sourceRef: `file://excel/${this.fileName}#${targetSheet}`,
        queryHash,
        fetchedAt: new Date().toISOString(),
        confidence: 0.95,
        isComplete: offset + sliced.length >= rows.length,
      }),
    };
  }
}
