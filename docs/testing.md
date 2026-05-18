# Coreberg LLMO - Testing & Quality Assurance Guide

This guide details the testing framework setup, mocking conventions, and quality standards for the Coreberg LLMO monorepo.

## Test Pyramid & Classifications

1. **Unit Tests (Vitest)**: Fast, pure tests. Used for utilities, algorithmic score evaluations, and business boundary checkers.
2. **Workers Pool (vitest-pool-workers)**: Runs code directly inside the Cloudflare Workers V8 sandbox.
3. **Integration Tests (local Supabase)**: Validates database connections, active RLS constraints, and complex subscription triggers.
4. **E2E Tests (Playwright)**: Full browser interactions across desktop Chrome, Safari, and mobile viewports.

## Writing Unit Tests
Place tests inside the package's `src/` directory, named with the `.test.ts` extension. Use Faker factories via `@coreberg/test-utils` to generate stable mock data:
```typescript
import { makeProject } from '@coreberg/test-utils';

const prj = makeProject({ name: 'Special Project' });
```

## Mocking External APIs
Always block real network requests. Use **MSW (Mock Service Worker)** node server adapters initialized under `vitest.setup.ts`.
To override a mock handler inside an individual test:
```typescript
import { mswServer } from '../../vitest.setup';
import { http, HttpResponse } from 'msw';

mswServer.use(
  http.post('https://api.openai.com/v1/chat/completions', () => {
    return HttpResponse.json({ choices: [] });
  })
);
```
