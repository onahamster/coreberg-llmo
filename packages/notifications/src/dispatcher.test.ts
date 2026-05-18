import { describe, it, expect, vi } from 'vitest';
import { dispatchNotification } from './dispatcher';

describe('dispatchNotification', () => {
  it('deduplicates by dedupe_key', async () => {
    const inserted: any[] = [];
    const sb: any = {
      from: (t: string) => ({
        select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: { is_critical: false, channels: ['in_app'] } }) }) }),
        upsert: (row: any, opts: any) => {
          const exists = inserted.find(r => r.dedupe_key === row.dedupe_key && r.recipient_id === row.recipient_id);
          if (exists) {
            return { select: () => ({ single: () => Promise.resolve({ data: exists }) }) };
          }
          inserted.push(row);
          return { select: () => ({ single: () => Promise.resolve({ data: row }) }) };
        },
        insert: () => Promise.resolve({ error: null }),
      }),
      auth: { admin: { getUserById: () => Promise.resolve({ data: { user: { email: 't@t.com' } } }) } },
    };
    const env: any = {};
    const payload = { recipientId: 'u1', type: 'article.published', dedupeKey: 'k1', data: { title: 'x' } };
    await dispatchNotification(sb, env, payload as any);
    await dispatchNotification(sb, env, payload as any);
    expect(inserted).toHaveLength(1);
  });
});
