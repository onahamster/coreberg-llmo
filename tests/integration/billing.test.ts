import { describe, it, expect, afterAll } from 'vitest';
import { testSupabase, cleanTables, withTestOwner } from '@coreberg/test-utils';
import { processStripeEvent } from '@coreberg/billing';
import { makeStripeEvent } from '@coreberg/test-utils';

describe('billing integration', () => {
  afterAll(async () => {
    await cleanTables(['subscriptions', 'stripe_events', 'invoices']);
  });

  it('creates subscription row on customer.subscription.created webhook', async () => {
    await withTestOwner(async (ownerId) => {
      const sb = testSupabase();
      const { data: project } = await sb
        .from('projects')
        .insert({ owner_id: ownerId, name: 'T', domain: 't.com' })
        .select()
        .single();

      const ev = makeStripeEvent('customer.subscription.created', {
        id: 'sub_int_1', customer: 'cus_int_1', status: 'active',
        items: { data: [{ price: { id: 'price_starter' } }] },
        metadata: { project_id: project!.id, plan_id: 'starter' },
        current_period_end: Math.floor(Date.now() / 1000) + 86400 * 30,
      });

      await processStripeEvent(sb as any, ev as any);
      const { data: sub } = await sb.from('subscriptions').select('*').eq('stripe_subscription_id', 'sub_int_1').single();
      expect(sub?.status).toBe('active');
    });
  });
});
