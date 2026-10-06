import { LoadingScreen } from '../ui/screens/loadingScreen';
import { setWeaponKit } from '../view/grid/weaponKit';
import { getDungeon, getUal, getWeapons } from './gridAssets';
import { showFatal } from './fatal';
import type { Router } from './router';

/** Title → the world map round the crashed ship. */
export class WorldFlow {
  constructor(private readonly router: Router, private readonly root: HTMLElement, private readonly toTitle: () => void) {}

  async start(seed: number): Promise<void> {
    this.router.go(new LoadingScreen());
    try {
      const [{ WorldDemo }, lib, kit, weapons] = await Promise.all([import('../ui/overworld/worldDemo'), getUal(), getDungeon(), getWeapons()]);
      setWeaponKit(weapons);
      this.router.go(new WorldDemo(lib, kit, { seed, quit: this.toTitle }));
    } catch (e) {
      showFatal(this.root, e);
    }
  }
}
