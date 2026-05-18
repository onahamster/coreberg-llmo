import { test, expect } from './fixtures';
import AxeBuilder from '@axe-core/playwright';

test('main dashboards pass WCAG AA accessibility criteria', async ({ authedPage: page }) => {
  await page.goto('/projects');
  
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa'])
    .analyze();

  expect(results.violations).toEqual([]);
});
