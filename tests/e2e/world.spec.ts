import { expect, test } from '@playwright/test';

test('the title wakes an empty clone on the world map by the crashed ship', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('./?seed=3');
  await expect(page.locator('[data-testid="to-grid"]')).toHaveText('깨어나기', { timeout: 60_000 });
  await page.click('[data-testid="to-grid"]');
  await expect(page.locator('.wd-mini')).toBeVisible({ timeout: 60_000 });
  await expect(page.locator('.pd-card')).toHaveCount(1);
  await expect(page.locator('.pd-card')).toContainText('빈 몸');
  await expect(page.locator('.pd-wave')).toContainText('진지 0/');
  expect(errors).toEqual([]);
});
