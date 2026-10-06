import { LoadingScreen } from '../ui/screens/loadingScreen';
import { setWeaponKit } from '../view/grid/weaponKit';
import { getDungeon, getUal, getWeapons } from './gridAssets';
import { showFatal } from './fatal';
import type { Router } from './router';

/** Title → down the lift into the dungeon below the crashed ship (the surface base comes later; `?demo=world` shows the land above). */
export class WorldFlow {
  constructor(private readonly router: Router, private readonly root: HTMLElement, private readonly toTitle: () => void) {}

  async start(seed: number): Promise<void> {
    this.router.go(new LoadingScreen());
    try {
      const [{ DelveDemo }, lib, kit, weapons] = await Promise.all([import('../ui/delve/delveDemo'), getUal(), getDungeon(), getWeapons()]);
      setWeaponKit(weapons);
      this.router.go(new DelveDemo(lib, kit, { seed, quit: this.toTitle }));
    } catch (e) {
      showFatal(this.root, e);
    }
  }
}
