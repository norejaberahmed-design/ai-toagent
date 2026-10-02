/**
 * CSV Adapter Implementation
 * Principle: الحقيقة قبل الذكاء (Truth Before Intelligence)
 *
 * Real CSV Processing via PapaParse:
 * - Full Arabic & UTF-8 character support
 * - Dynamic delimiter detection (, ; \t |)
 * - Quoted fields, embedded commas, escaped quotes (""), multiline fields
 * - Missing/null field handling, empty lines handling
 * - Deterministic schema snapshot & hash
 * - Bounded fetch producing DataBatch with provenance
 */

import Papa from 'papaparse';
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

export interface CSVCredentials extends Credentials {
  fileBuffer?: Uint8Array;
  csvString?: string;
  fileName?: string;
  delimiter?: string;
}

export class CSVAdapter extends BaseAdapter {
  private rows: Array<Record<string, unknown>> = [];
  private headers: string[] = [];
  private fileName: string = 'data.csv';

  public meta(): ConnectorMeta {
    return {
      id: 'csv',
      category: 'file',
      displayNameAr: 'ملف CSV المجدول',
      displayNameEn: 'Delimited CSV File',
      requiresOAuth: false,
      readOnlySupported: true,
      status: 'IMPLEMENTED',
      supportedFormats: ['.csv', '.tsv', '.txt'],
    };
  }

  public async connect(creds: Credentials): Promise<ConnectionState> {
    const csvCreds = creds as CSVCredentials;
    this.credentials = csvCreds;
    this.fileName = csvCreds.fileName || 'data.csv';

    let content = '';
    if (csvCreds.csvString) {
      content = csvCreds.csvString;
    } else if (csvCreds.fileBuffer && csvCreds.fileBuffer.length > 0) {
      const decoder = new TextDecoder('utf-8');
      content = decoder.decode(csvCreds.fileBuffer);
    } else {
      this.state = 'DISCONNECTED';
      return this.state;
    }

    if (!content.trim()) {
      this.state = 'DISCONNECTED';
      throw new Error('ملف CSV فارغ ولا يحتوي على محتوى صالح.');
    }

    try {
      const parsed = Papa.parse<Record<string, unknown>>(content, {
        header: true,
        skipEmptyLines: 'greedy',
        dynamicTyping: true,
        delimiter: csvCreds.delimiter || '', // Auto-detect delimiter
        transformHeader: (header, index) => {
          const trimmed = header.trim();
          return trimmed ? trimmed : `col_${index + 1}`;
        },
      });

      // Handle duplicate headers deterministically
      const seenHeaders: Record<string, number> = {};
      const uniqueHeaders: string[] = [];

      for (const h of parsed.meta.fields || []) {
        if (!seenHeaders[h]) {
          seenHeaders[h] = 1;
          uniqueHeaders.push(h);
        } else {
          seenHeaders[h]++;
          uniqueHeaders.push(`${h}_${seenHeaders[h]}`);
        }
      }

      this.headers = uniqueHeaders;
      this.rows = parsed.data || [];

      if (this.rows.length === 0) {
        throw new Error('ملف CSV لا يحتوي على أي صفوف بيانات بعد تحليل العناوين.');
      }

      this.state = 'CONNECTED';
      this.lastVerifiedAt = new Date().toISOString();
      return this.state;
    } catch (err: any) {
      this.state = 'DISCONNECTED';
      this.rows = [];
      this.headers = [];
      throw err;
    }
  }

  public async testConnection(): Promise<TestResult> {
    const startTime = Date.now();
    if (this.state !== 'CONNECTED' || this.rows.length === 0) {
      return {
        ok: false,
        latencyMs: 0,
        verifiedAt: new Date().toISOString(),
        errorCode: 'NO_SOURCE',
        message: 'ملف CSV غير متصل أو لا يحتوي على صفوف بيانات صالحة.',
      };
    }

    return {
      ok: true,
      latencyMs: Date.now() - startTime,
      verifiedAt: new Date().toISOString(),
      discoveredTablesCount: 1,
      readOnlyGuaranteed: true,
    };
  }

  public async readOnlyCheck(): Promise<ROReport> {
    return {
      isReadOnly: true,
      enforcementActive: true,
      checks: [
        {
          name: 'Immutable Memory Representation',
          passed: true,
          detail: 'البيانات مفحوصة في الذاكرة المعزولة بصيغة القراءة فقط ولا يمكن الكتابة إلى الملف المصدر.',
        },
      ],
    };
  }

  public async discover(): Promise<SchemaSnapshot> {
    if (this.state !== 'CONNECTED' || this.headers.length === 0) {
      throw new Error('ملف CSV غير متصل.');
    }

    const tableName = this.fileName.replace(/\.[^/.]+$/, '') || 'records';
    const sample = this.rows[0] || {};

    const columns = this.headers.map((colName) => {
      const val = sample[colName];
      let type = 'TEXT';
      if (typeof val === 'number') {
        type = 'NUMBER';
      } else if (typeof val === 'boolean') {
        type = 'BOOLEAN';
      } else if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}/.test(val)) {
        type = 'DATE';
      }

      return {
        name: colName,
        type,
        nullable: true,
      };
    });

    const tables: SchemaSnapshot['tables'] = [
      {
        name: tableName,
        columns,
        rowCountEstimate: this.rows.length,
      },
    ];

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
    const table = schema.tables[0];

    if (table) {
      for (const col of table.columns) {
        let concept: BusinessConcept | null = null;
        const lower = col.name.toLowerCase();
        if (
          lower.includes('sale') ||
          lower.includes('invoice') ||
          lower.includes('order') ||
          lower.includes('مبيع') ||
          lower.includes('فاتورة')
        ) {
          concept = 'sales';
        } else if (lower.includes('product') || lower.includes('item') || lower.includes('منتج') || lower.includes('صنف')) {
          concept = 'product';
        } else if (lower.includes('customer') || lower.includes('client') || lower.includes('عميل')) {
          concept = 'customer';
        } else if (lower.includes('expense') || lower.includes('cost') || lower.includes('مصروف') || lower.includes('تكلفة')) {
          concept = 'expense';
        }

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
      approvedBy: 'CSVAdapter.SemanticMapper',
      fields,
    };
  }

  public async fetch(
    concept: BusinessConcept,
    period: DataPeriod,
    options?: BoundedFetchOptions
  ): Promise<DataBatch> {
    if (this.state !== 'CONNECTED') {
      throw new Error('ملف CSV غير متصل.');
    }

    const limit = Math.min(Math.max(options?.limit ?? 1000, 1), 50000);
    const offset = Math.max(options?.offset ?? 0, 0);

    const sliced = this.rows.slice(offset, offset + limit);
    const queryHash = deterministicContentHash({
      fileName: this.fileName,
      totalRows: this.rows.length,
      limit,
      offset,
    });

    return {
      concept,
      period,
      rows: sliced,
      actualRowCount: sliced.length,
      provenance: this.createProvenance({
        sourceRef: `file://csv/${this.fileName}`,
        queryHash,
        fetchedAt: new Date().toISOString(),
        confidence: 0.95,
        isComplete: offset + sliced.length >= this.rows.length,
      }),
    };
  }
}
