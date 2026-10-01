import { test, expect, type Page } from '@playwright/test';

type Hook = { tick(): number; finish(): void };
type ExploreHook = { room(): string; walkTo(id: string): boolean };
type SavedRoom = { id: string; type: string; done?: boolean; doors: Record<string, string> };

const waitBattle = (page: Page) =>
  page.waitForFunction(() => ((window as unknown as { __PROJR__?: Hook }).__PROJR__?.tick() ?? 0) > 5, null, { timeout: 60_000 });

const finishBattle = async (page: Page) => {
  await waitBattle(page);
  await page.evaluate(() => (window as unknown as { __PROJR__: Hook }).__PROJR__.finish());
  await page.click('[data-testid="continue"]', { timeout: 30_000 });
};

const newRun = async (page: Page, seed: string) => {
  await page.goto('./');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.fill('[data-testid="run-seed"]', seed);
  await page.click('[data-testid="new-run"]');
};

/** Clears a pending start event, then picks a region and the whole party. */
const setOut = async (page: Page) => {
  if (await page.locator('[data-testid="open-start-event"]').count()) {
    await page.click('[data-testid="open-start-event"]');
    await page.locator('[data-testid^="choice-"]').first().click();
    await page.click('[data-testid="event-done"]');
  }
  await page.click('[data-testid="act-explore"]');
  await page.click('[data-testid="region-0"]');
  for (const chip of await page.locator('.pick-chips .fchip:not([disabled])').all()) await chip.click();
  await page.click('[data-testid="go-explore"]');
  await page.waitForFunction(() => !!(window as unknown as { __PROJR_EXPLORE__?: ExploreHook }).__PROJR_EXPLORE__?.room(), null, { timeout: 60_000 });
};

/** Walks room by room to the nearest uncleared enemy room and waits for the battle prep. */
const walkToFight = async (page: Page) => {
  const path = await page.evaluate(() => {
    const run = JSON.parse(localStorage.getItem('projr.run.v2')!) as { exploration: { at: string; rooms: Record<string, SavedRoom> } };
    const { at, rooms } = run.exploration;
    const prev: Record<string, string> = { [at]: at };
    const queue = [at];
    while (queue.length) {
      const id = queue.shift()!;
      if (id !== at && rooms[id]!.type === 'battle' && !rooms[id]!.done) {
        const out = [id];
        while (prev[out[0]!] !== at) out.unshift(prev[out[0]!]!);
        return out;
      }
      // only pass through rooms that do not start a fight
      if (id !== at && (rooms[id]!.type === 'elite' || rooms[id]!.type === 'battle')) continue;
      for (const n of Object.values(rooms[id]!.doors)) if (!(n in prev)) { prev[n] = id; queue.push(n); }
    }
    return [];
  });
  expect(path.length).toBeGreaterThan(0);
  for (const id of path) {
    await page.evaluate((r) => (window as unknown as { __PROJR_EXPLORE__: ExploreHook }).__PROJR_EXPLORE__.walkTo(r), id);
    if (id === path[path.length - 1]) break;
    await page.waitForFunction((r) => (window as unknown as { __PROJR_EXPLORE__?: ExploreHook }).__PROJR_EXPLORE__?.room() === r, id, { timeout: 30_000 });
  }
  await expect(page.locator('[data-testid="start-node-battle"]')).toBeEnabled({ timeout: 30_000 });
};

test('a week loop: train, report, recruit and naming, explore a room battle, leave, save and continue', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await newRun(page, '42');
  await expect(page.locator('[data-testid="week"]')).toHaveText('1주차');
  await page.screenshot({ path: 'test-artifacts/week-hub.png' });
  await page.click('[data-testid="act-train"]');
  await page.locator('.pick-chips .fchip').first().click();
  await page.click('[data-testid="go-train"]');
  await expect(page.locator('[data-testid="week-report"]')).toBeVisible();
  await page.click('[data-testid="next-week"]');
  for (let i = 0; i < 3 && (await page.locator('[data-testid="offer-0"]').count()); i++) await page.click('[data-testid="offer-0"]');

  await expect(page.locator('[data-testid="week"]')).toHaveText('2주차');
  await page.click('[data-testid="visitor-0"]');
  await page.fill('[data-testid="name-input"]', '하늘');
  await page.click('[data-testid="name-ok"]');
  await page.click('[data-testid="open-roster"]');
  await expect(page.locator('.merc-card')).toHaveCount(2);
  await expect(page.locator('.merc-card').first()).toContainText('하늘');
  await page.click('[data-testid="back-to-map"]');

  await setOut(page);
  await page.screenshot({ path: 'test-artifacts/week-explore.png' });
  await walkToFight(page);
  await page.click('[data-testid="start-node-battle"]');
  await page.screenshot({ path: 'test-artifacts/week-room-battle.png' });
  await finishBattle(page);
  await page.click('[data-testid="to-hub"]');
  for (let i = 0; i < 3 && (await page.locator('[data-testid="offer-0"]').count()); i++) await page.click('[data-testid="offer-0"]');
  if (await page.locator('[data-testid="leave-explore"]').count()) await page.click('[data-testid="leave-explore"]');
  await expect(page.locator('[data-testid="week-report"]')).toBeVisible();
  await page.click('[data-testid="next-week"]');
  for (let i = 0; i < 6 && (await page.locator('[data-testid="offer-0"]').count()); i++) await page.click('[data-testid="offer-0"]');
  await expect(page.locator('[data-testid="week"]')).toHaveText('3주차');

  await page.reload();
  await page.click('[data-testid="continue-run"]');
  await expect(page.locator('[data-testid="week"]')).toHaveText('3주차');
  await page.click('[data-testid="open-roster"]');
  await expect(page.locator('.merc-card')).toHaveCount(2);
  expect(errors).toEqual([]);
});

test('reloading mid room battle settles it as a retreat that ends the exploration', async ({ page }) => {
  await newRun(page, '42');
  await page.click('[data-testid="act-rest"]');
  await page.click('[data-testid="go-rest"]');
  await page.click('[data-testid="next-week"]');
  await page.click('[data-testid="skip-visitors"]');
  await setOut(page);
  await walkToFight(page);
  const gold = Number((await page.locator('[data-testid="gold"]').textContent())!.replace(/\D/g, ''));
  await page.click('[data-testid="start-node-battle"]');
  await waitBattle(page);
  await page.reload();
  await page.click('[data-testid="continue-run"]');
  await expect(page.locator('[data-testid="week-report"]')).toBeVisible();
  await page.click('[data-testid="next-week"]');
  await expect(page.locator('[data-testid="gold"]')).toHaveText(`${Math.floor(gold * 0.7)} G`);
});

test('pressing Enter under the level-up modal does not advance the week twice', async ({ page }) => {
  await newRun(page, '42');
  await page.click('[data-testid="act-train"]');
  await page.locator('.pick-chips .fchip').first().click();
  await page.click('[data-testid="go-train"]');
  await expect(page.locator('[data-testid="week-report"]')).toBeVisible();
  // give the protagonist a promotion to choose, as if training had levelled them
  await page.evaluate(() => {
    const run = JSON.parse(localStorage.getItem('projr.run.v2')!) as { roster: { mercs: { level: number; pendingLevelUps: number }[] } };
    run.roster.mercs[0]!.level = 3;
    run.roster.mercs[0]!.pendingLevelUps = 1;
    localStorage.setItem('projr.run.v2', JSON.stringify(run));
  });
  await page.reload();
  await page.click('[data-testid="continue-run"]');
  await page.click('[data-testid="next-week"]');
  await expect(page.locator('[data-testid="offer-0"]')).toHaveCount(1);
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-testid="offer-0"]')).toHaveCount(1);
  await page.click('[data-testid="offer-0"]');
  await expect(page.locator('[data-testid="week"]')).toHaveText('2주차');
});

test('Esc twice (or B twice) leaves the exploration from anywhere', async ({ page }) => {
  await newRun(page, '42');
  await page.click('[data-testid="act-rest"]');
  await page.click('[data-testid="go-rest"]');
  await page.click('[data-testid="next-week"]');
  await page.click('[data-testid="skip-visitors"]');
  await setOut(page);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-testid="week-report"]')).toBeVisible({ timeout: 5_000 });
});
