import { expect, test } from '@playwright/test';

test('the title drops a pod: an empty clone steps out beside it, the lab unfolds, the base view opens', async ({ page }) => {
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
  // base mode: no clone under the hand, the base menu along the bottom
  await expect(page.locator('.base-menu')).toBeVisible({ timeout: 60_000 });
  await expect(page.locator('.world.base-mode')).toHaveCount(1);
  // the Pip-Boy window opens on C and closes on Esc
  await page.keyboard.press('c');
  await expect(page.locator('.pip-main')).toBeVisible();
  await expect(page.locator('.pip-rec')).toContainText('권총');
  await page.keyboard.press('Escape');
  await expect(page.locator('.pip-main')).toBeHidden();
  expect(errors).toEqual([]);
});

test('a raid night: the raid starts in running time with its ultimate bar, and its end shows the result', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('./?seed=3&raid&lvl&debug');
  await page.click('[data-testid="to-grid"]', { timeout: 60_000 });
  await expect(page.locator('.base-menu')).toBeVisible({ timeout: 60_000 });
  await page.click('[data-r="start"]');
  await expect(page.locator('.ult-bar')).toBeVisible();
  await expect(page.locator('.world.raid-mode')).toHaveCount(1);
  // end it at once: the horde still to come and the raiders out there fall
  await page.evaluate(() => {
    const w = (window as unknown as { __world: { p: { raid: { group: number } | null; raidQueue: unknown[]; units: { id: string; group?: number }[]; s: { foes: { id: string; alive: boolean }[] } } } }).__world;
    const p = w.p; p.raidQueue = [];
    for (const u of p.units) if (u.group === p.raid?.group) { const e = p.s.foes.find((f) => f.id === u.id); if (e) e.alive = false; }
  });
  await expect(page.locator('.pip-title', { hasText: '습격 격퇴' })).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('.world.base-mode')).toHaveCount(1);
  expect(errors).toEqual([]);
});
