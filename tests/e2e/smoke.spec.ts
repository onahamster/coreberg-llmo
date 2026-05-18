import { test, expect } from '@playwright/test';

test('landing home page loaded with status 200', async ({ page }) => {
  const res = await page.goto('/');
  expect(res?.status()).toBe(200);
});

test('login portal renders input tags', async ({ page }) => {
  await page.goto('/login');
  await expect(page.locator('input[name=email]')).toBeVisible();
  await expect(page.locator('input[name=password]')).toBeVisible();
});

test('system health check returns ok', async ({ page }) => {
  const res = await page.goto('/api/health');
  expect(res?.status()).toBe(200);
  const json = await res?.json();
  expect(json.ok).toBe(true);
});
