import { expect, test } from '@playwright/test';

test('the title drops a pod: an empty clone steps out beside it, the drill rig waits', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('./?seed=3');
  await expect(page.locator('[data-testid="to-grid"]')).toHaveText('깨어나기', { timeout: 60_000 });
  await page.click('[data-testid="to-grid"]');
  await expect(page.locator('.wh-mini canvas')).toBeVisible({ timeout: 60_000 });
  await expect(page.locator('.wh-party .pf')).toHaveCount(1);
  await expect(page.locator('.wh-party .pf')).toContainText('빈 몸');
  await expect(page.locator('.wh-top')).toContainText('턴');
  await expect(page.locator('.wh-log')).toContainText('포드 착륙');
  // the Pip-Boy window opens on C and closes on Esc
  await page.keyboard.press('c');
  await expect(page.locator('.pip-main')).toBeVisible();
  await expect(page.locator('.pip-rec')).toContainText('맨주먹');
  await page.keyboard.press('Escape');
  await expect(page.locator('.pip-main')).toBeHidden();
  expect(errors).toEqual([]);
});
