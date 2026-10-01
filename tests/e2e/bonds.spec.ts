import { test, expect, type Page } from '@playwright/test';

type Hook = { tick(): number };
const waitTick = (page: Page, n: number) =>
  page.waitForFunction((min) => ((window as unknown as { __PROJR__?: Hook }).__PROJR__?.tick() ?? 0) > min, n, { timeout: 60_000 });

test('bonds party shows relationship drama and the moments summary', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('./?seed=2');
  await page.selectOption('[data-testid="ally-preset"]', 'bonds');
  await page.selectOption('[data-testid="enemy-preset"]', 'ambush');
  await page.click('[data-testid="start-battle"]');
  await waitTick(page, 95);
  await page.screenshot({ path: 'test-artifacts/bonds-drama.png' });
  await page.click('[data-testid="pause"]');
  await page.click('[data-testid="unit-chip-a0"]');
  await expect(page.locator('[data-testid="inspect"]')).toContainText('전우');
  await expect(page.locator('[data-testid="inspect"]')).toContainText('보호본능');
  await page.screenshot({ path: 'test-artifacts/bonds-inspect.png' });
  await page.click('[data-testid="pause"]');
  await page.click('[data-testid="speed-4"]');
  await expect(page.locator('[data-testid="result"]')).toBeVisible({ timeout: 90_000 });
  await expect(page.locator('[data-testid="moments"] li').first()).toBeVisible();
  await page.screenshot({ path: 'test-artifacts/bonds-result.png' });
  expect(errors).toEqual([]);
});
