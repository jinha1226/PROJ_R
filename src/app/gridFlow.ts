import { GridResult } from '../ui/grid/gridResult';
import { GridScreen } from '../ui/grid/gridScreen';
import { LoadingScreen } from '../ui/screens/loadingScreen';
import { DungeonKit } from '../view/grid/dungeonKit';
import { UalLibrary } from '../view/grid/ualActor';
import { setWeaponKit, WeaponKit } from '../view/grid/weaponKit';
import { showFatal } from './fatal';
import type { Router } from './router';

import { startGridRun, continueGridRun, type GridRunSession } from './gridRun';
let ual: Promise<UalLibrary> | null = null;
let dungeonP: Promise<DungeonKit> | null = null;
const getDungeon = (): Promise<DungeonKit> => (dungeonP ??= DungeonKit.load(import.meta.env.BASE_URL).catch((e: unknown) => { dungeonP = null; throw e; }));
let weaponsP: Promise<WeaponKit> | null = null;
const getWeapons = (): Promise<WeaponKit> => (weaponsP ??= WeaponKit.load(import.meta.env.BASE_URL).catch((e: unknown) => { weaponsP = null; throw e; }));
const getUal = (): Promise<UalLibrary> => (ual ??= UalLibrary.load(import.meta.env.BASE_URL).catch((e: unknown) => { ual = null; throw e; }));

/** Grid dungeon: title → fifteen floors → result → again. */
export class GridFlow {
  constructor(private readonly router: Router, private readonly root: HTMLElement, private readonly toTitle: () => void) {}

  start(seed: number): void {
    void this.launch(seed);
  }

  continue(): void {
    const run = continueGridRun();
    if (run) void this.launch(run.sim.s.seed, run);
  }

  private async launch(seed: number, saved?: GridRunSession): Promise<void> {
    this.router.go(new LoadingScreen());
    try {
      const [lib, kit, weapons] = await Promise.all([getUal(), getDungeon(), getWeapons()]);
      setWeaponKit(weapons);
      const run = saved ?? startGridRun(seed);
      const sim = run.sim;
      this.router.go(new GridScreen({ sim, lib, kit, afterAction: () => run.checkpoint(), end: () => this.result(run, seed), fatal: (e) => showFatal(this.root, e) }));
    } catch (e) {
      showFatal(this.root, e);
    }
  }

  private result(run: GridRunSession, seed: number): void {
    const s = run.sim.s;
    const won = s.outcome === 'won';
    const rec = run.meta;
    this.router.go(new GridResult({
      killedBy: s.run.killedBy, suit: [...s.hero.suit],
      won, floor: s.run.floor, kills: s.run.kills, level: s.hero.level, turns: Math.floor(s.time), best: rec.best, wins: rec.wins,
      again: () => this.start((seed * 7919 + 104729) % 999983 + 1), quit: () => this.toTitle(),
    }));
  }
}
