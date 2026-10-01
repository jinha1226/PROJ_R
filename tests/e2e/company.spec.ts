import { test, expect, type Page } from '@playwright/test';

type Hook = { tick(): number; finish(): void };
const waitTick = (page: Page, n: number) =>
  page.waitForFunction((min) => ((window as unknown as { __PROJR__?: Hook }).__PROJR__?.tick() ?? 0) > min, n, { timeout: 60_000 });

async function battleOnce(page: Page): Promise<void> {
  await page.click('[data-testid="fight"]');
  await waitTick(page, 20);
  await page.evaluate(() => (window as unknown as { __PROJR__: Hook }).__PROJR__.finish());
  await page.click('[data-testid="continue"]', { timeout: 30_000 });
  await expect(page.locator('[data-testid="aftermath"]')).toBeVisible();
}

test('company mode: battle, aftermath, level up, character sheet, equipment', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('./?screen=sandbox&seed=5');
  await page.click('[data-testid="company-mode"]');
  await expect(page.locator('.merc-card')).toHaveCount(5);
  await page.selectOption('[data-testid="enemy-select"]', 'tutorial');
  await battleOnce(page);
  await page.screenshot({ path: 'test-artifacts/company-aftermath.png' });
  await page.click('[data-testid="to-hub"]');
  for (let i = 0; i < 3 && (await page.locator('[data-testid="levelup-next"]').count()) === 0; i++) {
    await battleOnce(page);
    await page.click('[data-testid="to-hub"]');
  }
  const lvl = page.locator('[data-testid="levelup-next"]');
  if (await lvl.count()) {
    await lvl.click();
    await page.screenshot({ path: 'test-artifacts/company-levelup.png' });
    await page.click('[data-testid="offer-0"]');
    if (await page.locator('[data-testid="slot-0"]').count()) await page.click('[data-testid="slot-0"]');
    await expect(page.locator('[data-testid="levelup"]')).toHaveCount(0);
  }
  await page.click('[data-testid="card-m1"]');
  await expect(page.locator('[data-testid="sheet"]')).toBeVisible();
  for (const tab of ['skills', 'gear', 'relations', 'chronicle', 'stats']) await page.click(`[data-testid="tab-${tab}"]`);
  await page.click('[data-testid="tab-chronicle"]');
  await expect(page.locator('.chronicle li').first()).toBeVisible();
  await page.screenshot({ path: 'test-artifacts/company-sheet.png' });
  expect(errors).toEqual([]);
});
