import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
  'packages/*/vitest.config.ts',
  'apps/web/vitest.config.ts',
  'apps/admin/vitest.config.ts',
  {
    test: {
      name: 'workers',
      include: ['apps/workers/**/*.test.ts', 'packages/workers-shared/**/*.test.ts'],
      poolOptions: {
        workers: { wrangler: { configPath: './apps/workers/wrangler.toml' } },
      },
    },
  },
]);
