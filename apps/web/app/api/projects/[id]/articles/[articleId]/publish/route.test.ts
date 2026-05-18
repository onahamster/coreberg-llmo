import { describe, it, expect, vi } from 'vitest';
import { POST } from './route';

describe('POST /publish', () => {
  it('returns 403 when caller not project owner', async () => {
    vi.mock('@/lib/auth', () => ({ requireUser: () => ({ id: 'u-other' }) }));
    vi.mock('@/lib/supabase/server', () => ({
      serverSupabase: () => ({
        from: () => ({
          select: () => ({
            eq: () => ({
              single: () => ({ data: { owner_id: 'u-owner' } }),
            }),
          }),
        }),
      }),
    }));
    const req = new Request('http://localhost/api/projects/p1/articles/a1/publish', { method: 'POST' });
    const res = await POST(req, { params: { id: 'p1', articleId: 'a1' } } as any);
    expect(res.status).toBe(403);
  });
});
