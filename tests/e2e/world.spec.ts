import { expect, test } from '@playwright/test';

test('the title wakes an empty clone on the world map by the crashed ship', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('./?seed=3');
  await expect(page.locator('[data-testid="to-grid"]')).toHaveText('깨어나기', { timeout: 60_000 });
  await page.click('[data-testid="to-grid"]');
  await expect(page.locator('.wh-mini canvas')).toBeVisible({ timeout: 60_000 });
  await expect(page.locator('.wh-party .pf')).toHaveCount(1);
  await expect(page.locator('.wh-party .pf')).toContainText('빈 몸');
  await expect(page.locator('.wh-area')).toContainText('0/');
  await expect(page.locator('.wh-log')).toContainText('복제 포드');
  // the Pip-Boy window opens on C and closes on Esc
  await page.keyboard.press('c');
  await expect(page.locator('.pip-win')).toBeVisible();
  await expect(page.locator('.pip-rec')).toContainText('맨주먹');
  await page.keyboard.press('Escape');
  await expect(page.locator('.pip-win')).toBeHidden();
  expect(errors).toEqual([]);
});
