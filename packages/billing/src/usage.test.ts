import { describe, it, expect, vi } from 'vitest';
import { checkArticleQuota, requireArticleQuota } from './usage';
import { UsageLimitExceededError } from './errors';

describe('checkArticleQuota', () => {
  const sb = (used: number, limit: number) => ({
    rpc: vi.fn().mockResolvedValue({ data: { used, limit, remaining: Math.max(0, limit - used) }, error: null }),
  }) as any;

  it('returns allowed when under limit', async () => {
    const r = await checkArticleQuota(sb(10, 30), 'prj_1');
    expect(r.allowed).toBe(true);
    expect(r.remaining).toBe(20);
  });

  it('returns allowed=false when exactly at limit and plan blocks', async () => {
    const r = await checkArticleQuota(sb(30, 30), 'prj_1', { policy: 'block' });
    expect(r.allowed).toBe(false);
  });

  it('returns allowed=true with overage when policy is auto_charge', async () => {
    const r = await checkArticleQuota(sb(30, 30), 'prj_1', { policy: 'auto_charge' });
    expect(r.allowed).toBe(true);
    expect(r.willOverage).toBe(true);
  });

  it('requireArticleQuota throws when blocked', async () => {
    await expect(requireArticleQuota(sb(30, 30), 'prj_1', { policy: 'block' }))
      .rejects.toBeInstanceOf(UsageLimitExceededError);
  });
});
