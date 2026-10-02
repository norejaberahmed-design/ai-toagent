/**
 * tRPC Connectors Router
 * Principle: الحقيقة قبل الذكاء (Truth Before Intelligence)
 *
 * Implements typed RPC procedures for:
 * - PostgreSQL (test, connect, discover, read, disconnect)
 * - MySQL (test, connect, discover, read, disconnect)
 * - System connectors health & status
 */

import { z } from 'zod';
import { router, publicProcedure } from '../trpc';
import { dbConnectionManager } from '../db/connection-manager';

export const connectorsRouter = router({
  // ==========================================
  // PostgreSQL Procedures
  // ==========================================
  testPostgres: publicProcedure
    .input(
      z.object({
        host: z.string().min(1, 'المضيف مطلوب'),
        port: z.number().optional().default(5432),
        database: z.string().min(1, 'اسم قاعدة البيانات مطلوب'),
        user: z.string().min(1, 'اسم المستخدم مطلوب'),
        password: z.string().optional(),
        ssl: z.boolean().optional().default(false),
      })
    )
    .mutation(async ({ input }) => {
      return await dbConnectionManager.testPostgres(input);
    }),

  connectPostgres: publicProcedure
    .input(
      z.object({
        host: z.string().min(1),
        port: z.number().optional().default(5432),
        database: z.string().min(1),
        user: z.string().min(1),
        password: z.string().optional(),
        ssl: z.boolean().optional().default(false),
      })
    )
    .mutation(async ({ input }) => {
      return await dbConnectionManager.connectPostgres(input);
    }),

  discoverPostgres: publicProcedure
    .input(
      z.object({
        sessionId: z.string().min(1),
      })
    )
    .query(async ({ input }) => {
      return await dbConnectionManager.discoverPostgres(input.sessionId);
    }),

  readPostgres: publicProcedure
    .input(
      z.object({
        sessionId: z.string().min(1),
        tableName: z.string().min(1),
        limit: z.number().optional().default(1000),
      })
    )
    .mutation(async ({ input }) => {
      return await dbConnectionManager.readPostgres(input.sessionId, input.tableName, input.limit);
    }),

  disconnectPostgres: publicProcedure
    .input(
      z.object({
        sessionId: z.string().min(1),
      })
    )
    .mutation(async ({ input }) => {
      return await dbConnectionManager.disconnectPostgres(input.sessionId);
    }),

  // ==========================================
  // MySQL Procedures
  // ==========================================
  testMySQL: publicProcedure
    .input(
      z.object({
        host: z.string().min(1, 'المضيف مطلوب'),
        port: z.number().optional().default(3306),
        database: z.string().min(1, 'اسم قاعدة البيانات مطلوب'),
        user: z.string().min(1, 'اسم المستخدم مطلوب'),
        password: z.string().optional(),
        ssl: z.boolean().optional().default(false),
      })
    )
    .mutation(async ({ input }) => {
      return await dbConnectionManager.testMySQL(input);
    }),

  connectMySQL: publicProcedure
    .input(
      z.object({
        host: z.string().min(1),
        port: z.number().optional().default(3306),
        database: z.string().min(1),
        user: z.string().min(1),
        password: z.string().optional(),
        ssl: z.boolean().optional().default(false),
      })
    )
    .mutation(async ({ input }) => {
      return await dbConnectionManager.connectMySQL(input);
    }),

  discoverMySQL: publicProcedure
    .input(
      z.object({
        sessionId: z.string().min(1),
      })
    )
    .query(async ({ input }) => {
      return await dbConnectionManager.discoverMySQL(input.sessionId);
    }),

  readMySQL: publicProcedure
    .input(
      z.object({
        sessionId: z.string().min(1),
        tableName: z.string().min(1),
        limit: z.number().optional().default(1000),
      })
    )
    .mutation(async ({ input }) => {
      return await dbConnectionManager.readMySQL(input.sessionId, input.tableName, input.limit);
    }),

  disconnectMySQL: publicProcedure
    .input(
      z.object({
        sessionId: z.string().min(1),
      })
    )
    .mutation(async ({ input }) => {
      return await dbConnectionManager.disconnectMySQL(input.sessionId);
    }),

  // ==========================================
  // General Connector Info
  // ==========================================
  getConnectorCatalog: publicProcedure.query(async () => {
    return [
      { id: 'postgresql', name: 'PostgreSQL', status: 'ready', type: 'sql_server' },
      { id: 'mysql', name: 'MySQL', status: 'ready', type: 'sql_server' },
      { id: 'sqlite', name: 'SQLite', status: 'ready', type: 'file' },
      { id: 'excel', name: 'Excel (XLSX)', status: 'ready', type: 'file' },
      { id: 'csv', name: 'CSV', status: 'ready', type: 'file' },
      { id: 'odoo', name: 'Odoo API', status: 'adapter_ready', type: 'erp_api' },
      { id: 'quickbooks', name: 'QuickBooks API', status: 'adapter_ready', type: 'accounting_api' },
      { id: 'zohobooks', name: 'Zoho Books API', status: 'adapter_ready', type: 'accounting_api' },
      { id: 'wafeq', name: 'Wafeq API', status: 'adapter_ready', type: 'accounting_api' },
      { id: 'qoyod', name: 'Qoyod API', status: 'adapter_ready', type: 'accounting_api' },
    ];
  }),
});
