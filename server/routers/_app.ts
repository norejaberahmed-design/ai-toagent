import { router } from '../trpc';
import { connectorsRouter } from './connectors';

export const appRouter = router({
  connectors: connectorsRouter,
});

export type AppRouter = typeof appRouter;
