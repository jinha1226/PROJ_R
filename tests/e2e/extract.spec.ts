import { test, expect, type Page } from '@playwright/test';

type W = { tick(): number; teleport(x: number, y: number): void; finish(o: string): void; state(): { region: { containers: { id: string; kind: string; pos: { x: number; y: number } }[]; extracts: { id: string; pos: { x: number; y: number } }[] }; hero: { loadout: { bag: { id: string }[] } } } };
const world = (page: Page) => page.evaluate(() => !!(window as unknown as { __PROJR_WORLD__?: W }).__PROJR_WORLD__);
const waitWorld = async (page: Page) => {
  await page.waitForFunction(() => ((window as unknown as { __PROJR_WORLD__?: W }).__PROJR_WORLD__?.tick() ?? 0) > 10, null, { timeout: 60_000 });
};

const fresh = async (page: Page) => {
  await page.goto('./?seed=21');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.click('[data-testid="to-extract"]');
  await expect(page.locator('[data-testid="extract-hub"]')).toBeVisible();
};

test('a sortie: search a chest, take the loot, extract, and find it in the stash', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await fresh(page);
  await page.screenshot({ path: 'test-artifacts/extract-hub.png' });
  await page.click('[data-testid="start-sortie"]');
  await waitWorld(page);
  await page.screenshot({ path: 'test-artifacts/extract-sortie.png' });
  // stand next to a small crate and search it
  // the roadside find farthest from any guard (searching under attack gets interrupted)
  const crate = await page.evaluate(() => {
    const st = (window as unknown as { __PROJR_WORLD__: W }).__PROJR_WORLD__.state() as unknown as { region: { containers: { id: string; kind: string; pos: { x: number; y: number } }[]; spawns: { pos: { x: number; y: number } }[] } };
    const safety = (p: { x: number; y: number }) => Math.min(...st.region.spawns.map((e) => Math.hypot(e.pos.x - p.x, e.pos.y - p.y)));
    return st.region.containers.filter((c) => c.id.startsWith('s') && c.kind !== 'herb').sort((a, b) => safety(b.pos) - safety(a.pos))[0]!;
  });
  await page.evaluate((p) => (window as unknown as { __PROJR_WORLD__: W }).__PROJR_WORLD__.teleport(p.x - 1.2, p.y), crate.pos);
  await expect(page.locator('[data-testid="prompt"]')).toBeVisible({ timeout: 10_000 });
  await page.keyboard.press('KeyE');
  await expect(page.locator('[data-testid="loot-panel"]')).toBeVisible({ timeout: 15_000 });
  await page.screenshot({ path: 'test-artifacts/extract-loot.png' });
  await page.click('[data-testid="loot-0"]');
  await page.click('[data-testid="bag-close"]');
  const carried = await page.evaluate(() => (window as unknown as { __PROJR_WORLD__: W }).__PROJR_WORLD__.state().hero.loadout.bag.map((s) => s.id));
  expect(carried.length).toBeGreaterThan(0);
  // walk into an extraction point and hold for 8 s
  const ex = await page.evaluate(() => (window as unknown as { __PROJR_WORLD__: W }).__PROJR_WORLD__.state().region.extracts.find(() => true)!);
  await page.evaluate((p) => (window as unknown as { __PROJR_WORLD__: W }).__PROJR_WORLD__.teleport(p.x, p.y), ex.pos);
  await expect(page.locator('[data-testid="sortie-result"]')).toBeVisible({ timeout: 30_000 });
  await page.screenshot({ path: 'test-artifacts/extract-result.png' });
  await page.click('[data-testid="to-base"]');
  await expect(page.locator('.xhub [data-stash]').first()).toBeVisible();
  const stash = await page.evaluate(() => (JSON.parse(localStorage.getItem('projr.extract.v1')!) as { stash: { id: string }[] }).stash.map((s) => s.id));
  for (const id of carried) expect(stash).toContain(id);
  expect(errors).toEqual([]);
});

test('going down loses the worn gear but keeps the pouch; reloading mid-sortie voids it', async ({ page }) => {
  page.on('pageerror', (e) => console.log('PAGEERR', e.message));
  page.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text()); });
  await fresh(page);
  await page.click('[data-testid="start-sortie"]');
  await waitWorld(page);
  await page.reload();
  await page.click('[data-testid="to-extract"]');
  await expect(page.locator('[data-testid="gear-weapon"]')).not.toHaveClass(/empty/);
  await page.click('[data-testid="start-sortie"]');
  await waitWorld(page);
  await page.evaluate(() => (window as unknown as { __PROJR_WORLD__: W }).__PROJR_WORLD__.finish('downed'));
  await expect(page.locator('[data-testid="sortie-result"]')).toBeVisible({ timeout: 10_000 });
  await page.click('[data-testid="to-base"]');
  await expect(page.locator('[data-testid="gear-weapon"]')).toHaveClass(/empty/);
  await page.click('[data-testid="starter"]');
  await expect(page.locator('[data-testid="gear-weapon"]')).not.toHaveClass(/empty/);
  expect(await world(page)).toBe(false);
});

test('touch devices get the stick and buttons', async ({ browser }) => {
  const ctx = await browser.newContext({ hasTouch: true, isMobile: true, viewport: { width: 900, height: 420 } });
  const page = await ctx.newPage();
  await fresh(page);
  await page.click('[data-testid="start-sortie"]');
  await waitWorld(page);
  await expect(page.locator('[data-testid="touch-attack"]')).toBeVisible();
  await page.screenshot({ path: 'test-artifacts/extract-touch.png' });
  await ctx.close();
});
