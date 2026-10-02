/**
 * P3.5 Multi-Tenant & Multi-Source Unified Adapters
 * Principle: الحقيقة قبل الذكاء (Truth Before Intelligence)
 */

export * from './types';
export * from './base-adapter';
export * from './postgres-adapter';
export * from './sqlite-adapter';
export * from './csv-adapter';
export * from './excel-adapter';
export * from './adapter-registry';
export * from './tenant-manager';
export * from './multi-source-pipeline';
