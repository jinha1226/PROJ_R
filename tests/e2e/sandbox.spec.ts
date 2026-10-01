import { test, expect, type Page } from '@playwright/test';

type Hook = { tick(): number; outcome(): string | null };
const tick = (page: Page) => page.evaluate(() => (window as unknown as { __PROJR__: Hook }).__PROJR__.tick());
const waitTick = (page: Page, n: number) =>
  page.waitForFunction((min) => ((window as unknown as { __PROJR__?: Hook }).__PROJR__?.tick() ?? 0) > min, n, { timeout: 60_000 });

test('sandbox battle runs to completion and renders', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('./?screen=sandbox&seed=7');
  await page.selectOption('[data-testid="ally-preset"]', 'standard');
  await page.selectOption('[data-testid="enemy-preset"]', 'bandits');
  await page.click('[data-testid="start-battle"]');
  await waitTick(page, 40);
  await page.screenshot({ path: 'test-artifacts/battle-start.png' });
  await page.click('[data-testid="speed-4"]');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'test-artifacts/battle-mid.png' });
  await expect(page.locator('[data-testid="result"]')).toBeVisible({ timeout: 90_000 });
  await page.screenshot({ path: 'test-artifacts/battle-end.png' });
  expect(errors).toEqual([]);
});

test('pause stops the simulation and inspect shows intent', async ({ page }) => {
  await page.goto('./?screen=sandbox&seed=3');
  await page.click('[data-testid="start-battle"]');
  await waitTick(page, 30);
  await page.click('[data-testid="pause"]');
  const t1 = await tick(page);
  await page.waitForTimeout(800);
  expect(await tick(page)).toBe(t1);
  await page.click('[data-testid="unit-chip-a0"]');
  await expect(page.locator('[data-testid="inspect"]')).toContainText('이름 없는 모험가');
  await page.screenshot({ path: 'test-artifacts/battle-inspect.png' });
});

test('boss preset renders telegraphs without errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('./?screen=sandbox&seed=5');
  await page.selectOption('[data-testid="ally-preset"]', 'standard');
  await page.selectOption('[data-testid="enemy-preset"]', 'boss');
  await page.click('[data-testid="start-battle"]');
  await waitTick(page, 200);
  await page.screenshot({ path: 'test-artifacts/battle-boss.png' });
  expect(errors).toEqual([]);
});

test('wheel zoom switches to manual camera and C returns to auto', async ({ page }) => {
  await page.goto('./?screen=sandbox&seed=4');
  await page.click('[data-testid="start-battle"]');
  await waitTick(page, 20);
  const auto = page.locator('[data-testid="camera-auto"]');
  await expect(auto).not.toHaveClass(/active/);
  await page.mouse.move(640, 360);
  await page.mouse.wheel(0, -600);
  await expect(auto).toHaveClass(/active/);
  await page.keyboard.press('c');
  await expect(auto).not.toHaveClass(/active/);
});
