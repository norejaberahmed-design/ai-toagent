import initSqlJs, { SqlJsStatic } from 'sql.js';

let SQL_PROMISE: Promise<SqlJsStatic> | null = null;

/**
 * Universal SQL.js WebAssembly Loader
 * Loads the WebAssembly binary directly into memory to prevent streaming/CORS fetch errors
 * both in the browser (Vite dev & prod) and in Node.js (test runner).
 */
export async function getSqlJs(): Promise<SqlJsStatic> {
  if (!SQL_PROMISE) {
    SQL_PROMISE = (async () => {
      // 1. Node.js environment (for automated tests and CLI)
      if (typeof window === 'undefined') {
        try {
          const fs = await import('fs');
          const path = await import('path');
          const wasmPath = path.resolve(process.cwd(), 'node_modules/sql.js/dist/sql-wasm.wasm');
          if (fs.existsSync(wasmPath)) {
            const wasmBinary = fs.readFileSync(wasmPath);
            return await initSqlJs({ wasmBinary });
          }
        } catch (e) {
          console.warn('[SQL.js] Node.js wasmBinary load failed, attempting default locateFile', e);
        }
      }

      // 2. Browser environment: Fetch local WASM directly as ArrayBuffer to avoid streaming compile errors
      if (typeof window !== 'undefined') {
        try {
          const res = await fetch('/sql-wasm.wasm');
          if (res.ok) {
            const wasmBinary = await res.arrayBuffer();
            return await initSqlJs({ wasmBinary });
          }
        } catch (e) {
          console.warn('[SQL.js] Browser fetch /sql-wasm.wasm failed, attempting locateFile fallback', e);
        }
      }

      // 3. Resilient fallback: locateFile to local path
      return await initSqlJs({
        locateFile: (file) => {
          if (file.endsWith('.wasm')) {
            return '/sql-wasm.wasm';
          }
          return file;
        },
      });
    })();
  }
  return SQL_PROMISE;
}
