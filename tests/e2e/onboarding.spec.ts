import { test, expect } from './fixtures';

test('user can create project and connect WordPress', async ({ authedPage: page }) => {
  await page.click('text=新規プロジェクト');
  await page.fill('[name=name]', 'E2E Project');
  await page.fill('[name=domain]', 'e2e.example.com');
  await page.click('button:has-text("作成")');
  await expect(page).toHaveURL(/\/projects\/[^/]+$/);

  await page.click('text=配信');
  await page.fill('[name=wp_url]', 'https://wp.e2e.test');
  await page.fill('[name=wp_user]', 'admin');
  await page.fill('[name=wp_pass]', 'app-pass-xxxx-xxxx');
  await page.click('button:has-text("接続テスト")');
  await expect(page.getByText('接続成功')).toBeVisible({ timeout: 10_000 });
});
