import { describe, it, expect } from 'vitest';
import { computeHealthScore } from './score';

describe('computeHealthScore', () => {
  it('returns 0 for empty inputs', () => {
    expect(computeHealthScore({ generation: 0, citation: 0, quality: 0, distribution: 0 }).total).toBe(0);
  });

  it('weights citation highest (35%)', () => {
    const a = computeHealthScore({ generation: 0, citation: 100, quality: 0, distribution: 0 });
    const b = computeHealthScore({ generation: 100, citation: 0, quality: 0, distribution: 0 });
    expect(a.total).toBeGreaterThan(b.total);
    expect(a.total).toBe(35);
    expect(b.total).toBe(30);
  });

  it('caps at 100', () => {
    expect(computeHealthScore({ generation: 100, citation: 100, quality: 100, distribution: 100 }).total).toBe(100);
  });
});
