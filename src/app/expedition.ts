import { newDelve } from '../sim/delve/delveSim';
import { newSurface, type WorldParty } from '../sim/overworld/worldSim';
import { placeParty, type Carry } from '../sim/roam/carry';
import { LoadingScreen } from '../ui/screens/loadingScreen';
import type { DungeonKit } from '../view/grid/dungeonKit';
import type { UalLibrary } from '../view/grid/ualActor';
import { NatureKit } from '../view/overworld/natureKit';
import { setWeaponKit } from '../view/grid/weaponKit';
import { getDungeon, getUal, getWeapons } from './gridAssets';
import { showFatal } from './fatal';
import type { Router } from './router';

/**
 * The game's loop from the title: the pod lands, a clone explores the ground round it and finds its first soul,
 * then the party goes down the drill shaft for bio-matter and souls and rides back up to the pod to print new bodies.
 */
export class Expedition {
  private surface!: WorldParty;
  private trips = 0;
  private assets!: { lib: UalLibrary; kit: DungeonKit; nature?: NatureKit };

  constructor(private readonly router: Router, private readonly root: HTMLElement, private readonly toTitle: () => void, private seed: number) {}

  async start(): Promise<void> {
    this.router.go(new LoadingScreen());
    try {
      const [lib, kit, weapons, nature] = await Promise.all([getUal(), getDungeon(), getWeapons(), NatureKit.load(import.meta.env.BASE_URL).catch(() => undefined)]);
      setWeaponKit(weapons);
      this.assets = { lib, kit, nature };
      this.surface = newSurface(this.seed);
      this.trips = 0;
      await this.up(true);
    } catch (e) { showFatal(this.root, e); }
  }

  private restart = (): void => { this.seed = (this.seed * 7919 + 104729) % 999983 + 1; void this.start(); };

  /** On the surface by the pod (landing: the pod falls in first). */
  private async up(landing = false): Promise<void> {
    const { WorldDemo } = await import('../ui/overworld/worldDemo');
    this.router.go(new WorldDemo(this.assets.lib, this.assets.kit, { seed: this.seed, quit: this.toTitle, party: this.surface, landing, restart: this.restart, nature: this.assets.nature, onDrill: (c) => void this.down(c) }));
  }

  /** Down the shaft: a fresh first floor each trip. */
  private async down(c: Carry): Promise<void> {
    const { DelveDemo } = await import('../ui/delve/delveDemo');
    this.trips++;
    const party = newDelve(this.seed * 131 + this.trips, 1, { ...c, foundHeroes: [] });
    this.router.go(new DelveDemo(this.assets.lib, this.assets.kit, { seed: this.seed, quit: this.toTitle, party, restart: this.restart, onAscend: (back) => { placeParty(this.surface, back); void this.up(); } }));
  }
}
