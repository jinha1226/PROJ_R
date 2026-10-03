import { test, expect, type Page } from '@playwright/test';

type Cell = { x: number; y: number };
type S = { time: number; outcome?: string; hero: { pos: Cell; hp: number; charge: number }; foes: { pos: Cell; alive: boolean; kind: string }[]; map: { tiles: string[]; w: number } };
type G = { state(): S; act(a: unknown): boolean; walkTo(c: Cell): void; walking(): boolean; toStairs(): void };
const waitGrid = (page: Page) => page.waitForFunction(() => !!(window as unknown as { __PROJR_GRID__?: G }).__PROJR_GRID__, null, { timeout: 60_000 });
/** From the ship deck: walk into the hatch, launch, and wait for the dungeon run. */
async function launch(page: Page): Promise<void> {
  await expect(page.locator('[data-testid="ship-deck"]')).toBeVisible({ timeout: 60_000 });
  await waitGrid(page);
  await page.evaluate(() => {
    const w = (window as unknown as { __PROJR_GRID__: G }).__PROJR_GRID__;
    const s = w.state() as unknown as { hero: { pos: Cell }; map: { stations: { id: string; pos: Cell }[] } };
    const hatch = s.map.stations.find((st) => st.id === 'hatch')!;
    s.hero.pos = { x: hatch.pos.x, y: hatch.pos.y - 1 };
    w.act({ kind: 'move', dir: { x: 0, y: 1 } });
  });
  await page.click('[data-testid="ship-launch"]');
  await page.waitForFunction(() => (window as unknown as { __PROJR_GRID__?: { state(): { mode?: string } } }).__PROJR_GRID__?.state().mode !== 'ship', null, { timeout: 60_000 });
}

test('a grid sortie: step, fight, fall, see the result and go again', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('./?seed=21');
  await page.click('[data-testid="to-grid"]');
  await launch(page);
  await expect(page.locator('[data-testid="grid-stats"]')).toContainText('충전');
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
    for (let i = 0; i < 4; i++) if (!w.act({ kind: 'shoot' })) w.act({ kind: 'wait' });
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
  await expect(page.locator('.grid-banner')).toHaveText('2층 · 동굴');
  await expect(page.locator('.gh-danger')).toContainText('2층 / 15');
  await page.screenshot({ path: 'test-artifacts/grid-floor2.png' });
  // fall: the haul is lost and the result screen comes up once
  await page.evaluate(() => { const w = (window as unknown as { __PROJR_GRID__: G }).__PROJR_GRID__; const h = w.state().hero as { hp: number; alive?: boolean }; h.hp = 0; h.alive = false; w.act({ kind: 'wait' }); });
  await expect(page.locator('[data-testid="grid-result"]')).toBeVisible({ timeout: 10_000 });
  await expect(page.locator('[data-testid="grid-result"] h2')).toHaveText('쓰러졌다');
  // back to the ship: the pod wakes the agent, the hatch launches again
  await page.click('[data-testid="grid-again"]');
  await launch(page);
  await expect(page.locator('[data-testid="grid-sortie"]')).toBeVisible();
  expect(errors).toEqual([]);
});

test('on a phone the grid sortie has a stick and big buttons', async ({ browser }) => {
  const ctx = await browser.newContext({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await page.goto('./?seed=21');
  await page.click('[data-testid="to-grid"]');
  await launch(page);
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

test('engravings: absorb an echo onto the suit, pick a suit upgrade on level-up, a dash fires, a full suit asks which slot', async ({ page }) => {
  type Any = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('./?seed=21');
  await page.click('[data-testid="to-grid"]');
  await launch(page);
  const st = () => page.evaluate(() => (window as unknown as { __PROJR_GRID__: G }).__PROJR_GRID__.state() as unknown as Any);
  expect((await st()).hero.suit).toEqual([]);
  // an echo at the hero's feet-to-be: stepping in offers three engravings of that family; pick one onto the suit
  await page.evaluate(() => {
    const w = (window as unknown as { __PROJR_GRID__: G }).__PROJR_GRID__;
    const s = w.state() as unknown as Any;
    s.hero.hp = s.hero.maxHp = 999;
    for (const f of s.foes) if (f.alive) f.pos = { x: 0, y: 0 };
    const h = s.hero.pos;
    for (const d of [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }]) {
      if (s.map.tiles[(h.y + d.y) * s.map.w + h.x + d.x] !== 'floor') continue;
      s.floorItems.push({ pos: { x: h.x + d.x, y: h.y + d.y }, item: { kind: 'echo', family: 'melee', name: '잔향' } });
      w.act({ kind: 'move', dir: d });
      return;
    }
  });
  await expect(page.locator('[data-testid="grid-levelup"]')).toBeVisible();
  await page.click('[data-testid="grid-levelup-0"]');
  await expect(page.locator('[data-testid="grid-levelup"]')).toHaveCount(0);
  expect((await st()).hero.suit).toHaveLength(1);
  await expect(page.locator('[data-testid="grid-suit-strip"]')).toBeVisible();
  // a level gained: the suit upgrade panel
  await page.evaluate(() => { const s = (window as unknown as { __PROJR_GRID__: G }).__PROJR_GRID__.state() as unknown as Any; s.upgrades = [['charge', 'hp', 'gunDmg']]; });
  await expect(page.locator('[data-testid="grid-upgrade-0"]')).toBeVisible();
  await page.click('[data-testid="grid-upgrade-0"]');
  await expect.poll(async () => (await st()).hero.maxCharge).toBe(12);
  // a full suit: picking a new engraving asks which slot to replace
  await page.evaluate(() => {
    const s = (window as unknown as { __PROJR_GRID__: G }).__PROJR_GRID__.state() as unknown as Any;
    s.hero.suit = ['rapid', 'momentum', 'chain', 'mark', 'kite', 'volley'];
    s.offers = [['dash', 'leap', 'finisher']];
  });
  await page.click('[data-testid="grid-levelup-0"]');
  await page.click('[data-testid="grid-suit-slot-2"]');
  await expect.poll(async () => (await st()).hero.suit[2]).toBe('dash');
  // dash on the suit with a sword in hand: a foe two cells ahead is lunged at
  const dashed = await page.evaluate(() => {
    const w = (window as unknown as { __PROJR_GRID__: G }).__PROJR_GRID__;
    const s = w.state() as unknown as Any;
    s.hero.gear.hands[0] = { kind: 'weapon', group: 'sword', tier: 1, name: '장검' };
    s.hero.gear.active = 0;
    const h = s.hero.pos;
    for (const d of [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }]) {
      const at = (i: number) => s.map.tiles[(h.y + d.y * i) * s.map.w + h.x + d.x * i];
      if (at(1) !== 'floor' || at(2) !== 'floor') continue;
      const foe = { ...s.foes[0], id: 'zz', alive: true, awake: true, hp: 200, maxHp: 200, stun: 3, status: undefined, elite: false, pos: { x: h.x + d.x * 2, y: h.y + d.y * 2 } };
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
  await launch(page);
  const st = () => page.evaluate(() => (window as unknown as { __PROJR_GRID__: G }).__PROJR_GRID__.state() as unknown as Any);
  await page.evaluate(() => {
    const s = (window as unknown as { __PROJR_GRID__: G }).__PROJR_GRID__.state() as unknown as Any;
    // a sturdy hero: nearby foes must not end the run while the bag is being used
    s.hero.hp = s.hero.maxHp = 999;
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

test('the ship deck: bump the armory, buy the shotgun with energy, it is saved and can be picked to launch with', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.addInitScript(() => {
    try { if (!localStorage.getItem('projr.grid.meta.v1.seeded')) { localStorage.setItem('projr.grid.meta.v1', JSON.stringify({ energy: 200, facilities: { armoryShotgun: false, armoryRifle: false, suitSlots: 1, chargePlus: 0, navCrypt: false, navRuins: false }, records: ['dash', 'rapid', 'chain', 'momentum'], startCandidates: [], bossesKilled: [], best: 0, wins: 0 })); localStorage.setItem('projr.grid.meta.v1.seeded', '1'); } } catch { /* ignore */ }
  });
  await page.goto('./?seed=21');
  await page.click('[data-testid="to-grid"]');
  await expect(page.locator('[data-testid="ship-deck"]')).toBeVisible({ timeout: 60_000 });
  await waitGrid(page);
  await expect(page.locator('.ship-hud')).toContainText('⚡200');
  await page.evaluate(() => {
    const w = (window as unknown as { __PROJR_GRID__: G }).__PROJR_GRID__;
    const s = w.state() as unknown as { hero: { pos: Cell }; map: { stations: { id: string; pos: Cell }[] } };
    const armory = s.map.stations.find((st) => st.id === 'armory')!;
    s.hero.pos = { x: armory.pos.x, y: armory.pos.y + 1 };
    w.act({ kind: 'move', dir: { x: 0, y: -1 } });
  });
  await expect(page.locator('[data-testid="ship-panel-armory"]')).toBeVisible();
  await page.click('[data-testid="ship-buy-armoryShotgun"]');
  await expect(page.locator('.ship-hud')).toContainText('⚡120');
  await page.click('[data-testid="ship-choice-shotgun"]');
  await expect(page.locator('[data-testid="ship-choice-shotgun"]')).toHaveAttribute('aria-pressed', 'true');
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('projr.grid.meta.v1') ?? '{}') as { energy: number; facilities: { armoryShotgun: boolean } });
  expect(saved.energy).toBe(120);
  expect(saved.facilities.armoryShotgun).toBe(true);
  expect(errors).toEqual([]);
});
