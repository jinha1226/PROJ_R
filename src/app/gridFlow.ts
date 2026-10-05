import { ShipKit } from '../view/grid/shipKit';
import { ShipDeck } from '../ui/grid/ship/shipDeck';
import { shipState } from '../sim/grid/ship';
import { GridSim } from '../sim/grid/gridSim';
import type { RunOptions } from '../sim/grid/runSetup';
import { loadMeta, saveMeta } from './gridMeta';
import { loadRun } from './gridRun';
import { GridResult } from '../ui/grid/gridResult';
import { GridScreen } from '../ui/grid/gridScreen';
import { LoadingScreen } from '../ui/screens/loadingScreen';
import { DungeonKit } from '../view/grid/dungeonKit';
import { UalLibrary } from '../view/grid/ualActor';
import { setWeaponKit, WeaponKit } from '../view/grid/weaponKit';
import { showFatal } from './fatal';
import type { Router } from './router';

import { abandonRun, startGridRun, continueGridRun, type GridRunSession } from './gridRun';
let ual: Promise<UalLibrary> | null = null;
let dungeonP: Promise<DungeonKit> | null = null;
const getDungeon = (): Promise<DungeonKit> => (dungeonP ??= DungeonKit.load(import.meta.env.BASE_URL).catch((e: unknown) => { dungeonP = null; throw e; }));
let weaponsP: Promise<WeaponKit> | null = null;
const getWeapons = (): Promise<WeaponKit> => (weaponsP ??= WeaponKit.load(import.meta.env.BASE_URL).catch((e: unknown) => { weaponsP = null; throw e; }));
const getUal = (): Promise<UalLibrary> => (ual ??= UalLibrary.load(import.meta.env.BASE_URL).catch((e: unknown) => { ual = null; throw e; }));

/** Title → walkable ship → run → result → pod. */
export class GridFlow {
  private meta = loadMeta();
  private lastEnergy = 0;
  constructor(private readonly router: Router, private readonly root: HTMLElement, private readonly toTitle: () => void) {}

  start(seed: number): void {
    void this.ship(seed);
  }

  continue(): void {
    const run = continueGridRun();
    if (run) void this.launch(run.sim.s.seed, run);
  }

  private async ship(seed: number, wake = false): Promise<void> {
    this.router.go(new LoadingScreen());
    try {
      const [lib, kit, weapons, shipKit] = await Promise.all([getUal(), getDungeon(), getWeapons(), ShipKit.load(import.meta.env.BASE_URL)]);
      setWeaponKit(weapons);
      const ship = new ShipDeck({ meta: this.meta, kit: shipKit, lastEnergy: this.lastEnergy, wake, saved: !!loadRun(),
        save: saveMeta, launch: options => { void this.launch(seed, undefined, options); }, resume: () => this.continue(), abandon: () => { this.meta = abandonRun(); void this.ship(seed); }, quit: this.toTitle });
      this.router.go(new GridScreen({ sim: GridSim.fromState(shipState(this.meta)), lib, kit, ship, end: () => undefined, fatal: e => showFatal(this.root, e) }));
    } catch (e) { showFatal(this.root, e); }
  }

  private async launch(seed: number, saved?: GridRunSession, options?: RunOptions): Promise<void> {
    this.router.go(new LoadingScreen());
    try {
      const [lib, kit, weapons] = await Promise.all([getUal(), getDungeon(), getWeapons()]);
      setWeaponKit(weapons);
      const run = saved ?? startGridRun(seed, options, this.meta);
      const sim = run.sim;
      this.router.go(new GridScreen({ sim, lib, kit, afterAction: () => run.checkpoint(), end: () => this.result(run, seed), fatal: (e) => showFatal(this.root, e) }));
    } catch (e) {
      showFatal(this.root, e);
    }
  }

  private result(run: GridRunSession, seed: number): void {
    run.checkpoint();
    this.meta = run.meta;
    this.lastEnergy = run.sim.s.run.energy;
    const s = run.sim.s;
    const won = s.outcome === 'won', returned = s.outcome === 'returned';
    const rec = run.meta;
    this.router.go(new GridResult({
      energy: s.run.energy, killedBy: s.run.killedBy, suit: [...s.hero.suit],
      won, returned, floor: s.run.floor, kills: s.run.kills, level: s.hero.level, turns: Math.floor(s.time), best: rec.best, wins: rec.wins,
      again: () => { void this.ship((seed * 7919 + 104729) % 999983 + 1, true); }, quit: () => this.toTitle(),
    }));
  }
}
