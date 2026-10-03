import { test, expect, type Page } from '@playwright/test';

type Cell = { x: number; y: number };
type S = { time: number; outcome?: string; hero: { pos: Cell; hp: number; loaded: boolean }; foes: { pos: Cell; alive: boolean; kind: string }[]; map: { tiles: string[]; w: number } };
type G = { state(): S; act(a: unknown): boolean; walkTo(c: Cell): void; walking(): boolean; toStairs(): void };
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
  await page.evaluate(() => {
    const w = (window as unknown as { __PROJR_GRID__: G }).__PROJR_GRID__;
    const h = w.state().hero.pos;
    const near = [...w.state().foes].sort((a, b) => Math.max(Math.abs(a.pos.x - h.x), Math.abs(a.pos.y - h.y)) - Math.max(Math.abs(b.pos.x - h.x), Math.abs(b.pos.y - h.y)))[0]!;
    w.walkTo(near.pos);
  });
  await page.waitForFunction(() => !(window as unknown as { __PROJR_GRID__: G }).__PROJR_GRID__.walking(), null, { timeout: 90_000 });
  await page.evaluate(() => {
    const w = (window as unknown as { __PROJR_GRID__: G }).__PROJR_GRID__;
    for (let i = 0; i < 4; i++) if (!w.act({ kind: 'shoot' })) w.act({ kind: w.state().hero.loaded ? 'wait' : 'reload' });
  });
  await page.screenshot({ path: 'test-artifacts/grid-fight.png' });
  // down the stairs: the banner shows and the HUD says floor 2
  await page.evaluate(() => {
    const w = (window as unknown as { __PROJR_GRID__: G }).__PROJR_GRID__;
    const s = w.state() as S & { map: { stairs: Cell } };
    s.hero.pos = { x: s.map.stairs.x - 1, y: s.map.stairs.y };
    for (const f of s.foes) f.alive = false;
    w.act({ kind: 'move', dir: { x: 1, y: 0 } });
  });
  await expect(page.locator('.grid-banner')).toHaveText('2층');
  await expect(page.locator('.gh-danger')).toContainText('2층 / 3');
  await page.screenshot({ path: 'test-artifacts/grid-floor2.png' });
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
  await page.evaluate(() => { const w = (window as unknown as { __PROJR_GRID__: G }).__PROJR_GRID__; Object.assign((w.state() as unknown as { hero: { gear: { belt: Record<string, number> } } }).hero.gear.belt, { bomb: 1, fireFlask: 1 }); w.act({ kind: 'wait' }); });
  for (const b of ['use-bomb', 'use-fireFlask']) {
    const box = (await page.locator(`[data-testid="grid-${b}"]`).boundingBox())!;
    expect(Math.min(box.width, box.height)).toBeGreaterThanOrEqual(48);
  }
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

test('engravings: inscribe a rune stone from the bag, pick one on level-up, and a dash fires', async ({ page }) => {
  type Any = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('./?seed=21');
  await page.click('[data-testid="to-grid"]');
  await page.click('[data-testid="class-warrior"]');
  await waitGrid(page);
  const engraves = () => page.evaluate(() => ((window as unknown as { __PROJR_GRID__: G }).__PROJR_GRID__.state() as unknown as Any).hero.gear.hands[0].engraves.map((e: Any) => e.id));
  expect(await engraves()).toEqual(['dash']);
  // a rune stone in the bag: open the bag, choose it, inscribe it on the sword
  await page.evaluate(() => { ((window as unknown as { __PROJR_GRID__: G }).__PROJR_GRID__.state() as unknown as Any).hero.gear.bag.push({ kind: 'rune', id: 'finisher', name: '룬석: 3연타 마무리' }); });
  await page.keyboard.press('i');
  await page.click('[data-testid="grid-bag-0"]');
  await page.click('[data-testid="grid-bag-inscribe"]');
  await expect.poll(engraves).toEqual(['dash', 'finisher']);
  await page.click('[data-testid="grid-bag-close"]');
  // a level-up choice: the modal shows, a pick is inscribed (the oldest engraving makes room)
  await page.evaluate(() => { ((window as unknown as { __PROJR_GRID__: G }).__PROJR_GRID__.state() as unknown as Any).offers = [['leap', 'echo', 'mark']]; });
  await expect(page.locator('[data-testid="grid-levelup"]')).toBeVisible();
  await page.click('[data-testid="grid-levelup-0"]');
  await expect(page.locator('[data-testid="grid-levelup"]')).toHaveCount(0);
  expect(await engraves()).toEqual(['finisher', 'leap']);
  // a foe two cells ahead in the open: walking at it is a dash (one cell in, a blow)
  const dashed = await page.evaluate(() => {
    const w = (window as unknown as { __PROJR_GRID__: G }).__PROJR_GRID__;
    const s = w.state() as unknown as Any;
    s.hero.gear.hands[0].engraves = [{ id: 'dash', lvl: 1 }];
    const h = s.hero.pos;
    for (const d of [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }]) {
      const at = (i: number) => s.map.tiles[(h.y + d.y * i) * s.map.w + h.x + d.x * i];
      if (at(1) !== 'floor' || at(2) !== 'floor') continue;
      for (const f of s.foes) if (f.alive) f.pos = { x: 0, y: 0 };
      const foe = { ...s.foes[0], id: 'zz', alive: true, awake: true, hp: 200, maxHp: 200, stun: 3, status: undefined, pos: { x: h.x + d.x * 2, y: h.y + d.y * 2 } };
      s.foes.push(foe);
      w.act({ kind: 'move', dir: d });
      return { moved: s.hero.pos.x === h.x + d.x && s.hero.pos.y === h.y + d.y, hurt: foe.hp < 200 };
    }
    return null;
  });
  expect(dashed).toEqual({ moved: true, hurt: true });
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'test-artifacts/grid-dash.png' });
  expect(errors).toEqual([]);
});

test('roguelike basics: drink an unknown potion from the bag, read a map scroll, search out a trap', async ({ page }) => {
  type Any = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('./?seed=21');
  await page.click('[data-testid="to-grid"]');
  await page.click('[data-testid="class-warrior"]');
  await waitGrid(page);
  const st = () => page.evaluate(() => (window as unknown as { __PROJR_GRID__: G }).__PROJR_GRID__.state() as unknown as Any);
  await page.evaluate(() => {
    const s = (window as unknown as { __PROJR_GRID__: G }).__PROJR_GRID__.state() as unknown as Any;
    s.hero.gear.potions = { haste: 1 };
    s.hero.gear.scrolls = { map: 1 };
    s.traps.push({ pos: { x: s.hero.pos.x + 1, y: s.hero.pos.y + 1 }, kind: 'net', found: false });
  });
  const colour = (await st()).lore.colors.haste as string;
  await page.keyboard.press('i');
  await expect(page.locator('[data-testid="grid-pack-potion-haste"]')).toContainText(`${colour} 물약`);
  await page.click('[data-testid="grid-drink-haste"]');
  await expect.poll(async () => (await st()).lore.known).toContain('potion:haste');
  await expect(page.locator('[data-testid="grid-pack-potion-haste"]')).toHaveCount(0);
  await page.click('[data-testid="grid-read-map"]');
  await expect.poll(async () => (await st()).lore.known).toContain('scroll:map');
  await page.click('[data-testid="grid-bag-close"]');
  // the map scroll already shows every trap; plant another hidden one and search for it
  await page.evaluate(() => {
    const s = (window as unknown as { __PROJR_GRID__: G }).__PROJR_GRID__.state() as unknown as Any;
    s.traps.push({ pos: { x: s.hero.pos.x - 1, y: s.hero.pos.y }, kind: 'spike', found: false });
  });
  await page.keyboard.press('v');
  await expect.poll(async () => (await st()).traps.every((t: Any) => t.found)).toBe(true);
  expect(errors).toEqual([]);
});
