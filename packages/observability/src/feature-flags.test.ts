import { describe, it, expect } from 'vitest';
import { evaluate as evaluateFlag } from './feature-flags';

describe('evaluateFlag', () => {
  const flag = (over = {}) => ({
    key: 'new-ui', enabled: true, rollout_percent: 50,
    allowed_user_ids: [], allowed_plans: [], disallowed_user_ids: [], variants: {},
    ...over,
  }) as any;

  it('returns false when disabled', () => {
    expect(evaluateFlag(flag({ enabled: false }), { userId: 'u1' })).toBe(false);
  });

  it('allow-list overrides rollout', () => {
    expect(evaluateFlag(flag({ rollout_percent: 0, allowed_user_ids: ['u1'] }), { userId: 'u1' })).toBe(true);
  });

  it('deny-list overrides allow-list', () => {
    const f = flag({ allowed_user_ids: ['u1'], disallowed_user_ids: ['u1'] });
    expect(evaluateFlag(f, { userId: 'u1' })).toBe(false);
  });

  it('deterministic bucketing for same userId', () => {
    const f = flag({ rollout_percent: 50 });
    const r1 = evaluateFlag(f, { userId: 'u-stable' });
    const r2 = evaluateFlag(f, { userId: 'u-stable' });
    expect(r1).toBe(r2);
  });
});
