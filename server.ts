import express from 'express';
import { createServer as createViteServer } from 'vite';
import { createExpressMiddleware } from '@trpc/server/adapters/express';
import { appRouter } from './server/routers/_app';
import path from 'path';

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;
  const isProd = process.env.NODE_ENV === 'production';

  app.use(express.json());
  // Explicitly serve public assets (like sql-wasm.wasm)
  app.use(express.static(path.resolve(process.cwd(), 'public')));

  // Mount tRPC router on /trpc
  app.use(
    '/trpc',
    createExpressMiddleware({
      router: appRouter,
      createContext: () => ({}),
    })
  );

  if (!isProd) {
    // Development mode: Mount Vite middlewares for HMR and SPA serving
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Production mode: Serve built static files
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Universal Connectors Backend] Running on http://0.0.0.0:${PORT} (tRPC mounted at /trpc)`);
  });
}

startServer().catch((err) => {
  console.error('[Server Error]', err);
  process.exit(1);
});
