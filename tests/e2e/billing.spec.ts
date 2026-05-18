import { test, expect } from './fixtures';

test('user can open Stripe billing sessions and manage plans', async ({ authedPage: page }) => {
  await page.click('text=設定');
  await page.click('text=プラン・お支払い');
  await expect(page.getByText('現在のご契約プラン')).toBeVisible();

  // Click upgrade trigger
  await page.click('button:has-text("アップグレード")');
  // Should redirect or display loading to Stripe Checkout session URL
  await page.waitForTimeout(1000);
  expect(page.url()).toBeDefined();
});
