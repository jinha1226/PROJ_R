import { expect, test } from '@playwright/test';

for (const legacy of [false, true]) test(`${legacy ? 'legacy navigation' : 'portals'} offers deep starts without shortcut purchases`, async ({ page }) => {
  await page.addInitScript((legacy) => {
    localStorage.setItem('projr.grid.meta.v1', JSON.stringify({
      energy: 0, repairs: ['workbench', 'nav'], records: ['dash', 'rapid', 'chain', 'momentum'],
      startCandidates: [], bossesKilled: [5, 10], best: 10, wins: 0, unlocked: ['gunRelay', 'spinShot'],
      facilities: { suitSlots: 2, chargePlus: 0, ...(legacy ? { navCrypt: true, navRuins: true } : {}) },
      ...(legacy ? {} : { portals: [5, 10] }),
    }));
  }, legacy);
  await page.goto('./?dungeon=1&seed=21'); await page.click('[data-testid="to-grid"]');
  await expect(page.locator('[data-testid="ship-deck"]')).toBeVisible({ timeout: 60_000 });
  await page.waitForFunction(() => !!(window as unknown as { __PROJR_GRID__?: unknown }).__PROJR_GRID__);
  const openStation = async (id: string) => page.evaluate((id) => {
    type Cell = { x: number; y: number };
    const hook = (window as unknown as { __PROJR_GRID__: {
      state(): { hero: { pos: Cell }; map: { stations: { id: string; pos: Cell }[] } }; act(a: unknown): void;
    } }).__PROJR_GRID__;
    const s = hook.state(), station = s.map.stations.find(p => p.id === id)!;
    s.hero.pos = { x: station.pos.x, y: station.pos.y + 1 };
    hook.act({ kind: 'move', dir: { x: 0, y: -1 } });
  }, id);
  await openStation('nav');
  for (const n of [1, 6, 11]) await expect(page.locator(`[data-testid="ship-choice-${n}"]`)).toBeEnabled();
  await expect(page.locator('[data-testid^="ship-buy-nav"]')).toHaveCount(0);
  await page.click('[data-testid="ship-choice-11"]'); await page.click('[data-testid="ship-panel-close"]');
  await openStation('hatch'); await page.click('[data-testid="ship-launch"]');
  await page.waitForFunction(() => {
    const s = (window as unknown as { __PROJR_GRID__: { state(): { mode?: string; run: { floor: number } } } }).__PROJR_GRID__.state();
    return s.mode !== 'ship' && s.run.floor === 11;
  }, null, { timeout: 60_000 });
});
