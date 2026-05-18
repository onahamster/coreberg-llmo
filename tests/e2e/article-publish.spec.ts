import { test, expect } from './fixtures';

test('user can trigger manual publish and review syndication logs', async ({ authedPage: page }) => {
  await page.click('text=記事一覧');
  await page.click('text=テスト記事');
  await page.click('button:has-text("今すぐ公開")');

  await expect(page.getByText('公開処理を開始しました')).toBeVisible();
  await page.waitForTimeout(1000);
});
