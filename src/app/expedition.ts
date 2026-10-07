import { beaconReturn, departSurface, returnToSurface } from '../sim/base/trips';
import { newSurface, type WorldParty } from '../sim/overworld/worldSim';
import { rejoin, type Carry } from '../sim/roam/carry';
import { reenter, type DelveParty } from '../sim/delve/delveSim';
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
  /** the floor a return beacon kept, waiting for a clone to come back down */
  private kept?: DelveParty;
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
      this.trips = 0; this.kept = undefined;
      await this.up(true);
    } catch (e) { showFatal(this.root, e); }
  }

  private restart = (): void => { this.seed = (this.seed * 7919 + 104729) % 999983 + 1; void this.start(); };

  /** On the surface by the pod (landing: the pod falls in first). */
  private async up(landing = false): Promise<void> {
    const { WorldScreen } = await import('../ui/overworld/worldScreen');
    this.router.go(new WorldScreen(this.assets.lib, this.assets.kit, { seed: this.seed, quit: this.toTitle, party: this.surface, landing, restart: this.restart, nature: this.assets.nature, keptFloor: this.kept?.floor, onDrill: (c, floor) => void this.down(c, floor) }));
  }

  /**
   * Down the shaft with one clone: back to the floor a beacon kept, or a fresh chosen start floor. A refused start puts the
   * clone back at the drill. Riding the lift up ends the floor; the beacon keeps it; a death ends it too.
   */
  private async down(c: Carry, floor = 1): Promise<void> {
    const { DelveScreen } = await import('../ui/delve/delveScreen');
    let party = this.kept;
    if (party) { reenter(party, c); this.surface.away = true; this.kept = undefined; }
    else party = departSurface(this.surface, this.seed * 131 + this.trips + 1, c, floor) ?? undefined;
    if (!party) { rejoin(this.surface, c, this.surface.drill ?? this.surface.base); return; }
    this.trips++;
    const kept = party;
    this.router.go(new DelveScreen(this.assets.lib, this.assets.kit, { seed: this.seed, quit: this.toTitle, party, restart: this.restart,
      onAscend: (back) => { this.kept = undefined; returnToSurface(this.surface, back); void this.up(); },
      onBeacon: (back) => { this.kept = kept; beaconReturn(this.surface, back); void this.up(); } }));
  }
}
