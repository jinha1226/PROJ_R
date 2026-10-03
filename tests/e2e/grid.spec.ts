import { test, expect, type Page } from '@playwright/test';

type Cell = { x: number; y: number };
type S = { time: number; outcome?: string; hero: { pos: Cell; hp: number; loaded: boolean }; foes: { pos: Cell; alive: boolean; kind: string }[]; map: { tiles: string[]; w: number } };
type G = { state(): S; act(a: unknown): boolean; walkTo(c: Cell): void; walking(): boolean };
const waitGrid = (page: Page) => page.waitForFunction(() => !!(window as unknown as { __PROJR_GRID__?: G }).__PROJR_GRID__, null, { timeout: 60_000 });

test('a grid sortie: step, fight, fall, see the result and go again', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('./?seed=21');
  await page.click('[data-testid="to-grid"]');
  await page.click('[data-testid="class-warrior"]');
  await waitGrid(page);
  await expect(page.locator('[data-testid="grid-stats"]')).toContainText('화살');
  const moved = await page.evaluate(() => {
    const w = (window as unknown as { __PROJR_GRID__: G }).__PROJR_GRID__;
    for (const dir of [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }, { x: 1, y: 1 }]) if (w.act({ kind: 'move', dir })) return w.state().time;
    return 0;
  });
  expect(moved).toBeGreaterThan(0);
  // walk toward a foe the way a tap does, then trade blows
  await page.evaluate(() => { const w = (window as unknown as { __PROJR_GRID__: G }).__PROJR_GRID__; w.walkTo(w.state().foes[0]!.pos); });
  await page.waitForFunction(() => !(window as unknown as { __PROJR_GRID__: G }).__PROJR_GRID__.walking(), null, { timeout: 30_000 });
  await page.evaluate(() => {
    const w = (window as unknown as { __PROJR_GRID__: G }).__PROJR_GRID__;
    for (let i = 0; i < 4; i++) if (!w.act({ kind: 'shoot' })) w.act({ kind: w.state().hero.loaded ? 'wait' : 'reload' });
  });
  await page.screenshot({ path: 'test-artifacts/grid-fight.png' });
  // fall: the haul is lost and the result screen comes up once
  await page.evaluate(() => { const w = (window as unknown as { __PROJR_GRID__: G }).__PROJR_GRID__; const h = w.state().hero as { hp: number; alive?: boolean }; h.hp = 0; h.alive = false; w.act({ kind: 'wait' }); });
  await expect(page.locator('[data-testid="grid-result"]')).toBeVisible({ timeout: 10_000 });
  await expect(page.locator('[data-testid="grid-result"] h2')).toHaveText('쓰러졌다');
  await page.click('[data-testid="grid-again"]');
  await page.click('[data-testid="class-hunter"]');
  await waitGrid(page);
  await expect(page.locator('[data-testid="grid-sortie"]')).toBeVisible();
  expect(errors).toEqual([]);
});

test('on a phone the grid sortie has a stick and big buttons', async ({ browser }) => {
  const ctx = await browser.newContext({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await page.goto('./?seed=21');
  await page.click('[data-testid="to-grid"]');
  await page.click('[data-testid="class-warrior"]');
  await waitGrid(page);
  await expect(page.locator('.screen.grid.portrait')).toBeVisible();
  for (const b of ['shoot', 'wait', 'potion', 'prev', 'next']) {
    const box = (await page.locator(`[data-testid="grid-${b}"]`).boundingBox())!;
    expect(Math.min(box.width, box.height)).toBeGreaterThanOrEqual(56);
  }
  const before = await page.evaluate(() => (window as unknown as { __PROJR_GRID__: G }).__PROJR_GRID__.state().time);
  await page.locator('[data-testid="grid-wait"]').dispatchEvent('pointerdown', { pointerId: 3, bubbles: true });
  await expect.poll(() => page.evaluate(() => (window as unknown as { __PROJR_GRID__: G }).__PROJR_GRID__.state().time)).toBeGreaterThan(before);
  await page.screenshot({ path: 'test-artifacts/grid-portrait.png' });
  await ctx.close();
});
