import { expect } from 'vitest';

expect.extend({
  toBeValidISO(received: string) {
    const d = new Date(received);
    const pass = !isNaN(d.getTime()) && received.includes('T');
    return {
      pass,
      message: () => `expected ${received} to be ISO date string`,
    };
  },
  toMatchSchema(received: unknown, schema: { safeParse: (v: unknown) => { success: boolean; error?: unknown } }) {
    const r = schema.safeParse(received);
    return {
      pass: r.success,
      message: () => `expected value to match schema, got ${JSON.stringify(r.error)}`,
    };
  },
});
