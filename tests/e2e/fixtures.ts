import { test as base, expect } from '@playwright/test';
import { testSupabase } from '@coreberg/test-utils';

export const test = base.extend<{ authedPage: any }>({
  authedPage: async ({ page }, use) => {
    const sb = testSupabase();
    const email = `e2e+${Date.now()}@coreberg.test`;
    const { data, error } = await sb.auth.admin.createUser({
      email,
      password: 'TestPass123!',
      email_confirm: true,
    });
    if (error || !data.user) {
      throw new Error(`Failed to create E2E auth test user: ${error?.message}`);
    }
    
    await page.goto('/login');
    await page.fill('[name=email]', email);
    await page.fill('[name=password]', 'TestPass123!');
    await page.click('button[type=submit]');
    await page.waitForURL('**/projects');
    
    await use(page);
    
    await sb.auth.admin.deleteUser(data.user.id);
  },
});

export { expect };
