# Operations Runbook - Production Deployment Procedure

This runbook outlines the required actions to safely roll database schema modifications and application code to the Production environment.

## Phase 1: Database Migrations
1. Run local verification tests:
   ```bash
   supabase db lint
   ```
2. Deploy migration push to production Supabase:
   ```bash
   supabase db push --linked
   ```
3. Verify table columns and RLS rules in the Supabase Dashboard.

## Phase 2: Cloudflare Workers
1. Verify Workers bundle compiles cleanly:
   ```bash
   pnpm --filter @coreberg/workers build
   ```
2. Trigger deploy using Wrangler:
   ```bash
   pnpm --filter @coreberg/workers wrangler deploy
   ```

## Phase 3: Cloudflare Pages (Frontend Web)
1. Build statically-exported web directory:
   ```bash
   pnpm --filter @coreberg/web build
   ```
2. Publish built static outputs:
   ```bash
   pnpm --filter @coreberg/web wrangler pages deploy apps/web/.vercel/output/static --project-name coreberg-web
   ```

## Phase 4: Verification (Smoke Tests)
1. Execute the Playwright smoke suite:
   ```bash
   E2E_BASE_URL=https://coreberg.app pnpm test:e2e tests/e2e/smoke.spec.ts
   ```
