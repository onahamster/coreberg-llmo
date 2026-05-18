import { describe, it, expect } from 'vitest';
import { processStripeEvent } from './webhook';
import { makeStripeEvent } from '@coreberg/test-utils';

describe('processStripeEvent', () => {
  it('returns "duplicate" on second invocation with same event id', async () => {
    const inserts: any[] = [];
    const sb: any = {
      from: () => ({
        insert: (row: any) => {
          if (inserts.find(r => r.id === row.id)) {
            return Promise.resolve({ error: { code: '23505' } });
          }
          inserts.push(row);
          return Promise.resolve({ error: null });
        },
        update: () => ({ eq: () => Promise.resolve({ error: null }) }),
        upsert: () => Promise.resolve({ error: null }),
      }),
    };
    const ev = makeStripeEvent('customer.subscription.created', { id: 'sub_1', customer: 'cus_1', items: { data: [] } });
    const r1 = await processStripeEvent(sb, ev as any);
    const r2 = await processStripeEvent(sb, ev as any);
    expect(r1.status).toBe('processed');
    expect(r2.status).toBe('duplicate');
  });
});
