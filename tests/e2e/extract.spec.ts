import { test, expect, type Page } from '@playwright/test';

type W = { tick(): number; teleport(x: number, y: number): void; finish(o: string): void; advance(n: number): void; state(): unknown; zoom(): number };
type St = { region: { containers: { id: string; kind: string; pos: { x: number; y: number } }[]; extracts: { id: string; pos: { x: number; y: number } }[]; spawns: { pos: { x: number; y: number } }[] }; hero: { loadout: { bag: { id: string }[] } }; b: { tick: number }; party: { order: string[] } };
const waitWorld = (page: Page) => page.waitForFunction(() => ((window as unknown as { __PROJR_WORLD__?: W }).__PROJR_WORLD__?.tick() ?? 0) > 10, null, { timeout: 60_000 });
const saved = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem('projr.extract.v2')!) as { mercs: { id: string }[]; party: string[]; stash: { id: string }[]; tavern: { fee: number }[]; gold: number });

const fresh = async (page: Page) => {
  await page.goto('./?seed=21');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.click('[data-testid="to-extract"]');
  await expect(page.locator('[data-testid="extract-hub"]')).toBeVisible();
};

test('a party sortie: three mercenaries search a chest into the pack, extract, and bank it', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await fresh(page);
  await expect(page.locator('.xmerc')).toHaveCount(3);
  await page.screenshot({ path: 'test-artifacts/extract-hub.png' });
  await page.click('[data-testid="start-sortie"]');
  await waitWorld(page);
  await expect(page.locator('.xp-row')).toHaveCount(3);
  await page.screenshot({ path: 'test-artifacts/extract-sortie.png' });
  const crate = await page.evaluate(() => {
    const st = (window as unknown as { __PROJR_WORLD__: W }).__PROJR_WORLD__.state() as St;
    const safety = (p: { x: number; y: number }) => Math.min(...st.region.spawns.map((e) => Math.hypot(e.pos.x - p.x, e.pos.y - p.y)));
    return st.region.containers.filter((c) => c.id.startsWith('s') && c.kind !== 'herb').sort((a, b) => safety(b.pos) - safety(a.pos))[0]!;
  });
  await page.evaluate((p) => (window as unknown as { __PROJR_WORLD__: W }).__PROJR_WORLD__.teleport(p.x - 1.2, p.y), crate.pos);
  await expect(page.locator('[data-testid="prompt"]')).toBeVisible({ timeout: 10_000 });
  await page.keyboard.press('KeyE');
  // the search ends with the finds going straight into the pack (no window unless something does not fit)
  await expect.poll(() => page.evaluate(() => ((window as unknown as { __PROJR_WORLD__: W }).__PROJR_WORLD__.state() as St).hero.loadout.bag.length), { timeout: 15_000 }).toBeGreaterThan(0);
  await page.screenshot({ path: 'test-artifacts/extract-loot.png' });
  const carried = await page.evaluate(() => ((window as unknown as { __PROJR_WORLD__: W }).__PROJR_WORLD__.state() as St).hero.loadout.bag.map((s) => s.id));
  await page.evaluate(() => { const w = (window as unknown as { __PROJR_WORLD__: W }).__PROJR_WORLD__; const ex = (w.state() as St).region.extracts[0]!; w.teleport(ex.pos.x, ex.pos.y); w.advance(20 * 9); });
  await expect(page.locator('[data-testid="sortie-result"]')).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('.xresult-members .st-home')).toHaveCount(3);
  await page.screenshot({ path: 'test-artifacts/extract-result.png' });
  await page.click('[data-testid="to-base"]');
  const c = await saved(page);
  for (const id of carried) expect(c.stash.map((s) => s.id)).toContain(id);
  expect(errors).toEqual([]);
});

test('a wiped party is lost for good; the company fights on until nobody is left', async ({ page }) => {
  await fresh(page);
  await page.click('[data-testid="tab-tavern"]');
  await page.click('[data-testid="hire-0"]');
  await expect(page.locator('.xmerc')).toHaveCount(4);
  await page.click('[data-testid="start-sortie"]');
  await waitWorld(page);
  await page.evaluate(() => (window as unknown as { __PROJR_WORLD__: W }).__PROJR_WORLD__.finish('failed'));
  await expect(page.locator('[data-testid="sortie-result"]')).toBeVisible({ timeout: 10_000 });
  await page.click('[data-testid="to-base"]');
  await expect(page.locator('.xmerc')).toHaveCount(1);
  await expect(page.locator('[data-testid="start-sortie"]')).toBeDisabled();
  await page.locator('.xmerc').first().click();
  await page.click('[data-testid="toggle-party"]');
  await page.click('[data-testid="start-sortie"]');
  await waitWorld(page);
  await page.evaluate(() => (window as unknown as { __PROJR_WORLD__: W }).__PROJR_WORLD__.finish('failed'));
  // once the sortie is over, the pause menu (and its abandon) no longer opens
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-testid="pause-panel"]')).toHaveCount(0);
  await expect(page.locator('[data-testid="sortie-result"]')).toBeVisible({ timeout: 10_000 });
  // reloading on the result screen still ends in game over
  await page.reload();
  await page.click('[data-testid="to-extract"]');
  await expect(page.locator('[data-testid="game-over"]')).toBeVisible();
  await page.click('[data-testid="new-company"]');
  await expect(page.locator('.xmerc')).toHaveCount(3);
});

test('reloading mid-sortie returns to the base as it was', async ({ page }) => {
  await fresh(page);
  await page.click('[data-testid="start-sortie"]');
  await waitWorld(page);
  await page.reload();
  await page.click('[data-testid="to-extract"]');
  await expect(page.locator('.xmerc')).toHaveCount(3);
  expect(await page.evaluate(() => !!(window as unknown as { __PROJR_WORLD__?: W }).__PROJR_WORLD__)).toBe(false);
});

test('touch devices get the stick and the order buttons', async ({ browser }) => {
  const ctx = await browser.newContext({ hasTouch: true, isMobile: true, viewport: { width: 900, height: 420 } });
  const page = await ctx.newPage();
  await fresh(page);
  await page.click('[data-testid="start-sortie"]');
  await waitWorld(page);
  await expect(page.locator('[data-testid="touch-focus"]')).toBeVisible();
  await page.screenshot({ path: 'test-artifacts/extract-touch.png' });
  await page.locator('[data-testid="touch-menu"]').dispatchEvent('pointerdown', { pointerId: 7, bubbles: true });
  await expect(page.locator('[data-testid="pause-panel"]')).toBeVisible({ timeout: 5_000 });
  await ctx.close();
});

test('a phone held upright gets the portrait layout; turning it keeps the same sortie', async ({ browser }) => {
  const ctx = await browser.newContext({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await fresh(page);
  await page.click('[data-testid="start-sortie"]');
  await waitWorld(page);
  await expect(page.locator('.sortie.portrait')).toBeVisible();
  await expect(page.locator('.sortie-portrait')).toHaveCount(0);
  for (const b of ['focus', 'retreat', 'regroup', 'menu']) {
    const box = (await page.locator(`[data-testid="touch-${b}"]`).boundingBox())!;
    expect(Math.min(box.width, box.height)).toBeGreaterThanOrEqual(56);
  }
  await page.screenshot({ path: 'test-artifacts/extract-portrait.png' });
  const before = await page.evaluate(() => { const s = (window as unknown as { __PROJR_WORLD__: W }).__PROJR_WORLD__.state() as St & { mark?: number }; s.mark = 7; return s.b.tick; });
  await page.setViewportSize({ width: 844, height: 390 });
  await expect(page.locator('.sortie.landscape')).toBeVisible();
  await page.evaluate(() => (window as unknown as { __PROJR_WORLD__: W }).__PROJR_WORLD__.advance(5));
  const after = await page.evaluate(() => { const s = (window as unknown as { __PROJR_WORLD__: W }).__PROJR_WORLD__.state() as St & { mark?: number }; return { tick: s.b.tick, mark: s.mark, party: s.party.order.length }; });
  expect(after.mark).toBe(7);
  expect(after.tick).toBeGreaterThan(before);
  expect(after.party).toBe(3);
  await page.screenshot({ path: 'test-artifacts/extract-landscape.png' });
  await ctx.close();
});

test('the + button brings the camera closer', async ({ page }) => {
  await fresh(page);
  await page.click('[data-testid="start-sortie"]');
  await waitWorld(page);
  const zoom = () => page.evaluate(() => (window as unknown as { __PROJR_WORLD__: W }).__PROJR_WORLD__.zoom());
  const before = await zoom();
  await page.click('[data-testid="zoom-in"]');
  await expect.poll(zoom).toBeLessThan(before);
});

test('on a phone the bag sheet covers at most half the screen, and a pinch zooms without grabbing the stick', async ({ browser }) => {
  const ctx = await browser.newContext({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await fresh(page);
  await page.click('[data-testid="start-sortie"]');
  await waitWorld(page);
  const zoom = () => page.evaluate(() => (window as unknown as { __PROJR_WORLD__: W }).__PROJR_WORLD__.zoom());
  const before = await zoom();
  await page.evaluate(() => {
    const ev = (type: string, id: number, x: number, y: number) => new PointerEvent(type, { pointerId: id, pointerType: 'touch', clientX: x, clientY: y, bubbles: true, isPrimary: id === 1 });
    const pad = document.querySelector('.tc-pad')!;
    const stage = document.querySelector('.sortie-stage canvas')!;
    pad.dispatchEvent(ev('pointerdown', 1, 150, 600));
    stage.dispatchEvent(ev('pointerdown', 2, 260, 500));
    stage.dispatchEvent(ev('pointermove', 2, 330, 420));
    pad.dispatchEvent(ev('pointermove', 1, 100, 660));
  });
  await expect.poll(zoom).toBeLessThan(before);
  await expect(page.locator('.tc-stick')).toBeHidden();
  await page.evaluate(() => {
    for (const id of [1, 2]) window.dispatchEvent(new PointerEvent('pointerup', { pointerId: id, pointerType: 'touch', bubbles: true }));
  });
  await page.locator('[data-testid="touch-menu"]').dispatchEvent('pointerdown', { pointerId: 9, bubbles: true });
  const panel = page.locator('[data-testid="pause-panel"]');
  await expect(panel).toBeVisible({ timeout: 5_000 });
  expect((await panel.boundingBox())!.height).toBeLessThanOrEqual(844 / 2 + 1);
  await ctx.close();
});
