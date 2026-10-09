import { expect, test } from '@playwright/test';

test('the title drops a pod: an empty clone steps out beside it, the base unfolds round it, the base view opens', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('./?seed=3');
  await expect(page.locator('[data-testid="to-grid"]')).toHaveText('깨어나기', { timeout: 60_000 });
  await page.click('[data-testid="to-grid"]');
  await expect(page.locator('.wh-mini canvas')).toBeVisible({ timeout: 60_000 });
  await expect(page.locator('.wh-party .pf')).toHaveCount(1);
  await expect(page.locator('.wh-party .pf')).toContainText('MODEL 0');
  await expect(page.locator('.wh-top')).toContainText('턴');
  await expect(page.locator('.wh-log')).toContainText('포드가 착륙했다');
  // base mode: no clone under the hand, the base's bar along the bottom
  await expect(page.locator('.ult-bar')).toBeVisible({ timeout: 60_000 });
  await expect(page.locator('.world.base-mode')).toHaveCount(1);
  // the Pip-Boy window opens on C and closes on Esc
  await page.keyboard.press('c');
  await expect(page.locator('.pip-main')).toBeVisible();
  await expect(page.locator('.pip-rec')).toContainText('권총');
  await page.keyboard.press('Escape');
  await expect(page.locator('.pip-main')).toBeHidden();
  expect(errors).toEqual([]);
});

test('the besieged base: the waves come and are counted, and a broken dome throws them back and relights', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('./?seed=3&lvl&debug&wave=3');
  await page.click('[data-testid="to-grid"]', { timeout: 60_000 });
  await expect(page.locator('.ult-bar')).toBeVisible({ timeout: 60_000 });
  // the mode changes on a frame, and a software renderer's frame can take seconds
  await expect(page.locator('.world.base-mode')).toHaveCount(1, { timeout: 30_000 });
  await expect(page.locator('.siege-bar')).toContainText('돔', { timeout: 30_000 });
  type World = { skip(n: number): void; p: { siege: { wave: number; domeHp: number; downUntil: number }; units: { group?: number }[] } };
  // time runs on: the third wave steps out
  await page.evaluate(() => (window as unknown as { __world: World }).__world.skip(20));
  expect(await page.evaluate(() => (window as unknown as { __world: World }).__world.p.siege.wave)).toBeGreaterThanOrEqual(3);
  await expect(page.locator('.siege-bar')).toContainText(/파도\s*[3-9]/, { timeout: 30_000 });
  // the dome brought to nothing: the horde is gone and the dome is down for a while
  const after = await page.evaluate(() => {
    const w = (window as unknown as { __world: World }).__world;
    w.p.siege.domeHp = 0; w.skip(1);
    return { down: w.p.siege.downUntil > 0, raiders: w.p.units.filter((u) => u.group === 1000).length };
  });
  expect(after).toEqual({ down: true, raiders: 0 });
  await expect(page.locator('.siege-bar')).toContainText('돔 재가동', { timeout: 30_000 });
  expect(errors).toEqual([]);
});
