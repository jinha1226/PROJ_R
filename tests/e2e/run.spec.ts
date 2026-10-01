import { test, expect, type Page } from '@playwright/test';

type Hook = { tick(): number; finish(): void };
const finishBattle = async (page: Page) => {
  await page.waitForFunction(() => ((window as unknown as { __PROJR__?: Hook }).__PROJR__?.tick() ?? 0) > 5, null, { timeout: 60_000 });
  await page.evaluate(() => (window as unknown as { __PROJR__: Hook }).__PROJR__.finish());
  await page.click('[data-testid="continue"]', { timeout: 30_000 });
};

test('a run: step 1 battle, step 2 recruit and naming, save and continue', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('./');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.fill('[data-testid="run-seed"]', '42');
  await page.click('[data-testid="new-run"]');
  await page.screenshot({ path: 'test-artifacts/run-map.png' });
  await page.click('[data-testid="node-n1_1"]');
  await expect(page.locator('[data-testid="start-node-battle"]')).toBeEnabled();
  await page.screenshot({ path: 'test-artifacts/run-prep.png' });
  await page.click('[data-testid="start-node-battle"]');
  await finishBattle(page);
  await page.click('[data-testid="to-hub"]');
  for (let i = 0; i < 3 && (await page.locator('[data-testid="levelup"]').count()); i++) await page.click('[data-testid="offer-0"]');
  const gold = await page.locator('[data-testid="gold"]').textContent();
  await page.locator('.map-node.open').first().click();
  await page.click('[data-testid="recruit-0"], [data-testid="recruit-1"]');
  await page.fill('[data-testid="name-input"]', '하늘');
  await page.click('[data-testid="name-ok"]');
  await expect(page.locator('.map-node.open').first()).toBeVisible();
  await page.click('[data-testid="open-roster"]');
  await expect(page.locator('.merc-card')).toHaveCount(2);
  await expect(page.locator('.merc-card').first()).toContainText('하늘');
  await page.screenshot({ path: 'test-artifacts/run-roster.png' });
  await page.click('[data-testid="back-to-map"]');
  await page.reload();
  await page.click('[data-testid="continue-run"]');
  await expect(page.locator('.map-node.here')).toHaveCount(1);
  await page.click('[data-testid="open-roster"]');
  await expect(page.locator('.merc-card')).toHaveCount(2);
  expect(gold).toBeTruthy();
  expect(errors).toEqual([]);
});
