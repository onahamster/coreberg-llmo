import { vi } from 'vitest';

export const makeWorkerEnv = (overrides = {}) => ({
  SUPABASE_URL: 'http://localhost:54321',
  SUPABASE_SERVICE_ROLE_KEY: 'test-srk',
  STRIPE_SECRET_KEY: 'sk_test',
  OPENAI_API_KEY: 'test',
  ANTHROPIC_API_KEY: 'test',
  GEMINI_API_KEY: 'test',
  PERPLEXITY_API_KEY: 'test',
  RESEND_API_KEY: 'test',
  ARTICLE_GEN_QUEUE: { send: vi.fn(), sendBatch: vi.fn() },
  ARTICLE_PUBLISH_QUEUE: { send: vi.fn(), sendBatch: vi.fn() },
  CITATION_CHECK_QUEUE: { send: vi.fn(), sendBatch: vi.fn() },
  INDEXNOW_QUEUE: { send: vi.fn() },
  NOTIFICATION_QUEUE: { send: vi.fn() },
  ...overrides,
});
